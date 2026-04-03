import type { Trade, TradeCreateData, TradeUpdateData, TradeCloseData, TradeLeg, PortfolioSummary, EquityCurvePoint, TradingAnalytics } from '../types';

const API_BASE = '/api/trades';

export async function fetchTrades(filters?: {
  status?: string;
  assetType?: string;
  underlying?: string;
  strategy?: string;
  tag?: string;
}): Promise<Trade[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.assetType) params.set('assetType', filters.assetType);
  if (filters?.underlying) params.set('underlying', filters.underlying);
  if (filters?.strategy) params.set('strategy', filters.strategy);
  if (filters?.tag) params.set('tag', filters.tag);

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

export async function createTrade(data: TradeCreateData): Promise<Trade> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || 'Failed to create trade');
  }
  return response.json();
}

export async function updateTrade(id: string, data: TradeUpdateData): Promise<Trade> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update trade');
  return response.json();
}

export async function closeTrade(id: string, data: TradeCloseData): Promise<Trade> {
  const response = await fetch(`${API_BASE}/${id}/close`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || 'Failed to close trade');
  }
  return response.json();
}

export async function openTrade(id: string, data?: { entryPrice?: number; openDate?: string; fees?: number }): Promise<Trade> {
  const response = await fetch(`${API_BASE}/${id}/open`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data ?? {}),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || 'Failed to open trade');
  }
  return response.json();
}

export async function deleteTrade(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete trade');
}

export async function addTradeLeg(tradeId: string, leg: Omit<TradeLeg, 'id' | 'tradeId'>): Promise<Trade> {
  const response = await fetch(`${API_BASE}/${tradeId}/legs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(leg),
  });
  if (!response.ok) throw new Error('Failed to add leg');
  return response.json();
}

export async function updateTradeLeg(tradeId: string, legId: string, data: Partial<TradeLeg>): Promise<Trade> {
  const response = await fetch(`${API_BASE}/${tradeId}/legs/${legId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update leg');
  return response.json();
}

export async function deleteTradeLeg(tradeId: string, legId: string): Promise<Trade> {
  const response = await fetch(`${API_BASE}/${tradeId}/legs/${legId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete leg');
  return response.json();
}

export async function addTradeTag(tradeId: string, tag: string, category?: string): Promise<Trade> {
  const response = await fetch(`${API_BASE}/${tradeId}/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag, category }),
  });
  if (!response.ok) throw new Error('Failed to add tag');
  return response.json();
}

export async function deleteTradeTag(tradeId: string, tagId: string): Promise<Trade> {
  const response = await fetch(`${API_BASE}/${tradeId}/tags/${tagId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete tag');
  return response.json();
}

export async function fetchPortfolioSummary(): Promise<PortfolioSummary> {
  const response = await fetch(`${API_BASE}/stats/summary`);
  if (!response.ok) throw new Error('Failed to fetch portfolio summary');
  return response.json();
}

export async function fetchEquityCurve(tradeType?: string): Promise<EquityCurvePoint[]> {
  const params = new URLSearchParams();
  if (tradeType) params.set('tradeType', tradeType);
  const qs = params.toString();
  const response = await fetch(`${API_BASE}/stats/equity-curve${qs ? `?${qs}` : ''}`);
  if (!response.ok) throw new Error('Failed to fetch equity curve');
  return response.json();
}

export async function fetchTradingAnalytics(tradeType?: string): Promise<TradingAnalytics> {
  const params = new URLSearchParams();
  if (tradeType) params.set('tradeType', tradeType);
  const qs = params.toString();
  const response = await fetch(`${API_BASE}/stats/analytics${qs ? `?${qs}` : ''}`);
  if (!response.ok) throw new Error('Failed to fetch trading analytics');
  return response.json();
}

export async function fetchRecentActivity(): Promise<Trade[]> {
  const response = await fetch(`${API_BASE}/stats/recent-activity`);
  if (!response.ok) throw new Error('Failed to fetch recent activity');
  return response.json();
}
