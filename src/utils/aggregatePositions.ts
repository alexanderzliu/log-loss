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

export interface GroupedTrades {
  symbol: string;
  assetType: AssetType;
  trades: Trade[];
  openCount: number;
  closedCount: number;
  totalValue: number;
  totalPnl: number | null;
}

/**
 * Group all trades by symbol + assetType for Journal grouped view.
 * Unlike aggregatePositions, this includes all trades (open, closed, buy, sell).
 */
export function groupTradesByAsset(trades: Trade[]): GroupedTrades[] {
  const grouped = new Map<string, Trade[]>();

  for (const trade of trades) {
    const key = `${trade.symbol}-${trade.assetType}`;
    const existing = grouped.get(key) || [];
    existing.push(trade);
    grouped.set(key, existing);
  }

  const result: GroupedTrades[] = [];
  for (const [, groupTrades] of grouped) {
    const first = groupTrades[0];

    // Sort by entry date descending (most recent first)
    const sortedTrades = groupTrades.sort(
      (a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()
    );

    const openCount = groupTrades.filter(t => t.status === 'open').length;
    const closedCount = groupTrades.filter(t => t.status === 'closed').length;

    // Calculate total value (entry price * quantity for all trades)
    const totalValue = groupTrades.reduce(
      (sum, t) => sum + t.entryPrice * t.quantity,
      0
    );

    // Sum up realized P&L from closed trades
    const closedTrades = groupTrades.filter(t => t.status === 'closed' && t.pnl !== null);
    const totalPnl = closedTrades.length > 0
      ? closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
      : null;

    result.push({
      symbol: first.symbol,
      assetType: first.assetType,
      trades: sortedTrades,
      openCount,
      closedCount,
      totalValue,
      totalPnl,
    });
  }

  // Sort by total value descending
  return result.sort((a, b) => b.totalValue - a.totalValue);
}
