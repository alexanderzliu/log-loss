import type { ReflectionSuggestion, AIAnalysis } from '../types';

const API_BASE = '/api/ai';

export async function suggestReflections(positionId: string): Promise<ReflectionSuggestion[]> {
  const response = await fetch(`${API_BASE}/suggest-reflections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ positionId }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || 'Failed to generate suggestions');
  }
  return response.json();
}

export async function generateAnalysis(): Promise<AIAnalysis> {
  const response = await fetch(`${API_BASE}/analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || 'Failed to generate analysis');
  }
  return response.json();
}
