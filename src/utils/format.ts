export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatQuantity(value: number): string {
  if (value >= 1) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function calculatePnl(
  entryPrice: number,
  currentPrice: number | null | undefined,
  quantity: number
): { pnl: number | null; pnlPercent: number | null } {
  if (!currentPrice) {
    return { pnl: null, pnlPercent: null };
  }
  const pnl = (currentPrice - entryPrice) * quantity;
  const pnlPercent = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;
  return { pnl, pnlPercent };
}
