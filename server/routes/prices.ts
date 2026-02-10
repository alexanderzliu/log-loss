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
// For DexScreener tokens, we use contractAddress as the cache symbol key (globally unique).
// For CoinGecko/Yahoo, we use the uppercased ticker symbol.

function cacheKey(symbol: string, chain?: string | null, contractAddress?: string | null): string {
  if (chain && contractAddress) return `${chain}:${contractAddress}`;
  return symbol;
}

function getCachedPrice(symbol: string, assetType: string): Record<string, unknown> | undefined {
  return db.prepare(`
    SELECT * FROM price_cache
    WHERE symbol = ? AND asset_type = ?
    AND datetime(last_updated) > datetime('now', '-${CACHE_EXPIRY_MINUTES} minutes')
  `).get(symbol, assetType) as Record<string, unknown> | undefined;
}

function cachePriceData(key: string, assetType: string, priceData: PriceData): string {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO price_cache
    (symbol, asset_type, price, change_24h, change_percent_24h, high_24h, low_24h, volume_24h, last_updated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    key,
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

// --- CoinGecko ---

const cryptoIdMap: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  ADA: 'cardano',
  DOT: 'polkadot',
  DOGE: 'dogecoin',
  XRP: 'ripple',
  AVAX: 'avalanche-2',
  MATIC: 'matic-network',
  LINK: 'chainlink',
  UNI: 'uniswap',
  ATOM: 'cosmos',
  LTC: 'litecoin',
  BCH: 'bitcoin-cash',
  ALGO: 'algorand',
  FIL: 'filecoin',
  NEAR: 'near',
  APT: 'aptos',
  ARB: 'arbitrum',
  OP: 'optimism',
};

async function fetchCryptoPrice(symbol: string): Promise<PriceData | null> {
  try {
    const coinId = cryptoIdMap[symbol.toUpperCase()] || symbol.toLowerCase();
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_high_24h=true&include_low_24h=true`
    );

    if (!response.ok) return null;

    const data = await response.json() as Record<string, Record<string, number>>;
    const coinData = data[coinId];

    if (!coinData) return null;

    return {
      price: coinData.usd,
      change24h: coinData.usd * (coinData.usd_24h_change / 100),
      changePercent24h: coinData.usd_24h_change || 0,
      high24h: coinData.usd_high_24h || coinData.usd,
      low24h: coinData.usd_low_24h || coinData.usd,
      volume24h: coinData.usd_24h_vol || 0,
    };
  } catch (error) {
    console.error(`Error fetching crypto price for ${symbol}:`, error);
    return null;
  }
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

// --- DexScreener ---

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd: string;
  volume: { h24: number; h6: number; h1: number; m5: number };
  priceChange: { h24: number; h6: number; h1: number; m5: number };
  liquidity: { usd: number; base: number; quote: number };
  fdv: number;
  marketCap: number;
  info?: { imageUrl?: string };
}

async function fetchDexScreenerPrice(chain: string, contractAddress: string): Promise<PriceData | null> {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/tokens/v1/${chain}/${contractAddress}`
    );
    if (!response.ok) return null;

    const pairs = await response.json() as DexScreenerPair[];
    if (!pairs || pairs.length === 0) return null;

    // Pick the pair with highest liquidity
    const best = pairs.reduce((a, b) =>
      (a.liquidity?.usd || 0) >= (b.liquidity?.usd || 0) ? a : b
    );

    const priceUsd = parseFloat(best.priceUsd);
    if (isNaN(priceUsd)) return null;

    return {
      price: priceUsd,
      change24h: priceUsd * ((best.priceChange?.h24 || 0) / 100),
      changePercent24h: best.priceChange?.h24 || 0,
      high24h: priceUsd,
      low24h: priceUsd,
      volume24h: best.volume?.h24 || 0,
    };
  } catch (error) {
    console.error(`DexScreener price error for ${chain}/${contractAddress}:`, error);
    return null;
  }
}

// --- Unified price resolver ---

