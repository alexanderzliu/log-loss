import type { TokenMetrics, MomentumSummary, DerivativesResult, DerivativeWindow, SnapshotHistoryPoint } from '../types';

const API_BASE = '/api/metrics';

export async function fetchTokenMetrics(chain: string, address: string): Promise<TokenMetrics> {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(chain)}/${encodeURIComponent(address)}`);
  if (!response.ok) throw new Error('Failed to fetch token metrics');
  return response.json();
}

export async function fetchMomentumSummary(chain: string, address: string): Promise<MomentumSummary> {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(chain)}/${encodeURIComponent(address)}/momentum`);
  if (!response.ok) throw new Error('Failed to fetch momentum summary');
  return response.json();
}

export async function fetchDerivatives(chain: string, address: string, window: DerivativeWindow = '1h'): Promise<DerivativesResult> {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(chain)}/${encodeURIComponent(address)}/derivatives?window=${window}`);
  if (!response.ok) throw new Error('Failed to fetch derivatives');
  return response.json();
}

export async function fetchSnapshotHistory(chain: string, address: string, hours: number = 24): Promise<SnapshotHistoryPoint[]> {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(chain)}/${encodeURIComponent(address)}/history?hours=${hours}`);
  if (!response.ok) throw new Error('Failed to fetch snapshot history');
  const data = await response.json();
  return data.snapshots;
}
