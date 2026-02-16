import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'trading-journal.db');
export const db = new Database(dbPath);

export function initDatabase() {
  // Enable WAL mode for better concurrent read/write performance
  db.pragma('journal_mode = WAL');
  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create positions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY,
      asset_type TEXT NOT NULL CHECK(asset_type IN ('crypto', 'stock')),
      symbol TEXT NOT NULL,
      direction TEXT NOT NULL DEFAULT 'long' CHECK(direction IN ('long', 'short')),
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
      total_quantity REAL NOT NULL DEFAULT 0,
      remaining_quantity REAL NOT NULL DEFAULT 0,
      avg_entry_price REAL NOT NULL DEFAULT 0,
      total_cost_basis REAL NOT NULL DEFAULT 0,
      realized_pnl REAL NOT NULL DEFAULT 0,
      realized_pnl_percent REAL,
      stop_loss REAL,
      take_profit REAL,
      hypothesis TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Create executions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS executions (
      id TEXT PRIMARY KEY,
      position_id TEXT NOT NULL,
      side TEXT NOT NULL CHECK(side IN ('buy', 'sell')),
      price REAL NOT NULL,
      quantity REAL NOT NULL,
      executed_at TEXT NOT NULL,
      pnl REAL,
      pnl_percent REAL,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE
    )
  `);

  // Create price cache table
  db.exec(`
    CREATE TABLE IF NOT EXISTS price_cache (
      symbol TEXT NOT NULL,
      asset_type TEXT NOT NULL CHECK(asset_type IN ('crypto', 'stock')),
      price REAL NOT NULL,
      change_24h REAL,
      change_percent_24h REAL,
      high_24h REAL,
      low_24h REAL,
      volume_24h REAL,
      last_updated TEXT NOT NULL,
      PRIMARY KEY (symbol, asset_type)
    )
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);
    CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
    CREATE INDEX IF NOT EXISTS idx_positions_asset_type ON positions(asset_type);
    CREATE INDEX IF NOT EXISTS idx_executions_position_id ON executions(position_id);
  `);

  // Migrate from old trades table if it exists
  migrateFromTrades();

  // Add chain/contract_address support for DexScreener tokens
  migrateAddChainColumns();

  // Add predictions table for Kalshi prediction market trades
  migrateCreatePredictions();

  // Add token metrics columns to price_cache
  migrateAddTokenMetrics();

  // Add reflections table
  migrateCreateReflections();

  // Rename reflection type 'reflection' -> 'success'
  migrateReflectionTypeRename();

  // Add rules table
  migrateCreateRules();

  // Add token_metrics table for memecoin analytics
  migrateCreateTokenMetrics();

  // Add token_snapshots table for time-series data (Phase 2)
  migrateCreateTokenSnapshots();

  // Add service_state table for crash-resilient service state (Phase 2)
  migrateCreateServiceState();

  console.log('Database initialized successfully');
}

function migrateFromTrades() {
  // Check if old trades table exists
  const tradesTableExists = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='trades'
  `).get();

  if (!tradesTableExists) return;

  // Check if positions table already has data (migration already ran)
  const positionCount = db.prepare('SELECT COUNT(*) as count FROM positions').get() as { count: number };
  if (positionCount.count > 0) {
    // Migration already completed, drop the old table reference
    return;
  }

  // Check if trades table has data to migrate
  const tradeCount = db.prepare('SELECT COUNT(*) as count FROM trades').get() as { count: number };
  if (tradeCount.count === 0) {
    // No data to migrate, just rename
    db.exec('ALTER TABLE trades RENAME TO trades_backup');
    console.log('No trade data to migrate, renamed empty trades table to trades_backup');
    return;
  }

  console.log(`Migrating ${tradeCount.count} trades to positions + executions...`);

  const migrate = db.transaction(() => {
    // Backfill remaining_quantity for legacy data
    db.exec(`UPDATE trades SET remaining_quantity = quantity WHERE side = 'buy' AND remaining_quantity IS NULL`);

    // Step 1: Create positions from buy trades grouped by (symbol, asset_type)
    // Use the earliest buy trade's ID as the position ID for determinism
    const buyGroups = db.prepare(`
      SELECT
        symbol,
        asset_type,
        MIN(id) as first_trade_id,
        SUM(quantity) as total_quantity,
        SUM(COALESCE(remaining_quantity, quantity)) as remaining_quantity,
        SUM(entry_price * quantity) as total_cost_basis,
        CASE WHEN SUM(quantity) > 0
          THEN SUM(entry_price * quantity) / SUM(quantity)
          ELSE 0 END as avg_entry_price,
        MAX(stop_loss) as stop_loss,
        MAX(take_profit) as take_profit,
        MIN(entry_date) as opened_at,
        MIN(created_at) as first_created_at,
        MAX(updated_at) as last_updated_at,
        -- Position is open if any buy for this symbol is still open
        CASE WHEN SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) > 0
          THEN 'open' ELSE 'closed' END as status,
        CASE WHEN SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) = 0
          THEN MAX(exit_date) ELSE NULL END as closed_at
      FROM trades
      WHERE side = 'buy'
      GROUP BY symbol, asset_type
    `).all() as Record<string, unknown>[];

    const insertPosition = db.prepare(`
      INSERT INTO positions (
        id, asset_type, symbol, direction, status,
        total_quantity, remaining_quantity, avg_entry_price, total_cost_basis,
        realized_pnl, realized_pnl_percent,
        stop_loss, take_profit, hypothesis, notes,
        opened_at, closed_at, created_at, updated_at
      ) VALUES (?, ?, ?, 'long', ?, ?, ?, ?, ?, 0, NULL, ?, ?, '', '', ?, ?, ?, ?)
    `);

    for (const group of buyGroups) {
      // Get the first buy trade's hypothesis for this group
      const firstBuy = db.prepare(`
        SELECT hypothesis, notes FROM trades
        WHERE symbol = ? AND asset_type = ? AND side = 'buy'
        ORDER BY entry_date ASC LIMIT 1
      `).get(group.symbol, group.asset_type) as { hypothesis: string; notes: string } | undefined;

      insertPosition.run(
        group.first_trade_id,
        group.asset_type,
        group.symbol,
        group.status,
        group.total_quantity,
        group.remaining_quantity,
        group.avg_entry_price,
        group.total_cost_basis,
        group.stop_loss,
        group.take_profit,
        group.opened_at,
        group.closed_at,
        group.first_created_at,
        group.last_updated_at
      );

      // Update hypothesis and notes from first buy
      if (firstBuy) {
        db.prepare(`
          UPDATE positions SET hypothesis = ?, notes = ? WHERE id = ?
        `).run(firstBuy.hypothesis || '', firstBuy.notes || '', group.first_trade_id);
      }
    }

    // Step 2: Insert buy executions
    db.exec(`
      INSERT INTO executions (id, position_id, side, price, quantity, executed_at, pnl, pnl_percent, notes, created_at)
      SELECT
        t.id,
        p.id,
        'buy',
        t.entry_price,
        t.quantity,
        t.entry_date,
        NULL,
        NULL,
        t.notes,
        t.created_at
      FROM trades t
      JOIN positions p ON p.symbol = t.symbol AND p.asset_type = t.asset_type
      WHERE t.side = 'buy'
    `);

    // Step 3: Insert sell executions
    db.exec(`
      INSERT INTO executions (id, position_id, side, price, quantity, executed_at, pnl, pnl_percent, notes, created_at)
      SELECT
        t.id,
        p.id,
        'sell',
        t.entry_price,
        t.quantity,
        t.entry_date,
        t.pnl,
        t.pnl_percent,
        t.notes,
        t.created_at
      FROM trades t
      JOIN positions p ON p.symbol = t.symbol AND p.asset_type = t.asset_type
      WHERE t.side = 'sell'
    `);

    // Step 4: Recompute realized P&L on positions from sell executions
    db.exec(`
      UPDATE positions SET
        realized_pnl = COALESCE((
          SELECT SUM(pnl) FROM executions
          WHERE executions.position_id = positions.id AND side = 'sell' AND pnl IS NOT NULL
        ), 0),
        realized_pnl_percent = CASE
          WHEN total_cost_basis > 0 THEN
            COALESCE((
              SELECT SUM(pnl) FROM executions
              WHERE executions.position_id = positions.id AND side = 'sell' AND pnl IS NOT NULL
            ), 0) / total_cost_basis * 100
          ELSE NULL
        END
    `);

    // Step 5: Rename old trades table as backup
    db.exec('ALTER TABLE trades RENAME TO trades_backup');
  });

  migrate();

  const migratedPositions = db.prepare('SELECT COUNT(*) as count FROM positions').get() as { count: number };
  const migratedExecutions = db.prepare('SELECT COUNT(*) as count FROM executions').get() as { count: number };
  console.log(`Migration complete: ${migratedPositions.count} positions, ${migratedExecutions.count} executions`);
}