async function getPrice(
  symbol: string,
  assetType: string,
  chain?: string | null,
  contractAddress?: string | null,
): Promise<{
  symbol: string;
  assetType: string;
  chain?: string | null;
  contractAddress?: string | null;
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
  const key = cacheKey(upperSymbol, chain, contractAddress);

  // Check cache first
  const cached = getCachedPrice(key, assetType);
  if (cached) {
    return { ...formatCachedPrice(cached, upperSymbol, assetType), chain, contractAddress };
  }

  // Fetch from the appropriate provider
  let priceData: PriceData | null = null;

  if (contractAddress && chain) {
    priceData = await fetchDexScreenerPrice(chain, contractAddress);
  } else if (assetType === 'crypto') {
    priceData = await fetchCryptoPrice(upperSymbol);
  } else {
    priceData = await fetchStockPrice(upperSymbol);
  }

  if (!priceData) {
    return { symbol: upperSymbol, assetType, chain, contractAddress, error: 'Price not found' };
  }

  const lastUpdated = cachePriceData(key, assetType, priceData);

  return {
    symbol: upperSymbol,
    assetType,
    chain,
    contractAddress,
    ...priceData,
    lastUpdated,
  };
}

// --- Routes ---

// Search tokens via DexScreener (for autocomplete)
router.get('/search', async (req, res) => {
  try {
    const q = req.query.q as string;
    if (!q || q.length < 2) {
      return res.json({ tokens: [] });
    }

    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`
    );
    if (!response.ok) {
      return res.json({ tokens: [] });
    }

    const data = await response.json() as { pairs: DexScreenerPair[] };
    const pairs = data.pairs || [];

    // Deduplicate by (chain, baseToken.address), keep highest-liquidity pair
    const tokenMap = new Map<string, {
      symbol: string;
      name: string;
      chain: string;
      contractAddress: string;
      priceUsd: string;
      liquidity: number;
      volume24h: number;
      priceChange24h: number;
      imageUrl: string | null;
      pairAddress: string;
    }>();

    for (const pair of pairs) {
      const key = `${pair.chainId}:${pair.baseToken.address}`;
      const existing = tokenMap.get(key);
      if (!existing || (pair.liquidity?.usd || 0) > existing.liquidity) {
        tokenMap.set(key, {
          symbol: pair.baseToken.symbol,
          name: pair.baseToken.name,
          chain: pair.chainId,
          contractAddress: pair.baseToken.address,
          priceUsd: pair.priceUsd,
          liquidity: pair.liquidity?.usd || 0,
          volume24h: pair.volume?.h24 || 0,
          priceChange24h: pair.priceChange?.h24 || 0,
          imageUrl: pair.info?.imageUrl || null,
          pairAddress: pair.pairAddress,
        });
      }
    }

    // Sort by liquidity descending, limit to 20
    const tokens = Array.from(tokenMap.values())
      .sort((a, b) => b.liquidity - a.liquidity)
      .slice(0, 20);

    res.json({ tokens });
  } catch (error) {
    console.error('Token search error:', error);
    res.json({ tokens: [] });
  }
});

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
      assets: { symbol: string; assetType: string; chain?: string; contractAddress?: string }[]
    };

    if (!assets || !Array.isArray(assets)) {
      return res.status(400).json({ error: 'Assets array is required' });
    }
    if (assets.length === 0) {
      return res.json([]);
    }

    const results = await Promise.all(
      assets.map(({ symbol, assetType, chain, contractAddress }) =>
        getPrice(symbol, assetType, chain, contractAddress)
      )
    );

    res.json(results);
  } catch (error) {
    console.error('Error fetching batch prices:', error);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

// Get price history for charts
router.get('/history/:assetType/:symbol', async (req, res) => {
  try {
    const { assetType, symbol } = req.params;
    const { days: daysParam = '30', contractAddress } = req.query;
    const upperSymbol = symbol.toUpperCase();

    // Validate days parameter
    const days = parseInt(String(daysParam), 10);
    if (isNaN(days) || days < 1 || days > 365) {
      return res.status(400).json({ error: 'Days must be a number between 1 and 365' });
    }

    // DexScreener tokens: no historical data available
    if (contractAddress) {
      return res.json({ symbol: upperSymbol, assetType, history: [], unavailable: true });
    }

    if (assetType === 'crypto') {
      const coinId = cryptoIdMap[upperSymbol] || upperSymbol.toLowerCase();
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`
      );

      if (!response.ok) {
        return res.status(404).json({ error: 'Price history not found' });
      }

      const data = await response.json() as { prices: [number, number][] };
      const history = data.prices.map(([timestamp, price]: [number, number]) => ({
        timestamp: new Date(timestamp).toISOString(),
        price,
      }));

      return res.json({ symbol: upperSymbol, assetType, history });
    } else {
      // Stock price history
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

      return res.json({ symbol: upperSymbol, assetType, history });
    }
  } catch (error) {
    console.error('Error fetching price history:', error);
    res.status(500).json({ error: 'Failed to fetch price history' });
  }
});

export default router;
