import { differenceInCalendarDays } from 'date-fns';
import type { TradeLeg } from '../types';

/**
 * Compute days to expiration from a date string (YYYY-MM-DD).
 * Uses calendar-day difference (not 24-hour periods) to avoid DST issues.
 * Returns null if expiration is null/undefined or unparseable.
 * Returns 0 if expiration is today. Negative values mean expired.
 */
export function getDTE(expiration: string | null): number | null {
  if (!expiration) return null;
  const expDate = new Date(expiration + 'T16:00:00'); // 4 PM market close
  if (isNaN(expDate.getTime())) return null;
  return differenceInCalendarDays(expDate, new Date());
}

/**
 * Find the earliest expiration across all legs with a non-null expiration.
 */
export function getEarliestExpiration(legs: TradeLeg[]): string | null {
  let earliest: string | null = null;
  for (const leg of legs) {
    if (leg.expiration && (!earliest || leg.expiration < earliest)) {
      earliest = leg.expiration;
    }
  }
  return earliest;
}
