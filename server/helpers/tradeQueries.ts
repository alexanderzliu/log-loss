import { db } from '../database';
import type { Trade } from '../../shared/types.ts';
import { rowToTrade, rowToTradeLeg, rowToTradeTag, rowToReflection } from './rowMappers';
import { captureSnapshotsForTrade } from '../routes/snapshots';

export function getTradeWithDetails(id: string): Trade | null {
  const row = db.prepare('SELECT * FROM trades WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;

  const trade = rowToTrade(row);

  const legRows = db.prepare(
    'SELECT * FROM trade_legs WHERE trade_id = ? ORDER BY rowid ASC'
  ).all(id) as Record<string, unknown>[];
  trade.legs = legRows.map(rowToTradeLeg);

  const tagRows = db.prepare(
    'SELECT * FROM trade_tags WHERE trade_id = ?'
  ).all(id) as Record<string, unknown>[];
  trade.tags = tagRows.map(rowToTradeTag);

  const reflectionRows = db.prepare(
    'SELECT * FROM reflections WHERE trade_id = ? ORDER BY created_at DESC'
  ).all(id) as Record<string, unknown>[];
  trade.reflections = reflectionRows.map(rowToReflection);

  return trade;
}

/**
 * Find the underlying price at a given timestamp from chart snapshot bars.
 */
export function findUnderlyingPrice(tradeId: string, underlying: string, targetTime: string): number | null {
  const snapshot = db.prepare(
    "SELECT bars FROM chart_snapshots WHERE trade_id = ? AND symbol = ? AND symbol_type = 'underlying'"
  ).get(tradeId, underlying.toUpperCase()) as { bars: string } | undefined;

  if (!snapshot) return null;

  const bars = JSON.parse(snapshot.bars) as { t: number; c: number }[];
  if (bars.length === 0) return null;

  const target = new Date(targetTime).getTime() / 1000;

  let closest = bars[0];
  let minDiff = Math.abs(bars[0].t - target);
  for (const bar of bars) {
    const diff = Math.abs(bar.t - target);
    if (diff < minDiff) {
      closest = bar;
      minDiff = diff;
    }
  }

  return closest.c;
}

/**
 * Capture snapshots and backfill underlying prices on all legs of a trade.
 * Used after date changes in update_trade and close_trade.
 */
export async function backfillLegUnderlyingPrices(tradeId: string): Promise<void> {
  const trade = getTradeWithDetails(tradeId);
  if (!trade || !trade.underlying) return;

  // Capture snapshots for all relevant dates
  const dates: string[] = [];
  if (trade.openDate) dates.push(trade.openDate.slice(0, 10));
  if (trade.closeDate) dates.push(trade.closeDate.slice(0, 10));
  for (const d of [...new Set(dates)]) {
    await captureSnapshotsForTrade(tradeId, d);
  }

  // Backfill underlying prices from snapshot bars
  const entryUnderlying = trade.openDate ? findUnderlyingPrice(tradeId, trade.underlying, trade.openDate) : null;
  const exitUnderlying = trade.closeDate ? findUnderlyingPrice(tradeId, trade.underlying, trade.closeDate) : null;

  if (entryUnderlying !== null || exitUnderlying !== null) {
    const updateLeg = db.prepare(
      'UPDATE trade_legs SET entry_underlying_price = COALESCE(?, entry_underlying_price), exit_underlying_price = COALESCE(?, exit_underlying_price) WHERE trade_id = ?'
    );
    updateLeg.run(entryUnderlying, exitUnderlying, tradeId);
  }
}
