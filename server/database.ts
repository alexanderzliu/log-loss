import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'trading-journal.db');
export const db = new Database(dbPath);

export function initDatabase() {
  // Enable WAL mode for better concurrent read/write performance
  db.pragma('journal_mode = WAL');
  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Migrate away from old schema if needed
  migrateToOptionsSchema();

  // Create trades table
  db.exec(`
    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      asset_type TEXT NOT NULL DEFAULT 'option' CHECK(asset_type IN ('option', 'futures', 'stock')),
      underlying TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
      strategy TEXT NOT NULL DEFAULT 'long' CHECK(strategy IN ('long', 'short', 'debit_spread', 'credit_spread', 'iron_condor', 'straddle', 'strangle', 'custom')),
      side TEXT NOT NULL DEFAULT 'buy' CHECK(side IN ('buy', 'sell')),
      quantity INTEGER NOT NULL DEFAULT 1,
      entry_price REAL,
      exit_price REAL,
      fees REAL,
      realized_pnl REAL,
      open_date TEXT,
      close_date TEXT,
      entry_quality TEXT CHECK(entry_quality IN ('clean', 'fomo', 'chased', 'intuitive')),
      followed_plan INTEGER,
      thesis TEXT DEFAULT '',
      exit_plan TEXT DEFAULT '',
      reflection TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Create trade legs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS trade_legs (
      id TEXT PRIMARY KEY,
      trade_id TEXT NOT NULL,
      ticker TEXT NOT NULL DEFAULT '',
      option_type TEXT CHECK(option_type IN ('call', 'put')),
      strike REAL,
      expiration TEXT,
      side TEXT NOT NULL DEFAULT 'buy' CHECK(side IN ('buy', 'sell')),
      quantity INTEGER NOT NULL DEFAULT 1,
      entry_price REAL,
      exit_price REAL,
      entry_underlying_price REAL,
      exit_underlying_price REAL,
      delta REAL,
      gamma REAL,
      theta REAL,
      vega REAL,
      iv REAL,
      FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE CASCADE
    )
  `);

  // Create trade tags table
  db.exec(`
    CREATE TABLE IF NOT EXISTS trade_tags (
      id TEXT PRIMARY KEY,
      trade_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      category TEXT,
      FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE CASCADE,
      UNIQUE(trade_id, tag)
    )
  `);

  // Create reflections table (with trade_id FK)
  db.exec(`
    CREATE TABLE IF NOT EXISTS reflections (
      id TEXT PRIMARY KEY,
      trade_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'success' CHECK(type IN ('success', 'lesson', 'mistake')),
      content TEXT NOT NULL,
      tags TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE CASCADE
    )
  `);

  // Create price cache table
  db.exec(`
    CREATE TABLE IF NOT EXISTS price_cache (
      symbol TEXT NOT NULL,
      asset_type TEXT NOT NULL,
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
    CREATE INDEX IF NOT EXISTS idx_trades_underlying ON trades(underlying);
    CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
    CREATE INDEX IF NOT EXISTS idx_trades_asset_type ON trades(asset_type);
    CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades(strategy);
    CREATE INDEX IF NOT EXISTS idx_trades_open_date ON trades(open_date);
    CREATE INDEX IF NOT EXISTS idx_trade_legs_trade_id ON trade_legs(trade_id);
    CREATE INDEX IF NOT EXISTS idx_trade_tags_trade_id ON trade_tags(trade_id);
    CREATE INDEX IF NOT EXISTS idx_trade_tags_tag ON trade_tags(tag);
    CREATE INDEX IF NOT EXISTS idx_reflections_trade_id ON reflections(trade_id);
    CREATE INDEX IF NOT EXISTS idx_reflections_type ON reflections(type);
  `);

  // Add predictions table
  migrateCreatePredictions();

  // Add rules table
  migrateCreateRules();

  console.log('Database initialized successfully');
}

function migrateToOptionsSchema() {
  // Check if old positions table exists (from the crypto/stock era)
  const positionsExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='positions'"
  ).get();

  if (!positionsExists) {
    // Also clean up any lingering tables from even older schema eras
    db.exec(`
      DROP TABLE IF EXISTS executions;
      DROP TABLE IF EXISTS positions_backup;
      DROP TABLE IF EXISTS trades_backup;
    `);

    // Check if reflections has old position_id FK (needs recreation)
    const reflectionsInfo = db.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='reflections'"
    ).get() as { sql: string } | undefined;

    if (reflectionsInfo && reflectionsInfo.sql.includes('position_id')) {
      console.log('Recreating reflections table with trade_id FK...');
      db.exec('DROP TABLE IF EXISTS reflections');
    }

    return;
  }

  console.log('Migrating from positions/executions schema to trades schema...');

  const migrate = db.transaction(() => {
    // Drop old tables (order matters for FK constraints)
    db.exec('DROP TABLE IF EXISTS executions');
    db.exec('DROP TABLE IF EXISTS reflections');
    db.exec('DROP TABLE IF EXISTS positions');
    db.exec('DROP TABLE IF EXISTS positions_backup');
    db.exec('DROP TABLE IF EXISTS trades_backup');

    // Also drop any old trades table from pre-positions era
    const oldTradesExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='trades'"
    ).get();
    if (oldTradesExists) {
      db.exec('DROP TABLE IF EXISTS trades');
    }
  });

  migrate();
  console.log('Old schema tables removed. New tables will be created.');
}

function migrateCreatePredictions() {
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
