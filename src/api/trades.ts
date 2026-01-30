import type { Trade, TradeFormData, PortfolioSummary } from '../types';

const API_BASE = '/api/trades';

export async function fetchTrades(filters?: {
  status?: string;
  assetType?: string;
  symbol?: string;
}): Promise<Trade[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.assetType) params.set('assetType', filters.assetType);
  if (filters?.symbol) params.set('symbol', filters.symbol);

  const url = params.toString() ? `${API_BASE}?${params}` : API_BASE;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch trades');
  return response.json();
}

export async function fetchTrade(id: string): Promise<Trade> {
  const response = await fetch(`${API_BASE}/${id}`);
  if (!response.ok) throw new Error('Failed to fetch trade');
  return response.json();
}

export async function createTrade(data: TradeFormData): Promise<{ trade: Trade; linkedTrade: Trade | null }> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create trade');
  return response.json();
}

export async function updateTrade(id: string, data: Partial<Trade>): Promise<Trade> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update trade');
  return response.json();
}

export async function deleteTrade(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete trade');
}

export async function fetchPortfolioSummary(): Promise<PortfolioSummary> {
  const response = await fetch(`${API_BASE}/stats/summary`);
  if (!response.ok) throw new Error('Failed to fetch portfolio summary');
  return response.json();
}
