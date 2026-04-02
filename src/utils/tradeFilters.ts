import type { Trade, TradeLeg } from '../types';

export type DerivedOptionType = 'call' | 'put' | 'mixed' | null;

/**
 * Derive the option type for a trade from its legs.
 * - All option legs are calls → 'call'
 * - All option legs are puts → 'put'
 * - Mix of calls and puts → 'mixed'
 * - No option legs (stock/futures) → null
 */
export function getDerivedOptionType(legs: TradeLeg[]): DerivedOptionType {
  const optionLegs = legs.filter((leg) => leg.optionType !== null);
  if (optionLegs.length === 0) return null;

  const allCalls = optionLegs.every((leg) => leg.optionType === 'call');
  if (allCalls) return 'call';

  const allPuts = optionLegs.every((leg) => leg.optionType === 'put');
  if (allPuts) return 'put';

  return 'mixed';
}

/**
 * Extract the YYYY-MM-DD date for a trade (openDate, falling back to createdAt).
 */
export function getTradeDate(trade: Trade): string {
  return (trade.openDate ?? trade.createdAt).slice(0, 10);
}

/**
 * Check if a YYYY-MM-DD date string falls within an inclusive [from, to] range.
 * Either bound can be null (unbounded).
 */
export function isDateInRange(
  dateStr: string,
  from: string | null,
  to: string | null,
): boolean {
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}
