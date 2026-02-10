import type { Prediction, PredictionFormData, PredictionCloseData, PredictionUpdateData, PredictionsSummary } from '../types';

const API_BASE = '/api/predictions';

export async function fetchPredictions(filters?: {
  status?: string;
}): Promise<Prediction[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);

  const url = params.toString() ? `${API_BASE}?${params}` : API_BASE;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch predictions');
  return response.json();
}

export async function fetchPrediction(id: string): Promise<Prediction> {
  const response = await fetch(`${API_BASE}/${id}`);
  if (!response.ok) throw new Error('Failed to fetch prediction');
  return response.json();
}

export async function createPrediction(data: PredictionFormData): Promise<Prediction> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || 'Failed to create prediction');
  }
  return response.json();
}

export async function updatePrediction(id: string, data: PredictionUpdateData): Promise<Prediction> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update prediction');
  return response.json();
}

export async function closePrediction(id: string, data: PredictionCloseData): Promise<Prediction> {
  const response = await fetch(`${API_BASE}/${id}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || 'Failed to close prediction');
  }
  return response.json();
}

export async function deletePrediction(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete prediction');
}

export async function fetchPredictionsSummary(): Promise<PredictionsSummary> {
  const response = await fetch(`${API_BASE}/stats/summary`);
  if (!response.ok) throw new Error('Failed to fetch predictions summary');
  return response.json();
}
