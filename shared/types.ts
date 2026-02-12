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
  openedAt: string;
  closedAt: string | null;
  chain: string | null;
  contractAddress: string | null;
  createdAt: string;
  updatedAt: string;
  executions: Execution[];
  reflections?: Reflection[];
  reflectionCount?: number;
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
  marketCap?: number | null;
  fdv?: number | null;
  liquidityUsd?: number | null;
  txnCount24h?: number | null;
  holderCount?: number | null;
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

export interface EquityCurvePoint {
  date: string;
  dailyPnl: number;
  cumulativePnl: number;
  tradeCount: number;
}

export interface TradingAnalytics {
  pnlBySymbol: { symbol: string; assetType: string; pnl: number; tradeCount: number }[];
  monthlyPnl: { month: string; pnl: number; wins: number; losses: number }[];
  bestTrade: { pnl: number; pnlPercent: number; date: string; symbol: string } | null;
  worstTrade: { pnl: number; pnlPercent: number; date: string; symbol: string } | null;
  avgWin: number | null;
  avgLoss: number | null;
  profitFactor: number;
  avgHoldDays: number | null;
}

export interface RecentActivity {
  id: string;
  symbol: string;
  assetType: string;
  side: string;
  price: number;
  quantity: number;
  executedAt: string;
  pnl: number | null;
  pnlPercent: number | null;
  chain: string | null;
  contractAddress: string | null;
}

// --- Reflections ---

export type ReflectionType = 'success' | 'lesson' | 'mistake';

export interface Reflection {
  id: string;
  positionId: string;
  type: ReflectionType;
  content: string;
  createdAt: string;
  updatedAt: string;
  // Joined fields (when fetched via /api/reflections)
  symbol?: string;
  assetType?: string;
}

export interface InsightFeedItem {
  id: string;
  type: 'hypothesis' | 'success' | 'lesson' | 'mistake';
  content: string;
  date: string;
  positionId: string;
  symbol: string;
  assetType: string;
  direction: string;
  status: string;
  realizedPnl: number;
  realizedPnlPercent: number | null;
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

// --- Prediction Markets ---

export type PredictionSide = 'yes' | 'no';
export type PredictionStatus = 'open' | 'closed';

export interface Prediction {
  id: string;
  market: string;
  category: string;
  side: PredictionSide;
  status: PredictionStatus;
  resolution: 'yes' | 'no' | null;
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  costBasis: number;
  pnl: number | null;
  pnlPercent: number | null;
  hypothesis: string;
  notes: string;
  expiresAt: string | null;
  openedAt: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PredictionFormData {
  market: string;
  category: string;
  side: PredictionSide;
  entryPrice: number;
  quantity: number;
  date: string;
  expiresAt: string | null;
  hypothesis: string;
  notes: string;
}

export interface PredictionCloseData {
  exitPrice?: number;
  resolution?: 'yes' | 'no';
  date: string;
  notes?: string;
}

export interface PredictionUpdateData {
  market?: string;
  category?: string;
  hypothesis?: string;
  notes?: string;
}

export interface PredictionsSummary {
  openPredictions: number;
  closedPredictions: number;
  predictionsPnl: number;
  predictionsCostBasis: number;
  predictionsWinRate: number;
  openPredictionsCost: number;
}

// --- Rules ---

export interface Rule {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// --- AI ---

export interface ReflectionSuggestion {
  type: ReflectionType;
  content: string;
}

export interface AIAnalysis {
  insights: string[];
  patterns: string[];
  recommendations: string[];
  generatedAt: string;
}
