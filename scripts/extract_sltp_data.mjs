#!/usr/bin/env node
// One-off extractor: pulls SPY long closed trades with option 1-min bars
// into a JSON payload for the SL/TP backtest artifact.
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const db = new Database(path.join(process.cwd(), 'trading-journal.db'), { readonly: true });

const trades = db.prepare(`
  SELECT t.id, t.name, t.open_date, t.close_date, t.entry_price, t.exit_price,
         t.realized_pnl, t.entry_quality, t.fees,
         l.id AS leg_id, l.option_type, l.strike, l.expiration,
         l.entry_price AS leg_entry_price, l.exit_price AS leg_exit_price,
         l.entry_underlying_price, l.quantity AS leg_qty
  FROM trades t
  JOIN trade_legs l ON l.trade_id = t.id
  WHERE t.underlying = 'SPY'
    AND t.strategy = 'long'
    AND t.status = 'closed'
    AND length(t.open_date) > 10
    AND length(t.close_date) > 10
  ORDER BY t.open_date ASC
`).all();

const getSnapshot = db.prepare(`
  SELECT bars FROM chart_snapshots
  WHERE trade_id = ? AND leg_id = ? AND symbol_type = 'option'
  LIMIT 1
`);

const out = [];
let dropped_no_snapshot = 0;
let dropped_no_bars_after_entry = 0;

for (const t of trades) {
  const snap = getSnapshot.get(t.id, t.leg_id);
  if (!snap) { dropped_no_snapshot++; continue; }

  const bars = JSON.parse(snap.bars);
  const entryTs = Math.floor(new Date(t.open_date).getTime() / 1000);
  const closeTs = Math.floor(new Date(t.close_date).getTime() / 1000);

  // Bars from the minute of entry onward (inclusive of the entry minute)
  const entryMinute = Math.floor(entryTs / 60) * 60;
  const forward = bars
    .filter((b) => b.t >= entryMinute)
    .map((b) => ({ t: b.t, h: b.h, l: b.l, c: b.c }));

  if (forward.length === 0) { dropped_no_bars_after_entry++; continue; }

  out.push({
    id: t.id,
    name: t.name,
    openDate: t.open_date,
    closeDate: t.close_date,
    entryTs,
    closeTs,
    entryPrice: t.leg_entry_price ?? t.entry_price,
    exitPrice: t.leg_exit_price ?? t.exit_price,
    realizedPnl: t.realized_pnl,
    entryQuality: t.entry_quality,
    optionType: t.option_type,
    strike: t.strike,
    expiration: t.expiration,
    qty: t.leg_qty ?? 1,
    bars: forward,
  });
}

console.error(`Extracted ${out.length} trades.`);
console.error(`  dropped: no snapshot = ${dropped_no_snapshot}, no bars after entry = ${dropped_no_bars_after_entry}`);
console.error(`  quality breakdown:`);
const q = { clean: 0, intuitive: 0, fomo: 0, chased: 0, null: 0 };
for (const t of out) q[t.entryQuality ?? 'null']++;
console.error(`    ${JSON.stringify(q)}`);

fs.writeFileSync('scripts/sltp_trades.json', JSON.stringify(out));
console.error(`Wrote scripts/sltp_trades.json (${(fs.statSync('scripts/sltp_trades.json').size / 1024).toFixed(1)} KB)`);
