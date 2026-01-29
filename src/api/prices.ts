import type { PriceData, PriceHistory, AssetType } from '../types';

const API_BASE = '/api/prices';

export async function fetchPrice(symbol: string, assetType: AssetType): Promise<PriceData> {
  const response = await fetch(`${API_BASE}/${assetType}/${symbol}`);
  if (!response.ok) throw new Error(`Failed to fetch price for ${symbol}`);
  return response.json();
}

export async function fetchPricesBatch(
  assets: { symbol: string; assetType: AssetType }[]
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
  days: number = 30
): Promise<{ symbol: string; assetType: AssetType; history: PriceHistory[] }> {
  const response = await fetch(`${API_BASE}/history/${assetType}/${symbol}?days=${days}`);
  if (!response.ok) throw new Error(`Failed to fetch price history for ${symbol}`);
  return response.json();
}
