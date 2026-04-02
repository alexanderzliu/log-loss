import type { OhlcvBar, VwapPoint, VolumeProfileBin, ComputedIndicators } from '../../shared/types.ts';

/**
 * Compute VWAP with ±1/2/3 standard deviation bands from OHLCV bars.
 * VWAP = cumulative(typical_price * volume) / cumulative(volume)
 * SD bands use rolling volume-weighted variance.
 */
export function computeVwap(bars: OhlcvBar[]): VwapPoint[] {
  const points: VwapPoint[] = [];
  let cumulativeTPV = 0;  // cumulative (typical_price * volume)
  let cumulativeVol = 0;   // cumulative volume
  let cumulativeTPV2 = 0;  // cumulative (typical_price^2 * volume) for variance

  for (const bar of bars) {
    if (bar.v === 0) {
      // Zero-volume bar (forward-filled): use previous VWAP value
      if (points.length > 0) {
        const prev = points[points.length - 1];
        points.push({ ...prev, t: bar.t });
      }
      continue;
    }

    const tp = (bar.h + bar.l + bar.c) / 3;
    cumulativeTPV += tp * bar.v;
    cumulativeVol += bar.v;
    cumulativeTPV2 += tp * tp * bar.v;

    const vwap = cumulativeTPV / cumulativeVol;
    // Volume-weighted variance: E[X^2] - E[X]^2
    const variance = (cumulativeTPV2 / cumulativeVol) - (vwap * vwap);
    const sd = Math.sqrt(Math.max(0, variance));

    points.push({
      t: bar.t,
      vwap,
      upperBand1: vwap + sd,
      lowerBand1: vwap - sd,
      upperBand2: vwap + 2 * sd,
      lowerBand2: vwap - 2 * sd,
      upperBand3: vwap + 3 * sd,
      lowerBand3: vwap - 3 * sd,
    });
  }

  return points;
}

/**
 * Compute volume profile: distribute volume across price bins.
 * Returns bins, POC (point of control), and value area (70% of volume).
 */
export function computeVolumeProfile(
  bars: OhlcvBar[],
  binCount: number = 50,
): { bins: VolumeProfileBin[]; poc: number; valueAreaHigh: number; valueAreaLow: number } {
  if (bars.length === 0) {
    return { bins: [], poc: 0, valueAreaHigh: 0, valueAreaLow: 0 };
  }

  // Find price range
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  for (const bar of bars) {
    if (bar.l < minPrice) minPrice = bar.l;
    if (bar.h > maxPrice) maxPrice = bar.h;
  }

  if (minPrice === maxPrice) {
    return {
      bins: [{ price: minPrice, volume: bars.reduce((s, b) => s + b.v, 0), buyVolume: 0, sellVolume: 0 }],
      poc: minPrice,
      valueAreaHigh: minPrice,
      valueAreaLow: minPrice,
    };
  }

  const binSize = (maxPrice - minPrice) / binCount;
  const bins: VolumeProfileBin[] = Array.from({ length: binCount }, (_, i) => ({
    price: minPrice + (i + 0.5) * binSize,
    volume: 0,
    buyVolume: 0,
    sellVolume: 0,
  }));

  // Distribute each bar's volume across bins it touches
  for (const bar of bars) {
    if (bar.v === 0) continue;

    const lowBin = Math.max(0, Math.floor((bar.l - minPrice) / binSize));
    const highBin = Math.min(binCount - 1, Math.floor((bar.h - minPrice) / binSize));
    const binsInRange = highBin - lowBin + 1;
    const volPerBin = bar.v / binsInRange;

    // Approximate buy/sell: close > open = buy pressure, else sell
    const isBuy = bar.c >= bar.o;

    for (let i = lowBin; i <= highBin; i++) {
      bins[i].volume += volPerBin;
      if (isBuy) {
        bins[i].buyVolume += volPerBin;
      } else {
        bins[i].sellVolume += volPerBin;
      }
    }
  }

  // Find POC (bin with highest volume)
  let pocIdx = 0;
  let maxVol = 0;
  for (let i = 0; i < bins.length; i++) {
    if (bins[i].volume > maxVol) {
      maxVol = bins[i].volume;
      pocIdx = i;
    }
  }

  // Value area: expand from POC until 70% of total volume is captured
  const totalVol = bins.reduce((s, b) => s + b.volume, 0);
  const targetVol = totalVol * 0.7;
  let vaLow = pocIdx;
  let vaHigh = pocIdx;
  let capturedVol = bins[pocIdx].volume;

  while (capturedVol < targetVol && (vaLow > 0 || vaHigh < bins.length - 1)) {
    const lowVol = vaLow > 0 ? bins[vaLow - 1].volume : 0;
    const highVol = vaHigh < bins.length - 1 ? bins[vaHigh + 1].volume : 0;

    if (lowVol >= highVol && vaLow > 0) {
      vaLow--;
      capturedVol += bins[vaLow].volume;
    } else if (vaHigh < bins.length - 1) {
      vaHigh++;
      capturedVol += bins[vaHigh].volume;
    } else {
      vaLow--;
      capturedVol += bins[vaLow].volume;
    }
  }

  return {
    bins: bins.filter((b) => b.volume > 0),
    poc: bins[pocIdx].price,
    valueAreaHigh: bins[vaHigh].price,
    valueAreaLow: bins[vaLow].price,
  };
}

