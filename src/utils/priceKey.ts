export function priceKey(item: { symbol: string; assetType: string; chain?: string | null; contractAddress?: string | null }): string {
  if (item.chain && item.contractAddress) {
    return `${item.chain}:${item.contractAddress}`;
  }
  return `${item.symbol}-${item.assetType}`;
}
