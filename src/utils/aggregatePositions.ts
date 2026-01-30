import type { Trade, AssetType } from '../types';

export interface AggregatedPosition {
  symbol: string;
  assetType: AssetType;
  totalQuantity: number;
  avgEntryPrice: number;
  totalCostBasis: number;
  lotCount: number;
  lots: Trade[];
}

/**
 * Get the effective remaining quantity for a trade.
 * Falls back to quantity if remainingQuantity is not set (for legacy data).
 */
function getEffectiveQuantity(trade: Trade): number {
  return trade.remainingQuantity ?? trade.quantity;
}

/**
 * Aggregate open buy positions by symbol + assetType.
 * Computes weighted average entry price and total quantity.
 * Uses remainingQuantity to account for partial exits.
 */
export function aggregatePositions(trades: Trade[]): AggregatedPosition[] {
  const openBuys = trades.filter((t) => t.status === 'open' && t.side === 'buy');

  // Group by symbol + assetType
  const grouped = new Map<string, Trade[]>();
  for (const trade of openBuys) {
    const key = `${trade.symbol}-${trade.assetType}`;
    const existing = grouped.get(key) || [];
    existing.push(trade);
    grouped.set(key, existing);
  }

  // Compute aggregates using remainingQuantity
  const aggregated: AggregatedPosition[] = [];
  for (const [, lots] of grouped) {
    const first = lots[0];

    // Use remainingQuantity to get accurate totals after partial exits
    const totalQuantity = lots.reduce((sum, t) => sum + getEffectiveQuantity(t), 0);
    const totalCostBasis = lots.reduce((sum, t) => sum + t.entryPrice * getEffectiveQuantity(t), 0);
    const avgEntryPrice = totalQuantity > 0 ? totalCostBasis / totalQuantity : 0;

    aggregated.push({
      symbol: first.symbol,
      assetType: first.assetType,
      totalQuantity,
      avgEntryPrice,
      totalCostBasis,
      lotCount: lots.length,
      lots: lots.sort((a, b) =>
        new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
      ),
    });
  }

  // Sort by total value descending
  return aggregated.sort((a, b) => b.totalCostBasis - a.totalCostBasis);
}

/**
 * Calculate aggregated P&L for a position
 */
export function calculateAggregatedPnl(
  position: AggregatedPosition,
  currentPrice: number | undefined
): { pnl: number | null; pnlPercent: number | null } {
  if (!currentPrice) {
    return { pnl: null, pnlPercent: null };
  }

  const currentValue = currentPrice * position.totalQuantity;
  const pnl = currentValue - position.totalCostBasis;
  const pnlPercent = position.totalCostBasis > 0
    ? (pnl / position.totalCostBasis) * 100
    : 0;

  return { pnl, pnlPercent };
}
