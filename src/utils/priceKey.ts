export function priceKey(item: { symbol?: string; underlying?: string; assetType: string }): string {
  const key = item.symbol || item.underlying || '';
  return `${key}-${item.assetType}`;
}