function migrateAddChainColumns() {
  // Add chain and contract_address columns to positions (idempotent via try/catch)
  const columns = db.prepare('PRAGMA table_info(positions)').all() as { name: string }[];
  const columnNames = columns.map(c => c.name);

  if (!columnNames.includes('chain')) {
    db.exec('ALTER TABLE positions ADD COLUMN chain TEXT DEFAULT NULL');
    db.exec('ALTER TABLE positions ADD COLUMN contract_address TEXT DEFAULT NULL');
    db.exec('CREATE INDEX IF NOT EXISTS idx_positions_chain_address ON positions(chain, contract_address)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_positions_lookup ON positions(symbol, asset_type, status, chain, contract_address)');
    console.log('Added chain/contract_address columns to positions');
  }
}

function migrateAddTokenMetrics() {
  const columns = db.prepare('PRAGMA table_info(price_cache)').all() as { name: string }[];
  const columnNames = columns.map(c => c.name);

  if (!columnNames.includes('market_cap')) {
    db.exec('ALTER TABLE price_cache ADD COLUMN market_cap REAL DEFAULT NULL');
    db.exec('ALTER TABLE price_cache ADD COLUMN fdv REAL DEFAULT NULL');
    db.exec('ALTER TABLE price_cache ADD COLUMN liquidity_usd REAL DEFAULT NULL');
    db.exec('ALTER TABLE price_cache ADD COLUMN txn_count_24h INTEGER DEFAULT NULL');
    db.exec('ALTER TABLE price_cache ADD COLUMN holder_count INTEGER DEFAULT NULL');
    console.log('Added token metrics columns to price_cache');
  }
}

