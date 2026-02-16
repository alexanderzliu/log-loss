import { Router } from 'express';
import { db } from '../database';
import { fetchDexScreenerFullMetrics } from './prices';
import type {
  LifecycleStage,
  TimeframeData,
  DexScreenerMetrics,
  ComputedMetrics,
  TokenMetrics,
  MomentumSummary,
  DerivativeWindow,
  DerivativeChange,
  DerivativesResult,
  SnapshotHistoryPoint,
} from '../../shared/types';

const router = Router();

const CACHE_EXPIRY_MINUTES = 5;

// --- Lifecycle classification ---

function classifyLifecycle(pairCreatedAt: number | null): LifecycleStage {
  if (!pairCreatedAt) return 'established';
  const ageMs = Date.now() - pairCreatedAt;
  const ageHours = ageMs / (1000 * 60 * 60);
  if (ageHours < 1) return 'launch';
  if (ageHours < 24) return 'discovery';
  if (ageHours < 24 * 7) return 'momentum';
  return 'established';
}

// --- Computed metrics ---

function safeDivide(a: number, b: number): number {
  return b !== 0 ? a / b : 0;
}

function hasVolumeSplit(raw: DexScreenerMetrics): boolean {
  // Check if DexScreener actually returned volumeBuy/volumeSell data
  // (not just zero-filled defaults from extraction)
  return (raw.volumeBuy.h24 > 0 || raw.volumeSell.h24 > 0);
}

function computeMetrics(raw: DexScreenerMetrics): ComputedMetrics {
  const tfCalc = (fn: (tf: 'm5' | 'h1' | 'h6' | 'h24') => number): TimeframeData => ({
    m5: fn('m5'),
    h1: fn('h1'),
    h6: fn('h6'),
    h24: fn('h24'),
  });

  const volumeSplitAvailable = hasVolumeSplit(raw);

  return {
    // Buy pressure: prefer volumeBuy/volumeSell if available,
    // otherwise fall back to txn count ratio (buys / total txns)
    buyPressure: volumeSplitAvailable
      ? tfCalc(tf => safeDivide(raw.volumeBuy[tf], raw.volumeBuy[tf] + raw.volumeSell[tf]))
      : tfCalc(tf => safeDivide(raw.txns[tf].buys, raw.txns[tf].buys + raw.txns[tf].sells)),

    // Avg buy/sell size: when no volume split, estimate from total volume + txn counts
    avgBuySize: volumeSplitAvailable
      ? tfCalc(tf => safeDivide(raw.volumeBuy[tf], raw.buyers[tf]))
      : tfCalc(tf => safeDivide(raw.volume[tf], raw.txns[tf].buys + raw.txns[tf].sells)),
    avgSellSize: volumeSplitAvailable
      ? tfCalc(tf => safeDivide(raw.volumeSell[tf], raw.sellers[tf]))
      : tfCalc(tf => safeDivide(raw.volume[tf], raw.txns[tf].buys + raw.txns[tf].sells)),

    // Volume acceleration: (5m volume annualized to 1h) / actual 1h volume
    volumeAcceleration: raw.volume.h1 > 0
      ? (raw.volume.m5 * 12) / raw.volume.h1
      : 0,

    // Buyer/seller ratio: prefer unique wallet counts if available,
    // otherwise use txn counts
    buyerSellerRatio: (raw.buyers.h24 > 0 || raw.sellers.h24 > 0)
      ? tfCalc(tf => safeDivide(raw.buyers[tf], raw.sellers[tf]))
      : tfCalc(tf => safeDivide(raw.txns[tf].buys, raw.txns[tf].sells)),
  };
}

// --- Cache helpers ---

interface TokenMetricsRow {
  chain: string;
  contract_address: string;
  price: number | null;
  volume_24h: number | null;
  volume_buy_24h: number | null;
  volume_sell_24h: number | null;
  buys_24h: number | null;
  sells_24h: number | null;
  buyers_24h: number | null;
  sellers_24h: number | null;
  liquidity_usd: number | null;
  market_cap: number | null;
  fdv: number | null;
  pair_created_at: number | null;
  pair_address: string | null;
  dex_id: string | null;
  raw_metrics: string;
  updated_at: string;
}

function getCachedMetrics(chain: string, contractAddress: string): TokenMetricsRow | undefined {
  return db.prepare(`
    SELECT * FROM token_metrics
    WHERE chain = ? AND contract_address = ?
    AND datetime(updated_at) > datetime('now', '-' || ? || ' minutes')
  `).get(chain, contractAddress, CACHE_EXPIRY_MINUTES) as TokenMetricsRow | undefined;
}

