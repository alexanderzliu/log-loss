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

// Format very small prices with subscript-zero notation: 0.000000081234 => "$0.0₇8123"
export function formatMicroPrice(value: number): string {
  if (value <= 0) return '$0.00';
  if (value >= 0.01) return formatCurrency(value);

  const str = value.toFixed(20);
  const decimals = str.slice(2); // everything after "0."
  let zeroCount = 0;
  for (const ch of decimals) {
    if (ch === '0') zeroCount++;
    else break;
  }

  if (zeroCount < 3) {
    return `$${value.toFixed(zeroCount + 4)}`;
  }

  const significant = decimals.slice(zeroCount, zeroCount + 4);
  const subscriptDigits = '₀₁₂₃₄₅₆₇₈₉';
  const subscript = String(zeroCount).split('').map(d => subscriptDigits[parseInt(d)]).join('');

  return `$0.0${subscript}${significant}`;
}

// Smart price formatter: uses subscript notation for micro-prices, standard for normal
export function formatPrice(value: number): string {
  if (value === 0) return '$0.00';
  const abs = Math.abs(value);
  if (abs > 0 && abs < 0.01) {
    const formatted = formatMicroPrice(abs);
    return value < 0 ? `-${formatted}` : formatted;
  }
  return formatCurrency(value);
}

// Format large numbers compactly: 1234567 => "$1.23M"
export function formatCompactNumber(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

// Format large numbers compactly without dollar sign: 1234567 => "1.23M"
export function formatCompactCount(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

