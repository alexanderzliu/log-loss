import type { ChartSnapshot } from '../types';

function apiBase(tradeId: string) {
  return `/api/trades/${tradeId}/chart`;
}

export async function fetchSnapshots(tradeId: string): Promise<ChartSnapshot[]> {
  const response = await fetch(apiBase(tradeId));
  if (!response.ok) throw new Error('Failed to fetch chart snapshots');
  return response.json();
}

export async function captureSnapshots(
  tradeId: string,
  options?: { tradeDate?: string },
): Promise<{ snapshots: ChartSnapshot[]; status: { captured: string[]; theoretical: string[]; failed: string[] } }> {
  const response = await fetch(`${apiBase(tradeId)}/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options || {}),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || 'Failed to capture chart data');
  }
  return response.json();
}

export async function deleteSnapshot(tradeId: string, snapshotId: string): Promise<void> {
  const response = await fetch(`${apiBase(tradeId)}/${snapshotId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete snapshot');
}