/**
 * Compute all indicators for a set of bars.
 */
export function computeIndicators(bars: OhlcvBar[]): ComputedIndicators {
  const vwap = computeVwap(bars);
  const { bins, poc, valueAreaHigh, valueAreaLow } = computeVolumeProfile(bars);

  return {
    vwap,
    volumeProfile: bins,
    poc,
    valueAreaHigh,
    valueAreaLow,
  };
}

// --- Black-Scholes (theoretical fallback) ---

function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);
  return 0.5 * (1.0 + sign * y);
}

/**
 * Black-Scholes option pricing.
 * @param S Underlying price
 * @param K Strike price
 * @param T Time to expiry in years
 * @param iv Implied volatility (decimal, e.g. 0.35 for 35%)
 * @param optionType 'call' or 'put'
 * @param r Risk-free rate (default 0.05)
 */
export function computeTheoreticalOptionPrice(
  S: number,
  K: number,
  T: number,
  iv: number,
  optionType: 'call' | 'put',
  r: number = 0.05,
): number {
  if (T <= 0) {
    // At or past expiration
    return optionType === 'call' ? Math.max(0, S - K) : Math.max(0, K - S);
  }

  const d1 = (Math.log(S / K) + (r + iv * iv / 2) * T) / (iv * Math.sqrt(T));
  const d2 = d1 - iv * Math.sqrt(T);

  if (optionType === 'call') {
    return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
  } else {
    return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
  }
}

/**
 * Generate theoretical option OHLCV bars from underlying bars + Black-Scholes.
 * Uses static IV from entry (approximation — real IV changes intraday).
 */
export function generateTheoreticalBars(
  underlyingBars: OhlcvBar[],
  strike: number,
  expiration: string,
  optionType: 'call' | 'put',
  iv: number,
): OhlcvBar[] {
  const expiryTime = new Date(expiration + 'T16:00:00').getTime() / 1000; // 4 PM ET

  return underlyingBars.map((bar) => {
    const T = Math.max(0, (expiryTime - bar.t) / (365.25 * 24 * 3600));

    const priceO = computeTheoreticalOptionPrice(bar.o, strike, T, iv, optionType);
    const priceH = computeTheoreticalOptionPrice(bar.h, strike, T, iv, optionType);
    const priceL = computeTheoreticalOptionPrice(bar.l, strike, T, iv, optionType);
    const priceC = computeTheoreticalOptionPrice(bar.c, strike, T, iv, optionType);

    // For puts, high underlying = low option price, so swap
    const prices = [priceO, priceH, priceL, priceC];
    const high = Math.max(...prices);
    const low = Math.min(...prices);

    return {
      t: bar.t,
      o: Math.round(priceO * 100) / 100,
      h: Math.round(high * 100) / 100,
      l: Math.round(low * 100) / 100,
      c: Math.round(priceC * 100) / 100,
      v: bar.v, // Use underlying volume as proxy
    };
  });
}
