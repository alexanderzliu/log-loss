import { Router } from 'express';
import { db } from '../database';
import { fetchHolderCount } from './holders';
import { dexScreenerLimiter } from '../services/rateLimiter';
import type { DexScreenerMetrics } from '../../shared/types';

const router = Router();

const CACHE_EXPIRY_MINUTES = 5;

interface PriceData {
  price: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  marketCap: number | null;
  fdv: number | null;
  liquidityUsd: number | null;
  txnCount24h: number | null;
  holderCount: number | null;
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
    AND datetime(last_updated) > datetime('now', '-' || ? || ' minutes')
  `).get(symbol, assetType, CACHE_EXPIRY_MINUTES) as Record<string, unknown> | undefined;
}

function cachePriceData(key: string, assetType: string, priceData: PriceData): string {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO price_cache
    (symbol, asset_type, price, change_24h, change_percent_24h, high_24h, low_24h, volume_24h,
     market_cap, fdv, liquidity_usd, txn_count_24h, holder_count, last_updated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    key,
    assetType,
    priceData.price,
    priceData.change24h,
    priceData.changePercent24h,
    priceData.high24h,
    priceData.low24h,
    priceData.volume24h,
    priceData.marketCap,
    priceData.fdv,
    priceData.liquidityUsd,
    priceData.txnCount24h,
    priceData.holderCount,
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
    marketCap: (cached.market_cap as number) ?? null,
    fdv: (cached.fdv as number) ?? null,
    liquidityUsd: (cached.liquidity_usd as number) ?? null,
    txnCount24h: (cached.txn_count_24h as number) ?? null,
    holderCount: (cached.holder_count as number) ?? null,
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

const majorCoinNames: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', ADA: 'Cardano',
  DOT: 'Polkadot', DOGE: 'Dogecoin', XRP: 'Ripple', AVAX: 'Avalanche',
  MATIC: 'Polygon', LINK: 'Chainlink', UNI: 'Uniswap', ATOM: 'Cosmos',
  LTC: 'Litecoin', BCH: 'Bitcoin Cash', ALGO: 'Algorand', FIL: 'Filecoin',
  NEAR: 'NEAR Protocol', APT: 'Aptos', ARB: 'Arbitrum', OP: 'Optimism',
};

async function fetchCryptoPrice(symbol: string): Promise<PriceData | null> {
  try {
    const coinId = cryptoIdMap[symbol.toUpperCase()] || symbol.toLowerCase();
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_high_24h=true&include_low_24h=true&include_market_cap=true`
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
      marketCap: coinData.usd_market_cap || null,
      fdv: null,
      liquidityUsd: null,
      txnCount24h: null,
      holderCount: null,
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
      marketCap: null,
      fdv: null,
      liquidityUsd: null,
      txnCount24h: null,
      holderCount: null,
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
  pairCreatedAt: number | null;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd: string;
  volume: { h24: number; h6: number; h1: number; m5: number };
  priceChange: { h24: number; h6: number; h1: number; m5: number };
  liquidity: { usd: number; base: number; quote: number };
  txns: { h24: { buys: number; sells: number }; h6: { buys: number; sells: number }; h1: { buys: number; sells: number }; m5: { buys: number; sells: number } };
  // Extended fields from DexScreener API
  volumeBuy?: { h24: number; h6: number; h1: number; m5: number };
  volumeSell?: { h24: number; h6: number; h1: number; m5: number };
  buyers?: { h24: number; h6: number; h1: number; m5: number };
  sellers?: { h24: number; h6: number; h1: number; m5: number };
  makers?: { h24: number; h6: number; h1: number; m5: number };
  fdv: number;
  marketCap: number;
  info?: { imageUrl?: string };
}

function pickBestPair(pairs: DexScreenerPair[]): DexScreenerPair {
  return pairs.reduce((a, b) =>
    (a.liquidity?.usd ?? 0) >= (b.liquidity?.usd ?? 0) ? a : b
  );
}

