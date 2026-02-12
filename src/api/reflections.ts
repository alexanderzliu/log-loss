import type { Reflection, InsightFeedItem } from '../types';

const API_BASE = '/api/reflections';

export async function fetchReflections(filters?: {
  positionId?: string;
  type?: string;
  search?: string;
}): Promise<Reflection[]> {
  const params = new URLSearchParams();
  if (filters?.positionId) params.set('positionId', filters.positionId);
  if (filters?.type) params.set('type', filters.type);
  if (filters?.search) params.set('search', filters.search);

  const url = params.toString() ? `${API_BASE}?${params}` : API_BASE;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch reflections');
  return response.json();
}

export async function createReflection(data: {
  positionId: string;
  type?: 'success' | 'lesson' | 'mistake';
  content: string;
}): Promise<Reflection> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || 'Failed to create reflection');
  }
  return response.json();
}

export async function updateReflection(id: string, data: {
  content?: string;
  type?: 'success' | 'lesson' | 'mistake';
}): Promise<Reflection> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update reflection');
  return response.json();
}

export async function deleteReflection(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete reflection');
}

export async function fetchInsightsFeed(filters?: {
  search?: string;
  type?: string;
  symbol?: string;
}): Promise<InsightFeedItem[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.set('search', filters.search);
  if (filters?.type) params.set('type', filters.type);
  if (filters?.symbol) params.set('symbol', filters.symbol);

  const url = params.toString() ? `${API_BASE}/feed?${params}` : `${API_BASE}/feed`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch insights feed');
  return response.json();
}