function migrateCreatePredictions() {
  // Idempotent: CREATE TABLE IF NOT EXISTS
  db.exec(`
    CREATE TABLE IF NOT EXISTS predictions (
      id TEXT PRIMARY KEY,
      market TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      side TEXT NOT NULL CHECK(side IN ('yes', 'no')),
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
      resolution TEXT CHECK(resolution IN ('yes', 'no')),
      entry_price REAL NOT NULL,
      exit_price REAL,
      quantity REAL NOT NULL CHECK(quantity > 0),
      cost_basis REAL NOT NULL,
      pnl REAL,
      pnl_percent REAL,
      hypothesis TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      expires_at TEXT,
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_predictions_status ON predictions(status);
    CREATE INDEX IF NOT EXISTS idx_predictions_side ON predictions(side);
  `);
}

function migrateCreateReflections() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reflections (
      id TEXT PRIMARY KEY,
      position_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'reflection' CHECK(type IN ('reflection', 'lesson', 'mistake')),
      content TEXT NOT NULL,
      tags TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_reflections_position_id ON reflections(position_id);
    CREATE INDEX IF NOT EXISTS idx_reflections_type ON reflections(type);
  `);
}

function migrateReflectionTypeRename() {
  // Check if the table still has the old CHECK constraint by looking for 'reflection' type rows
  // or checking the table SQL. We detect by trying to see the table definition.
  const tableInfo = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='reflections'"
  ).get() as { sql: string } | undefined;

  if (!tableInfo || !tableInfo.sql.includes("'reflection'")) {
    // Already migrated or table doesn't exist
    return;
  }

  console.log('Migrating reflection type: reflection -> success...');

  const migrate = db.transaction(() => {
    // Update existing data
    db.exec("UPDATE reflections SET type = 'success' WHERE type = 'reflection'");

    // Recreate table with new CHECK constraint
    db.exec(`
      CREATE TABLE reflections_new (
        id TEXT PRIMARY KEY,
        position_id TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'success' CHECK(type IN ('success', 'lesson', 'mistake')),
        content TEXT NOT NULL,
        tags TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE
      )
    `);

    // Copy data
    db.exec(`
      INSERT INTO reflections_new (id, position_id, type, content, tags, created_at, updated_at)
      SELECT id, position_id, type, content, tags, created_at, updated_at
      FROM reflections
    `);

    // Drop old table and rename new one
    db.exec('DROP TABLE reflections');
    db.exec('ALTER TABLE reflections_new RENAME TO reflections');

    // Recreate indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_reflections_position_id ON reflections(position_id);
      CREATE INDEX IF NOT EXISTS idx_reflections_type ON reflections(type);
    `);
  });

  migrate();
  console.log('Reflection type migration complete');
}

function migrateCreateRules() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function migrateCreateTokenSnapshots() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS token_snapshots (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      chain            TEXT NOT NULL,
      contract_address TEXT NOT NULL,
      captured_at      TEXT NOT NULL,
      price            REAL,
      volume_24h       REAL,
      volume_buy_24h   REAL,
      volume_sell_24h  REAL,
      buys_24h         INTEGER,
      sells_24h        INTEGER,
      liquidity_usd    REAL,
      holder_count     INTEGER,
      market_cap       REAL,
      buy_pressure     REAL,
      raw_metrics      TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_snapshots_token_time ON token_snapshots(chain, contract_address, captured_at);
    CREATE INDEX IF NOT EXISTS idx_snapshots_time ON token_snapshots(captured_at);
  `);
}

function migrateCreateServiceState() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS service_state (
      service_name TEXT PRIMARY KEY,
      last_run_at  TEXT NOT NULL,
      metadata     TEXT
    )
  `);
}

function migrateCreateTokenMetrics() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS token_metrics (
      chain            TEXT NOT NULL,
      contract_address TEXT NOT NULL,
      price            REAL,
      volume_24h       REAL,
      volume_buy_24h   REAL,
      volume_sell_24h  REAL,
      buys_24h         INTEGER,
      sells_24h        INTEGER,
      buyers_24h       INTEGER,
      sellers_24h      INTEGER,
      liquidity_usd    REAL,
      market_cap       REAL,
      fdv              REAL,
      pair_created_at  INTEGER,
      pair_address     TEXT,
      dex_id           TEXT,
      raw_metrics      TEXT NOT NULL,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (chain, contract_address)
    )
  `);
}
