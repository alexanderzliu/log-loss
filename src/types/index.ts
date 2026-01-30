export type AssetType = 'crypto' | 'stock';
export type TradeSide = 'buy' | 'sell';
export type TradeStatus = 'open' | 'closed';

export interface Trade {
  id: string;
  assetType: AssetType;
  symbol: string;
  side: TradeSide;
  entryDate: string;
  entryPrice: number;
  quantity: number;
  remainingQuantity: number | null; // For buy trades: remaining after partial exits
  stopLoss: number | null;
  takeProfit: number | null;
  hypothesis: string;
  status: TradeStatus;
  exitDate: string | null;
  exitPrice: number | null;
  pnl: number | null;
  pnlPercent: number | null;
  notes: string;
  linkedTradeId: string | null; // For sells linked to a buy
  createdAt: string;
  updatedAt: string;
}

export interface TradeFormData {
  assetType: AssetType;
  symbol: string;
  side: TradeSide;
  entryDate: string;
  entryPrice: number;
  quantity: number;
  stopLoss: number | null;
  takeProfit: number | null;
  hypothesis: string;
  notes: string;
  linkedTradeId?: string | null;
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
  lastUpdated: string;
}

export interface PriceHistory {
  timestamp: string;
  price: number;
}

export interface PortfolioSummary {
  openPositionsCost: number;
  realizedPnl: number;
  realizedPnlPercent: number;
  openPositions: number;
  closedPositions: number;
  winRate: number;
  totalTrades: number;
}

export interface PositionGroup {
  symbol: string;
  assetType: AssetType;
  totalQuantity: number;
  avgEntryPrice: number;
  totalInvested: number;
  currentPrice: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlPercent: number | null;
  positions: Trade[];
}
