// --- Trade Types ---

export type TradeAssetType = 'option' | 'futures' | 'stock';
export type TradeStatus = 'planned' | 'open' | 'closed';
export type TradeStrategy = 'long' | 'short' | 'debit_spread' | 'credit_spread'
  | 'iron_condor' | 'straddle' | 'strangle' | 'custom';
export type TradeSide = 'buy' | 'sell';
export type EntryQuality = 'clean' | 'fomo' | 'chased' | 'intuitive';
export type OptionType = 'call' | 'put';

export interface TradeLeg {
  id: string;
  tradeId: string;
  ticker: string;
  optionType: OptionType | null;
  strike: number | null;
  expiration: string | null;
  side: TradeSide;
  quantity: number;
  entryPrice: number | null;
  exitPrice: number | null;
  entryUnderlyingPrice: number | null;
  exitUnderlyingPrice: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  iv: number | null;
}

export interface TradeTag {
  id: string;
  tradeId: string;
  tag: string;
  category: string | null;
}

export interface Trade {
  id: string;
  name: string;
  assetType: TradeAssetType;
  underlying: string;
  status: TradeStatus;
  strategy: TradeStrategy;
  side: TradeSide;
  quantity: number;
  entryPrice: number | null;
  exitPrice: number | null;
  fees: number | null;
  realizedPnl: number | null;
  openDate: string | null;
  closeDate: string | null;
  entryQuality: EntryQuality | null;
  followedPlan: boolean | null;
  thesis: string;
  exitPlan: string;
  reflection: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  legs: TradeLeg[];
  tags: TradeTag[];
  reflections?: Reflection[];
  reflectionCount?: number;
}

export interface TradeCreateData {
  name: string;
  assetType: TradeAssetType;
  underlying: string;
  status?: 'planned' | 'open';
  strategy: TradeStrategy;
  side: TradeSide;
  quantity: number;
  entryPrice: number | null;
  fees: number | null;
  openDate: string | null;
  entryQuality: EntryQuality | null;
  thesis: string;
  exitPlan: string;
  notes: string;
  legs: Omit<TradeLeg, 'id' | 'tradeId'>[];
  tags: { tag: string; category?: string }[];
}

export interface TradeUpdateData {
  name?: string;
  thesis?: string;
  exitPlan?: string;
  notes?: string;
  entryQuality?: EntryQuality;
  fees?: number;
}

export interface TradeCloseData {
  exitPrice: number | null;
  closeDate: string;
  realizedPnl: number;
  reflection?: string;
  followedPlan?: boolean;
  legs?: { id: string; exitPrice: number }[];
}

// --- Prices ---

export interface PriceData {
  symbol: string;
  assetType: string;
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

// --- Analytics ---

export interface EquityCurvePoint {
  date: string;
  dailyPnl: number;
  cumulativePnl: number;
  tradeCount: number;
}

export interface TradingAnalytics {
  pnlByUnderlying: { underlying: string; assetType: string; pnl: number; tradeCount: number }[];
  pnlByStrategy: { strategy: string; pnl: number; tradeCount: number; winRate: number }[];
  pnlByEntryQuality: { entryQuality: string; pnl: number; tradeCount: number; winRate: number }[];
  monthlyPnl: { month: string; pnl: number; wins: number; losses: number }[];
  bestTrade: { pnl: number; date: string; underlying: string; name: string } | null;
  worstTrade: { pnl: number; date: string; underlying: string; name: string } | null;
  avgWin: number | null;
  avgLoss: number | null;
  profitFactor: number;
  avgHoldDays: number | null;
}

export interface PortfolioSummary {
  openTrades: number;
  closedTrades: number;
  realizedPnl: number;
  winRate: number;
  totalFees: number;
  followedPlanRate: number;
}

// --- Reflections ---

export type ReflectionType = 'success' | 'lesson' | 'mistake';

export interface Reflection {
  id: string;
  tradeId: string;
  type: ReflectionType;
  content: string;
  createdAt: string;
  updatedAt: string;
  // Joined fields (when fetched via /api/reflections)
  underlying?: string;
  assetType?: string;
}

export interface InsightFeedItem {
  id: string;
  type: 'hypothesis' | 'success' | 'lesson' | 'mistake';
  content: string;
  date: string;
  tradeId: string;
  underlying: string;
  assetType: string;
  strategy: string;
  status: string;
  realizedPnl: number;
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
