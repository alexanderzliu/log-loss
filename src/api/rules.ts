import type { Rule } from '../types';

const API_BASE = '/api/rules';

export async function fetchRules(): Promise<Rule[]> {
  const response = await fetch(API_BASE);
  if (!response.ok) throw new Error('Failed to fetch rules');
  return response.json();
}

export async function createRule(content: string): Promise<Rule> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || 'Failed to create rule');
  }
  return response.json();
}

export async function updateRule(id: string, content: string): Promise<Rule> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || 'Failed to update rule');
  }
  return response.json();
}

export async function deleteRule(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete rule');
}
