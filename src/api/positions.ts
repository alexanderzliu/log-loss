import type { Position, TradeFormData, PositionUpdateData, PortfolioSummary, EquityCurvePoint, TradingAnalytics, RecentActivity } from '../types';

const API_BASE = '/api/positions';

export async function fetchPositions(filters?: {
  status?: string;
  assetType?: string;
  symbol?: string;
}): Promise<Position[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.assetType) params.set('assetType', filters.assetType);
  if (filters?.symbol) params.set('symbol', filters.symbol);

  const url = params.toString() ? `${API_BASE}?${params}` : API_BASE;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch positions');
  return response.json();
}

export async function fetchPosition(id: string): Promise<Position> {
  const response = await fetch(`${API_BASE}/${id}`);
  if (!response.ok) throw new Error('Failed to fetch position');
  return response.json();
}

export async function createTrade(data: TradeFormData): Promise<{ position: Position }> {
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

export async function updatePosition(id: string, data: PositionUpdateData): Promise<Position> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update position');
  return response.json();
}

export async function deletePosition(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete position');
}

export async function deleteExecution(positionId: string, executionId: string): Promise<{ position: Position | null }> {
  const response = await fetch(`${API_BASE}/${positionId}/executions/${executionId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete execution');
  return response.json();
}

export async function fetchPortfolioSummary(): Promise<PortfolioSummary> {
  const response = await fetch(`${API_BASE}/stats/summary`);
  if (!response.ok) throw new Error('Failed to fetch portfolio summary');
  return response.json();
}

export async function fetchEquityCurve(): Promise<EquityCurvePoint[]> {
  const response = await fetch(`${API_BASE}/stats/equity-curve`);
  if (!response.ok) throw new Error('Failed to fetch equity curve');
  return response.json();
}

export async function fetchTradingAnalytics(): Promise<TradingAnalytics> {
  const response = await fetch(`${API_BASE}/stats/analytics`);
  if (!response.ok) throw new Error('Failed to fetch trading analytics');
  return response.json();
}

export async function fetchRecentActivity(): Promise<RecentActivity[]> {
  const response = await fetch(`${API_BASE}/stats/recent-activity`);
  if (!response.ok) throw new Error('Failed to fetch recent activity');
  return response.json();
}