function cacheMetrics(
  chain: string,
  contractAddress: string,
  raw: DexScreenerMetrics,
  price: number,
  marketCap: number | null,
  fdv: number | null,
): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO token_metrics
    (chain, contract_address, price, volume_24h, volume_buy_24h, volume_sell_24h,
     buys_24h, sells_24h, buyers_24h, sellers_24h, liquidity_usd, market_cap, fdv,
     pair_created_at, pair_address, dex_id, raw_metrics, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    chain,
    contractAddress,
    price,
    raw.volume.h24,
    raw.volumeBuy.h24,
    raw.volumeSell.h24,
    raw.txns.h24.buys,
    raw.txns.h24.sells,
    raw.buyers.h24,
    raw.sellers.h24,
    raw.liquidity.usd,
    marketCap,
    fdv,
    raw.pairCreatedAt,
    raw.pairAddress,
    raw.dexId,
    JSON.stringify(raw),
    now,
    now,
  );
}

function rowToTokenMetrics(row: TokenMetricsRow): TokenMetrics {
  const raw: DexScreenerMetrics = JSON.parse(row.raw_metrics);
  const computed = computeMetrics(raw);
  const lifecycleStage = classifyLifecycle(row.pair_created_at);

  return {
    chain: row.chain,
    contractAddress: row.contract_address,
    price: row.price ?? 0,
    volume24h: row.volume_24h ?? 0,
    volumeBuy24h: row.volume_buy_24h ?? 0,
    volumeSell24h: row.volume_sell_24h ?? 0,
    buys24h: row.buys_24h ?? 0,
    sells24h: row.sells_24h ?? 0,
    buyers24h: row.buyers_24h ?? 0,
    sellers24h: row.sellers_24h ?? 0,
    liquidityUsd: row.liquidity_usd ?? 0,
    marketCap: row.market_cap,
    fdv: row.fdv,
    pairCreatedAt: row.pair_created_at,
    pairAddress: row.pair_address,
    dexId: row.dex_id,
    lifecycleStage,
    raw,
    computed,
    updatedAt: row.updated_at,
  };
}

// --- Fetch or get from cache ---

async function getTokenMetrics(chain: string, contractAddress: string): Promise<TokenMetrics | null> {
  // Check cache first
  const cached = getCachedMetrics(chain, contractAddress);
  if (cached) {
    return rowToTokenMetrics(cached);
  }

  // Fetch fresh data from DexScreener
  const result = await fetchDexScreenerFullMetrics(chain, contractAddress);
  if (!result) return null;

  // Cache the metrics
  cacheMetrics(
    chain,
    contractAddress,
    result.metrics,
    result.priceData.price,
    result.marketCap,
    result.fdv,
  );

  // Build response
  const computed = computeMetrics(result.metrics);
  const lifecycleStage = classifyLifecycle(result.metrics.pairCreatedAt);

  return {
    chain,
    contractAddress,
    price: result.priceData.price,
    volume24h: result.metrics.volume.h24,
    volumeBuy24h: result.metrics.volumeBuy.h24,
    volumeSell24h: result.metrics.volumeSell.h24,
    buys24h: result.metrics.txns.h24.buys,
    sells24h: result.metrics.txns.h24.sells,
    buyers24h: result.metrics.buyers.h24,
    sellers24h: result.metrics.sellers.h24,
    liquidityUsd: result.metrics.liquidity.usd,
    marketCap: result.marketCap,
    fdv: result.fdv,
    pairCreatedAt: result.metrics.pairCreatedAt,
    pairAddress: result.metrics.pairAddress,
    dexId: result.metrics.dexId,
    lifecycleStage,
    raw: result.metrics,
    computed,
    updatedAt: new Date().toISOString(),
  };
}

// --- Routes ---

// GET /api/metrics/:chain/:address — full token metrics with computed fields
router.get('/:chain/:address', async (req, res) => {
  try {
    const { chain, address } = req.params;
    if (!chain || !address) {
      return res.status(400).json({ error: 'chain and address are required' });
    }

    const metrics = await getTokenMetrics(chain, address);
    if (!metrics) {
      return res.status(404).json({ error: 'Token metrics not found' });
    }

    res.json(metrics);
  } catch (error) {
    console.error('Error fetching token metrics:', error);
    res.status(500).json({ error: 'Failed to fetch token metrics' });
  }
});

// GET /api/metrics/:chain/:address/momentum — momentum summary
router.get('/:chain/:address/momentum', async (req, res) => {
  try {
    const { chain, address } = req.params;
    if (!chain || !address) {
      return res.status(400).json({ error: 'chain and address are required' });
    }

    const metrics = await getTokenMetrics(chain, address);
    if (!metrics) {
      return res.status(404).json({ error: 'Token metrics not found' });
    }

    const summary: MomentumSummary = {
      chain: metrics.chain,
      contractAddress: metrics.contractAddress,
      lifecycleStage: metrics.lifecycleStage,
      buyPressure: metrics.computed.buyPressure,
      volumeAcceleration: metrics.computed.volumeAcceleration,
      buyerSellerRatio: metrics.computed.buyerSellerRatio,
      priceChange: metrics.raw.priceChange,
      volume: metrics.raw.volume,
    };

    res.json(summary);
  } catch (error) {
    console.error('Error fetching momentum summary:', error);
    res.status(500).json({ error: 'Failed to fetch momentum summary' });
  }
});

// --- Derivative helpers ---