function extractDexScreenerMetrics(pair: DexScreenerPair): DexScreenerMetrics {
  const tf = (obj: { m5: number; h1: number; h6: number; h24: number } | undefined) => ({
    m5: obj?.m5 ?? 0,
    h1: obj?.h1 ?? 0,
    h6: obj?.h6 ?? 0,
    h24: obj?.h24 ?? 0,
  });
  return {
    txns: {
      m5: { buys: pair.txns?.m5?.buys ?? 0, sells: pair.txns?.m5?.sells ?? 0 },
      h1: { buys: pair.txns?.h1?.buys ?? 0, sells: pair.txns?.h1?.sells ?? 0 },
      h6: { buys: pair.txns?.h6?.buys ?? 0, sells: pair.txns?.h6?.sells ?? 0 },
      h24: { buys: pair.txns?.h24?.buys ?? 0, sells: pair.txns?.h24?.sells ?? 0 },
    },
    volume: tf(pair.volume),
    volumeBuy: tf(pair.volumeBuy),
    volumeSell: tf(pair.volumeSell),
    buyers: tf(pair.buyers),
    sellers: tf(pair.sellers),
    makers: tf(pair.makers),
    priceChange: tf(pair.priceChange),
    liquidity: {
      usd: pair.liquidity?.usd ?? 0,
      base: pair.liquidity?.base ?? 0,
      quote: pair.liquidity?.quote ?? 0,
    },
    pairCreatedAt: pair.pairCreatedAt ?? null,
    pairAddress: pair.pairAddress ?? '',
    dexId: pair.dexId ?? '',
  };
}

/** Fetch raw DexScreener pairs for a token (rate-limited). Exported for use by metrics route. */
export async function fetchDexScreenerPairs(chain: string, contractAddress: string): Promise<DexScreenerPair[] | null> {
  try {
    await dexScreenerLimiter.acquire();
    const response = await fetch(
      `https://api.dexscreener.com/tokens/v1/${chain}/${contractAddress}`
    );
    if (!response.ok) return null;
    const pairs = await response.json() as DexScreenerPair[];
    if (!pairs || pairs.length === 0) return null;
    return pairs;
  } catch (error) {
    console.error(`DexScreener fetch error for ${chain}/${contractAddress}:`, error);
    return null;
  }
}

/** Fetch full DexScreener metrics for a token. Returns metrics + price data. */
export async function fetchDexScreenerFullMetrics(
  chain: string,
  contractAddress: string,
): Promise<{ priceData: PriceData; metrics: DexScreenerMetrics; marketCap: number | null; fdv: number | null } | null> {
  const pairs = await fetchDexScreenerPairs(chain, contractAddress);
  if (!pairs) return null;

  const best = pickBestPair(pairs);
  const priceUsd = parseFloat(best.priceUsd);
  if (isNaN(priceUsd)) return null;

  const metrics = extractDexScreenerMetrics(best);
  const txnBuys = best.txns?.h24?.buys ?? 0;
  const txnSells = best.txns?.h24?.sells ?? 0;

  return {
    priceData: {
      price: priceUsd,
      change24h: priceUsd * ((best.priceChange?.h24 ?? 0) / 100),
      changePercent24h: best.priceChange?.h24 ?? 0,
      high24h: priceUsd,
      low24h: priceUsd,
      volume24h: best.volume?.h24 ?? 0,
      marketCap: best.marketCap ?? null,
      fdv: best.fdv ?? null,
      liquidityUsd: best.liquidity?.usd ?? null,
      txnCount24h: txnBuys + txnSells,
      holderCount: null,
    },
    metrics,
    marketCap: best.marketCap ?? null,
    fdv: best.fdv ?? null,
  };
}

