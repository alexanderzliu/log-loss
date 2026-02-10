import type { PriceData, PriceHistory, AssetType, DexScreenerToken } from '../types';

const API_BASE = '/api/prices';

export async function fetchPrice(symbol: string, assetType: AssetType): Promise<PriceData> {
  const response = await fetch(`${API_BASE}/${assetType}/${symbol}`);
  if (!response.ok) throw new Error(`Failed to fetch price for ${symbol}`);
  return response.json();
}

export async function fetchPricesBatch(
  assets: { symbol: string; assetType: AssetType; chain?: string | null; contractAddress?: string | null }[]
): Promise<PriceData[]> {
  const response = await fetch(`${API_BASE}/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assets }),
  });
  if (!response.ok) throw new Error('Failed to fetch prices');
  return response.json();
}

export async function fetchPriceHistory(
  symbol: string,
  assetType: AssetType,
  days: number = 30,
  contractAddress?: string | null,
): Promise<{ symbol: string; assetType: AssetType; history: PriceHistory[]; unavailable?: boolean }> {
  const params = new URLSearchParams({ days: String(days) });
  if (contractAddress) params.set('contractAddress', contractAddress);
  const response = await fetch(`${API_BASE}/history/${assetType}/${symbol}?${params}`);
  if (!response.ok) throw new Error(`Failed to fetch price history for ${symbol}`);
  return response.json();
}

export async function searchTokens(query: string): Promise<DexScreenerToken[]> {
  if (query.length < 2) return [];
  const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) return [];
  const data = await response.json() as { tokens: DexScreenerToken[] };
  return data.tokens;
}
