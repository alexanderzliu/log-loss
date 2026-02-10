import type { Position } from '../types';

/**
 * Calculate unrealized P&L for a position based on current price.
 */
export function calculateUnrealizedPnl(
  position: Position,
  currentPrice: number | undefined
): { pnl: number | null; pnlPercent: number | null } {
  if (!currentPrice || position.remainingQuantity <= 0) {
    return { pnl: null, pnlPercent: null };
  }

  const currentValue = currentPrice * position.remainingQuantity;
  const costBasis = position.avgEntryPrice * position.remainingQuantity;
  const pnl = currentValue - costBasis;
  const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
  return { pnl, pnlPercent };
}
