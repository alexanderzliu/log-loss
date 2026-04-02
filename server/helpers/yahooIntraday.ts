import type { OhlcvBar } from '../../shared/types.ts';

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const REQUEST_DELAY_MS = 2000;

export interface YahooIntradayResult {
  symbol: string;
  bars: OhlcvBar[];
  tradingDate: string;
}

/**
 * Build a Yahoo Finance OCC-format option ticker from components.
 * Format: ROOT + YYMMDD + C/P + 8-digit strike (strike * 1000, zero-padded)
 * Example: buildOccTicker('SPY', '2026-03-31', 'put', 650) => 'SPY260331P00650000'
 */
export function buildOccTicker(
  underlying: string,
  expiration: string,
  optionType: 'call' | 'put',
  strike: number,
): string {
  // expiration is YYYY-MM-DD, need YYMMDD
  const dateStr = expiration.replace(/-/g, '').slice(2); // '20260331' -> '260331'
  const typeChar = optionType === 'call' ? 'C' : 'P';
  const strikeInt = Math.round(strike * 1000);
  const strikePadded = String(strikeInt).padStart(8, '0');
  return `${underlying.toUpperCase()}${dateStr}${typeChar}${strikePadded}`;
}

/**
 * Forward-fill null bars by carrying the previous bar's close.
 * Null bars get volume=0 so they don't affect VWAP or volume-weighted calculations.
 */
export function forwardFillBars(bars: (OhlcvBar | null)[], timestamps: number[]): OhlcvBar[] {
  const filled: OhlcvBar[] = [];
  let lastClose: number | null = null;

  for (let i = 0; i < timestamps.length; i++) {
    const bar = bars[i];
    if (bar && bar.c !== null && bar.c !== undefined) {
      filled.push(bar);
      lastClose = bar.c;
    } else if (lastClose !== null) {
      filled.push({
        t: timestamps[i],
        o: lastClose,
        h: lastClose,
        l: lastClose,
        c: lastClose,
        v: 0,
      });
    }
    // Skip bars before we have any valid price data
  }

  return filled;
}

/**
 * Fetch 1-min intraday bars from Yahoo Finance for a single symbol.
 * If date is provided and is in the past, fetches 7d range and filters to target date.
 */
export async function fetchIntradayBars(
  symbol: string,
  date?: string,
): Promise<YahooIntradayResult | null> {
  try {
    // Determine range: if date is today or not provided, use 1d. Otherwise use 7d and filter.
    const today = new Date().toISOString().slice(0, 10);
    const targetDate = date || today;
    const isToday = targetDate === today;
    const range = isToday ? '1d' : '7d';

    const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?interval=1m&range=${range}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!response.ok) {
      console.error(`Yahoo Finance returned ${response.status} for ${symbol}`);
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await response.json() as any;
    const result = data.chart?.result?.[0];

    if (!result || !result.timestamp) {
      return null;
    }

    const timestamps: number[] = result.timestamp;
    const quote = result.indicators?.quote?.[0];
    if (!quote) return null;

    const opens: (number | null)[] = quote.open;
    const highs: (number | null)[] = quote.high;
    const lows: (number | null)[] = quote.low;
    const closes: (number | null)[] = quote.close;
    const volumes: (number | null)[] = quote.volume;

    // Build raw bars (some may be null for options)
    const rawBars: (OhlcvBar | null)[] = timestamps.map((t, i) => {
      if (closes[i] === null || closes[i] === undefined) return null;
      return {
        t,
        o: opens[i] ?? closes[i]!,
        h: highs[i] ?? closes[i]!,
        l: lows[i] ?? closes[i]!,
        c: closes[i]!,
        v: volumes[i] ?? 0,
      };
    });

    // Filter to target date if we fetched a multi-day range
    let filteredBars: (OhlcvBar | null)[] = rawBars;
    let filteredTimestamps: number[] = timestamps;

    if (!isToday && targetDate) {
      const targetStart = new Date(targetDate + 'T00:00:00').getTime() / 1000;
      const targetEnd = new Date(targetDate + 'T23:59:59').getTime() / 1000;

      const indices = timestamps
        .map((t, i) => (t >= targetStart && t <= targetEnd ? i : -1))
        .filter((i) => i !== -1);

      if (indices.length === 0) {
        console.error(`No bars found for ${symbol} on ${targetDate}`);
        return null;
      }

      filteredBars = indices.map((i) => rawBars[i]);
      filteredTimestamps = indices.map((i) => timestamps[i]);
    }

    const bars = forwardFillBars(filteredBars, filteredTimestamps);

    if (bars.length === 0) return null;

    // Determine the trading date from the first bar
    const tradingDate = new Date(bars[0].t * 1000).toISOString().slice(0, 10);

    return { symbol, bars, tradingDate };
  } catch (error) {
    console.error(`Error fetching intraday bars for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch intraday bars for multiple symbols sequentially with rate limiting.
 */
export async function fetchMultipleIntraday(
  symbols: string[],
  date?: string,
): Promise<Map<string, YahooIntradayResult>> {
  const results = new Map<string, YahooIntradayResult>();

  for (let i = 0; i < symbols.length; i++) {
    // Rate limit: wait between requests (skip delay for first request)
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
    }

    const result = await fetchIntradayBars(symbols[i], date);
    if (result) {
      results.set(symbols[i], result);
    }
  }

  return results;
}
