export type AssetType = 'crypto' | 'stock';
export type PositionStatus = 'open' | 'closed';
export type ExecutionSide = 'buy' | 'sell';

export interface Execution {
  id: string;
  positionId: string;
  side: ExecutionSide;
  price: number;
  quantity: number;
  executedAt: string;
  pnl: number | null;
  pnlPercent: number | null;
  notes: string;
  createdAt: string;
}

export interface Position {
  id: string;
  assetType: AssetType;
  symbol: string;
  direction: 'long' | 'short';
  status: PositionStatus;
  totalQuantity: number;
  remainingQuantity: number;
  avgEntryPrice: number;
  totalCostBasis: number;
  realizedPnl: number;
  realizedPnlPercent: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  hypothesis: string;
  notes: string;
  openedAt: string;
  closedAt: string | null;
  chain: string | null;
  contractAddress: string | null;
  createdAt: string;
  updatedAt: string;
  executions: Execution[];
}

export interface TradeFormData {
  assetType: AssetType;
  symbol: string;
  side: ExecutionSide;
  date: string;
  price: number;
  quantity: number;
  stopLoss: number | null;
  takeProfit: number | null;
  hypothesis: string;
  notes: string;
  chain?: string | null;
  contractAddress?: string | null;
  positionId?: string;
}

export interface PositionUpdateData {
  stopLoss: number | null;
  takeProfit: number | null;
  hypothesis: string;
  notes: string;
}

export interface PriceData {
  symbol: string;
  assetType: AssetType;
  price: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  chain?: string | null;
  contractAddress?: string | null;
  lastUpdated: string;
}

export interface DexScreenerToken {
  symbol: string;
  name: string;
  chain: string;
  contractAddress: string;
  priceUsd: string;
  liquidity: number;
  volume24h: number;
  priceChange24h: number;
  imageUrl: string | null;
  pairAddress: string;
}

export interface PriceHistory {
  timestamp: string;
  price: number;
}

export interface PortfolioSummary {
  openPositionsCost: number;
  realizedPnl: number;
  realizedPnlPercent: number;
  totalCostBasis: number;
  openPositions: number;
  closedPositions: number;
  winRate: number;
  totalExecutions: number;
}
