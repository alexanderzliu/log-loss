import { Router } from 'express';
import { db } from '../database';

const router = Router();

const CACHE_EXPIRY_MINUTES = 5;

interface PriceData {
  price: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

// --- Cache helpers ---

function getCachedPrice(symbol: string, assetType: string): Record<string, unknown> | undefined {
  return db.prepare(`
    SELECT * FROM price_cache
    WHERE symbol = ? AND asset_type = ?
    AND datetime(last_updated) > datetime('now', '-' || ? || ' minutes')
  `).get(symbol, assetType, CACHE_EXPIRY_MINUTES) as Record<string, unknown> | undefined;
}

function cachePriceData(symbol: string, assetType: string, priceData: PriceData): string {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO price_cache
    (symbol, asset_type, price, change_24h, change_percent_24h, high_24h, low_24h, volume_24h, last_updated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    symbol,
    assetType,
    priceData.price,
    priceData.change24h,
    priceData.changePercent24h,
    priceData.high24h,
    priceData.low24h,
    priceData.volume24h,
    now
  );
  return now;
}

function formatCachedPrice(cached: Record<string, unknown>, symbol: string, assetType: string) {
  return {
    symbol,
    assetType,
    price: cached.price as number,
    change24h: cached.change_24h as number,
    changePercent24h: cached.change_percent_24h as number,
    high24h: cached.high_24h as number,
    low24h: cached.low_24h as number,
    volume24h: cached.volume_24h as number,
    lastUpdated: cached.last_updated as string,
  };
}

// --- Yahoo Finance ---

async function fetchStockPrice(symbol: string): Promise<PriceData | null> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}?interval=1d&range=1d`
    );

    if (!response.ok) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await response.json() as any;
    const quote = data.chart?.result?.[0]?.meta;
    const indicators = data.chart?.result?.[0]?.indicators?.quote?.[0];

    if (!quote) return null;

    const currentPrice = quote.regularMarketPrice;
    const previousClose = quote.previousClose || currentPrice;

    return {
      price: currentPrice,
      change24h: currentPrice - previousClose,
      changePercent24h: ((currentPrice - previousClose) / previousClose) * 100,
      high24h: indicators?.high?.[0] || currentPrice,
      low24h: indicators?.low?.[0] || currentPrice,
      volume24h: indicators?.volume?.[0] || 0,
    };
  } catch (error) {
    console.error(`Error fetching stock price for ${symbol}:`, error);
    return null;
  }
}

// --- Unified price resolver ---

async function getPrice(
  symbol: string,
  assetType: string,
): Promise<{
  symbol: string;
  assetType: string;
  price?: number;
  change24h?: number;
  changePercent24h?: number;
  high24h?: number;
  low24h?: number;
  volume24h?: number;
  lastUpdated?: string;
  error?: string;
}> {
  const upperSymbol = symbol.toUpperCase();

  // Check cache first
  const cached = getCachedPrice(upperSymbol, assetType);
  if (cached) {
    return formatCachedPrice(cached, upperSymbol, assetType);
  }

  const priceData = await fetchStockPrice(upperSymbol);

  if (!priceData) {
    return { symbol: upperSymbol, assetType, error: 'Price not found' };
  }

  const lastUpdated = cachePriceData(upperSymbol, assetType, priceData);

  return {
    symbol: upperSymbol,
    assetType,
    ...priceData,
    lastUpdated,
  };
}

// --- Routes ---

// Get price for a single asset
router.get('/:assetType/:symbol', async (req, res) => {
  try {
    const { assetType, symbol } = req.params;
    const result = await getPrice(symbol, assetType);

    if (result.error) {
      return res.status(404).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching price:', error);
    res.status(500).json({ error: 'Failed to fetch price' });
  }
});

// Get prices for multiple assets (batch)
router.post('/batch', async (req, res) => {
  try {
    const { assets } = req.body as {
      assets: { symbol: string; assetType: string }[]
    };

    if (!assets || !Array.isArray(assets)) {
      return res.status(400).json({ error: 'Assets array is required' });
    }
    if (assets.length === 0) {
      return res.json([]);
    }
    if (assets.length > 50) {
      return res.status(400).json({ error: 'Batch size limit exceeded (max 50)' });
    }

    const results = await Promise.all(
      assets.map(({ symbol, assetType }) => getPrice(symbol, assetType))
    );

    res.json(results);
  } catch (error) {
    console.error('Error fetching batch prices:', error);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

// Get price history for charts (Yahoo Finance)
router.get('/history/:assetType/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { days: daysParam = '30' } = req.query;
    const upperSymbol = symbol.toUpperCase();

    const days = parseInt(String(daysParam), 10);
    if (isNaN(days) || days < 1 || days > 365) {
      return res.status(400).json({ error: 'Days must be a number between 1 and 365' });
    }

    const interval = days <= 7 ? '1h' : '1d';
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${upperSymbol}?interval=${interval}&range=${days}d`
    );

    if (!response.ok) {
      return res.status(404).json({ error: 'Price history not found' });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await response.json() as any;
    const result = data.chart?.result?.[0];

    if (!result) {
      return res.status(404).json({ error: 'Price history not found' });
    }

    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];

    const history = timestamps.map((ts: number, i: number) => ({
      timestamp: new Date(ts * 1000).toISOString(),
      price: closes[i],
    })).filter((p: { price: number | null }) => p.price !== null);

    return res.json({ symbol: upperSymbol, assetType: req.params.assetType, history });
  } catch (error) {
    console.error('Error fetching price history:', error);
    res.status(500).json({ error: 'Failed to fetch price history' });
  }
});

export default router;