const WINDOW_MINUTES: Record<DerivativeWindow, number> = {
  '30m': 30,
  '1h': 60,
  '6h': 360,
  '24h': 1440,
};

interface SnapshotRow {
  captured_at: string;
  price: number | null;
  volume_24h: number | null;
  liquidity_usd: number | null;
  holder_count: number | null;
  buy_pressure: number | null;
  market_cap: number | null;
}

function computeChange(current: number | null, previous: number | null): DerivativeChange {
  if (current === null || previous === null) {
    return { absolute: null, percent: null };
  }
  const absolute = current - previous;
  const percent = previous !== 0 ? (absolute / Math.abs(previous)) * 100 : null;
  return { absolute, percent };
}

// GET /api/metrics/:chain/:address/derivatives?window=1h
router.get('/:chain/:address/derivatives', (req, res) => {
  try {
    const { chain, address } = req.params;
    const windowParam = (req.query.window as string) || '1h';

    if (!chain || !address) {
      return res.status(400).json({ error: 'chain and address are required' });
    }

    const validWindows: DerivativeWindow[] = ['30m', '1h', '6h', '24h'];
    if (!validWindows.includes(windowParam as DerivativeWindow)) {
      return res.status(400).json({ error: `window must be one of: ${validWindows.join(', ')}` });
    }

    const window = windowParam as DerivativeWindow;
    const minutes = WINDOW_MINUTES[window];

    // Get the most recent snapshot (current)
    const current = db.prepare(`
      SELECT captured_at, price, volume_24h, liquidity_usd, holder_count, buy_pressure, market_cap
      FROM token_snapshots
      WHERE chain = ? AND contract_address = ?
      ORDER BY captured_at DESC
      LIMIT 1
    `).get(chain, address) as SnapshotRow | undefined;

    if (!current) {
      return res.json({
        chain,
        contractAddress: address,
        window,
        from: null,
        to: null,
        changes: {
          price: { absolute: null, percent: null },
          volume24h: { absolute: null, percent: null },
          liquidityUsd: { absolute: null, percent: null },
          holderCount: { absolute: null, percent: null },
          buyPressure: { absolute: null, percent: null },
          marketCap: { absolute: null, percent: null },
        },
      } satisfies DerivativesResult);
    }

    // Get the snapshot closest to `window` minutes ago
    const historical = db.prepare(`
      SELECT captured_at, price, volume_24h, liquidity_usd, holder_count, buy_pressure, market_cap
      FROM token_snapshots
      WHERE chain = ? AND contract_address = ?
        AND datetime(captured_at) <= datetime(?, '-' || ? || ' minutes')
      ORDER BY captured_at DESC
      LIMIT 1
    `).get(chain, address, current.captured_at, minutes) as SnapshotRow | undefined;

    const result: DerivativesResult = {
      chain,
      contractAddress: address,
      window,
      from: historical?.captured_at ?? null,
      to: current.captured_at,
      changes: {
        price: computeChange(current.price, historical?.price ?? null),
        volume24h: computeChange(current.volume_24h, historical?.volume_24h ?? null),
        liquidityUsd: computeChange(current.liquidity_usd, historical?.liquidity_usd ?? null),
        holderCount: computeChange(current.holder_count, historical?.holder_count ?? null),
        buyPressure: computeChange(current.buy_pressure, historical?.buy_pressure ?? null),
        marketCap: computeChange(current.market_cap, historical?.market_cap ?? null),
      },
    };

    res.json(result);
  } catch (error) {
    console.error('Error computing derivatives:', error);
    res.status(500).json({ error: 'Failed to compute derivatives' });
  }
});

// GET /api/metrics/:chain/:address/history?hours=24
router.get('/:chain/:address/history', (req, res) => {
  try {
    const { chain, address } = req.params;
    const hoursParam = parseInt(req.query.hours as string) || 24;

    if (!chain || !address) {
      return res.status(400).json({ error: 'chain and address are required' });
    }

    // Clamp hours between 1 and 168 (7 days)
    const hours = Math.max(1, Math.min(168, hoursParam));

    const rows = db.prepare(`
      SELECT captured_at, price, volume_24h, liquidity_usd, buy_pressure, market_cap, holder_count
      FROM token_snapshots
      WHERE chain = ? AND contract_address = ?
        AND datetime(captured_at) >= datetime('now', '-' || ? || ' hours')
      ORDER BY captured_at ASC
    `).all(chain, address, hours) as SnapshotRow[];

    const history: SnapshotHistoryPoint[] = rows.map(row => ({
      capturedAt: row.captured_at,
      price: row.price,
      volume24h: row.volume_24h,
      liquidityUsd: row.liquidity_usd,
      buyPressure: row.buy_pressure,
      marketCap: row.market_cap,
      holderCount: row.holder_count,
    }));

    res.json({
      chain,
      contractAddress: address,
      hours,
      snapshots: history,
    });
  } catch (error) {
    console.error('Error fetching snapshot history:', error);
    res.status(500).json({ error: 'Failed to fetch snapshot history' });
  }
});

export default router;
