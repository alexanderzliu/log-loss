import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'trading-journal.db');
export const db = new Database(dbPath);

export function initDatabase() {
  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create trades table
  db.exec(`
    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      asset_type TEXT NOT NULL CHECK(asset_type IN ('crypto', 'stock')),
      symbol TEXT NOT NULL,
      side TEXT NOT NULL CHECK(side IN ('buy', 'sell')),
      entry_date TEXT NOT NULL,
      entry_price REAL NOT NULL,
      quantity REAL NOT NULL,
      remaining_quantity REAL,
      stop_loss REAL,
      take_profit REAL,
      hypothesis TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
      exit_date TEXT,
      exit_price REAL,
      pnl REAL,
      pnl_percent REAL,
      notes TEXT DEFAULT '',
      linked_trade_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (linked_trade_id) REFERENCES trades(id)
    )
  `);

  // Migration: Initialize remaining_quantity for existing buy trades that don't have it set
  db.exec(`UPDATE trades SET remaining_quantity = quantity WHERE side = 'buy' AND remaining_quantity IS NULL`);

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

  // Create index for faster queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
    CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
    CREATE INDEX IF NOT EXISTS idx_trades_asset_type ON trades(asset_type);
  `);

  console.log('Database initialized successfully');
}