async function fetchDexScreenerPrice(chain: string, contractAddress: string): Promise<PriceData | null> {
  const result = await fetchDexScreenerFullMetrics(chain, contractAddress);
  return result ? result.priceData : null;
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
  marketCap?: number | null;
  fdv?: number | null;
  liquidityUsd?: number | null;
  txnCount24h?: number | null;
  holderCount?: number | null;
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

  // Fetch holder count in parallel (non-blocking, best-effort)
  if (contractAddress && chain && priceData.holderCount === null) {
    fetchHolderCount(chain, contractAddress).then(count => {
      if (count !== null) {
        try {
          db.prepare('UPDATE price_cache SET holder_count = ? WHERE symbol = ? AND asset_type = ?')
            .run(count, key, assetType);
        } catch (e) {
          console.error('Failed to update holder count cache:', e);
        }
      }
    }).catch(() => { /* silently ignore holder count failures */ });
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

    // Sort by liquidity descending
    const dexTokens = Array.from(tokenMap.values())
      .sort((a, b) => b.liquidity - a.liquidity);

    // Match major coins from cryptoIdMap and prepend them
    const upperQ = q.toUpperCase();
    const lowerQ = q.toLowerCase();
    const majorMatches = Object.keys(cryptoIdMap)
      .filter(symbol => {
        const name = (majorCoinNames[symbol] || symbol).toLowerCase();
        return symbol.startsWith(upperQ) || name.startsWith(lowerQ);
      })
      .map(symbol => {
        const cached = getCachedPrice(symbol, 'crypto');
        return {
          symbol,
          name: majorCoinNames[symbol] || symbol,
          chain: '',
          contractAddress: '',
          priceUsd: cached ? String((cached as Record<string, unknown>).price) : '',
          liquidity: -1, // sentinel: not a DEX token
          volume24h: cached ? Number((cached as Record<string, unknown>).volume_24h) || 0 : 0,
          priceChange24h: cached ? Number((cached as Record<string, unknown>).change_percent_24h) || 0 : 0,
          imageUrl: null,
          pairAddress: '',
        };
      });

    const tokens = [...majorMatches, ...dexTokens].slice(0, 20);

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
    const { chain, contractAddress } = req.query;
    const result = await getPrice(symbol, assetType, chain as string | undefined, contractAddress as string | undefined);

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
    if (assets.length > 50) {
      return res.status(400).json({ error: 'Batch size limit exceeded (max 50)' });
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

// --- GeckoTerminal OHLCV fallback ---

// Map DexScreener chain IDs to GeckoTerminal network IDs
const geckoTerminalNetworkMap: Record<string, string> = {
  solana: 'solana',
  ethereum: 'eth',
  base: 'base',
  bsc: 'bsc',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  polygon_pos: 'polygon-pos',
  avalanche: 'avax',
};

interface GeckoTerminalOHLCV {
  data: {
    attributes: {
      ohlcv_list: [number, number, number, number, number, number][]; // [timestamp, open, high, low, close, volume]
    };
  };
}

async function fetchGeckoTerminalOHLCV(
  chain: string,
  contractAddress: string,
  days: number,
): Promise<{ timestamp: string; price: number }[] | null> {
  const network = geckoTerminalNetworkMap[chain];
  if (!network) return null;

  // Look up the pair_address from token_metrics for this token
  const metricsRow = db.prepare(
    'SELECT pair_address FROM token_metrics WHERE chain = ? AND contract_address = ?'
  ).get(chain, contractAddress) as { pair_address: string | null } | undefined;

  const poolAddress = metricsRow?.pair_address;
  if (!poolAddress) return null;

  // Map days to GeckoTerminal timeframe and aggregate
  let timeframe: string;
  let aggregate: number;
  if (days <= 1) {
    timeframe = 'minute';
    aggregate = 15;
  } else if (days <= 7) {
    timeframe = 'hour';
    aggregate = 1;
  } else {
    timeframe = 'day';
    aggregate = 1;
  }

  try {
    const url = `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${poolAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=1000&currency=usd`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) return null;

    const data = await response.json() as GeckoTerminalOHLCV;
    const ohlcvList = data?.data?.attributes?.ohlcv_list;
    if (!ohlcvList || ohlcvList.length === 0) return null;

    // Filter to requested day range and map to price history format
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    return ohlcvList
      .filter(candle => candle[0] * 1000 >= cutoff)
      .map(candle => ({
        timestamp: new Date(candle[0] * 1000).toISOString(),
        price: candle[4], // close price
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  } catch (error) {
    console.error(`GeckoTerminal OHLCV error for ${chain}/${poolAddress}:`, error);
    return null;
  }
}

// Get price history for charts
router.get('/history/:assetType/:symbol', async (req, res) => {
  try {
    const { assetType, symbol } = req.params;
    const { days: daysParam = '30', contractAddress, chain: chainParam } = req.query;
    const upperSymbol = symbol.toUpperCase();

    // Validate days parameter
    const days = parseInt(String(daysParam), 10);
    if (isNaN(days) || days < 1 || days > 365) {
      return res.status(400).json({ error: 'Days must be a number between 1 and 365' });
    }

    // DexScreener tokens: try GeckoTerminal as fallback
    if (contractAddress) {
      const chain = chainParam as string | undefined;
      if (chain) {
        const history = await fetchGeckoTerminalOHLCV(chain, contractAddress as string, days);
        if (history && history.length > 0) {
          return res.json({ symbol: upperSymbol, assetType, history });
        }
      }
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
