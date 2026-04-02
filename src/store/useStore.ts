import { create } from 'zustand';
import type { Trade, TradeCreateData, TradeUpdateData, TradeCloseData, PriceData, PortfolioSummary, Prediction, PredictionFormData, PredictionCloseData, PredictionUpdateData, PredictionsSummary, Reflection, Rule, ChartSnapshot } from '../types';
import * as tradesApi from '../api/trades';
import * as pricesApi from '../api/prices';
import * as predictionsApi from '../api/predictions';
import * as reflectionsApi from '../api/reflections';
import * as rulesApi from '../api/rules';
import * as snapshotsApi from '../api/snapshots';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

interface StoreState {
  // Toasts
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;

  // Trades
  trades: Trade[];
  tradesLoading: boolean;
  tradesError: string | null;

  // Prices (kept for Analytics chart)
  prices: Record<string, PriceData>;
  pricesLoading: boolean;
  pricesError: string | null;

  // Portfolio
  portfolioSummary: PortfolioSummary | null;
  portfolioLoading: boolean;
  portfolioError: string | null;

  // Predictions
  predictions: Prediction[];
  predictionsLoading: boolean;
  predictionsError: string | null;
  predictionsSummary: PredictionsSummary | null;
  predictionsSummaryLoading: boolean;
  predictionsSummaryError: string | null;

  // Reflections (keyed by tradeId)
  reflections: Record<string, Reflection[]>;
  fetchReflections: (tradeId: string) => Promise<void>;
  createReflection: (data: { tradeId: string; type?: Reflection['type']; content: string }) => Promise<Reflection>;
  updateReflection: (id: string, data: { content?: string; type?: Reflection['type'] }) => Promise<Reflection>;
  deleteReflection: (id: string, tradeId: string) => Promise<void>;

  // Trade Actions
  fetchTrades: (filters?: { status?: string; assetType?: string; underlying?: string }) => Promise<void>;
  createTrade: (data: TradeCreateData) => Promise<Trade>;
  updateTrade: (id: string, data: TradeUpdateData) => Promise<Trade>;
  closeTrade: (id: string, data: TradeCloseData) => Promise<Trade>;
  openTrade: (id: string, data?: { entryPrice?: number; openDate?: string; fees?: number }) => Promise<Trade>;
  deleteTrade: (id: string) => Promise<void>;
  fetchPortfolioSummary: () => Promise<void>;

  // Price Actions (for Analytics)
  fetchPrices: (assets: { symbol: string; assetType: string }[]) => Promise<void>;

  // Prediction Actions
  fetchPredictions: (filters?: { status?: string }) => Promise<void>;
  createPrediction: (data: PredictionFormData) => Promise<Prediction>;
  updatePrediction: (id: string, data: PredictionUpdateData) => Promise<Prediction>;
  closePrediction: (id: string, data: PredictionCloseData) => Promise<Prediction>;
  deletePrediction: (id: string) => Promise<void>;
  fetchPredictionsSummary: () => Promise<void>;

  // Chart Snapshots (keyed by tradeId)
  chartSnapshots: Record<string, ChartSnapshot[]>;
  chartSnapshotsLoading: Record<string, boolean>;
  fetchChartSnapshots: (tradeId: string) => Promise<void>;
  captureChartSnapshots: (tradeId: string, tradeDate?: string) => Promise<void>;
  deleteChartSnapshot: (tradeId: string, snapshotId: string) => Promise<void>;

  // Rules
  rules: Rule[];
  rulesLoading: boolean;
  fetchRules: () => Promise<void>;
  addRule: (content: string) => Promise<Rule>;
  updateRule: (id: string, content: string) => Promise<Rule>;
  deleteRule: (id: string) => Promise<void>;
}

export const useStore = create<StoreState>((set, get) => ({
  // Toasts
  toasts: [],
  addToast: (toast) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    setTimeout(() => get().removeToast(id), 4000);
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  // Initial state
  trades: [],
  tradesLoading: false,
  tradesError: null,
  prices: {},
  pricesLoading: false,
  pricesError: null,
  portfolioSummary: null,
  portfolioLoading: false,
  portfolioError: null,
  predictions: [],
  predictionsLoading: false,
  predictionsError: null,
  predictionsSummary: null,
  predictionsSummaryLoading: false,
  predictionsSummaryError: null,
  reflections: {},

  // Reflections
  fetchReflections: async (tradeId) => {
    try {
      const list = await reflectionsApi.fetchReflections({ tradeId });
      set((state) => ({ reflections: { ...state.reflections, [tradeId]: list } }));
    } catch (error) {
      console.error('Failed to fetch reflections:', error);
    }
  },

  createReflection: async (data) => {
    const reflection = await reflectionsApi.createReflection(data);
    set((state) => {
      const existing = state.reflections[data.tradeId] || [];
      return { reflections: { ...state.reflections, [data.tradeId]: [reflection, ...existing] } };
    });
    get().addToast({ type: 'success', title: 'Reflection Added' });
    return reflection;
  },

  updateReflection: async (id, data) => {
    const reflection = await reflectionsApi.updateReflection(id, data);
    set((state) => {
      const tradeId = reflection.tradeId;
      const existing = state.reflections[tradeId] || [];
      return { reflections: { ...state.reflections, [tradeId]: existing.map((r) => (r.id === id ? reflection : r)) } };
    });
    get().addToast({ type: 'success', title: 'Reflection Updated' });
    return reflection;
  },

  deleteReflection: async (id, tradeId) => {
    await reflectionsApi.deleteReflection(id);
    set((state) => {
      const existing = state.reflections[tradeId] || [];
      return { reflections: { ...state.reflections, [tradeId]: existing.filter((r) => r.id !== id) } };
    });
    get().addToast({ type: 'success', title: 'Reflection Deleted' });
  },

  // Trade actions
  fetchTrades: async (filters) => {
    set({ tradesLoading: true, tradesError: null });
    try {
      const trades = await tradesApi.fetchTrades(filters);
      set({ trades, tradesLoading: false });
    } catch (error) {
      set({ tradesError: (error as Error).message, tradesLoading: false });
    }
  },

  createTrade: async (data) => {
    const trade = await tradesApi.createTrade(data);
    set((state) => ({ trades: [trade, ...state.trades] }));
    get().fetchPortfolioSummary();
    get().addToast({ type: 'success', title: 'Trade Created', message: `${data.underlying} ${data.strategy}` });
    return trade;
  },

  updateTrade: async (id, data) => {
    const trade = await tradesApi.updateTrade(id, data);
    set((state) => ({
      trades: state.trades.map((t) => (t.id === id ? trade : t)),
    }));
    return trade;
  },

  closeTrade: async (id, data) => {
    const trade = await tradesApi.closeTrade(id, data);
    set((state) => ({
      trades: state.trades.map((t) => (t.id === id ? trade : t)),
    }));
    get().fetchPortfolioSummary();
    get().addToast({ type: 'success', title: 'Trade Closed', message: `P&L: $${data.realizedPnl.toFixed(2)}` });
    return trade;
  },

  openTrade: async (id, data) => {
    const trade = await tradesApi.openTrade(id, data);
    set((state) => ({
      trades: state.trades.map((t) => (t.id === id ? trade : t)),
    }));
    get().addToast({ type: 'success', title: 'Trade Opened' });
    return trade;
  },

  deleteTrade: async (id) => {
    await tradesApi.deleteTrade(id);
    set((state) => ({ trades: state.trades.filter((t) => t.id !== id) }));
    get().fetchPortfolioSummary();
    get().addToast({ type: 'success', title: 'Trade Deleted' });
  },

  fetchPortfolioSummary: async () => {
    set({ portfolioLoading: true, portfolioError: null });
    try {
      const summary = await tradesApi.fetchPortfolioSummary();
      set({ portfolioSummary: summary, portfolioLoading: false });
    } catch (error) {
      set({ portfolioError: (error as Error).message, portfolioLoading: false });
    }
  },

  // Prices (for Analytics chart only)
  fetchPrices: async (assets) => {
    if (assets.length === 0) return;
    set({ pricesLoading: true, pricesError: null });
    try {
      const priceData = await pricesApi.fetchPricesBatch(assets);
      const pricesMap = { ...get().prices };
      priceData.forEach((p) => {
        if (!('error' in p)) {
          pricesMap[`${p.symbol}:${p.assetType}`] = p;
        }
      });
      set({ prices: pricesMap, pricesLoading: false });
    } catch (error) {
      set({ pricesLoading: false, pricesError: (error as Error).message });
    }
  },

  // Prediction actions
  fetchPredictions: async (filters) => {
    set({ predictionsLoading: true, predictionsError: null });
    try {
      const predictions = await predictionsApi.fetchPredictions(filters);
      set({ predictions, predictionsLoading: false });
    } catch (error) {
      set({ predictionsError: (error as Error).message, predictionsLoading: false });
    }
  },

  createPrediction: async (data) => {
    const prediction = await predictionsApi.createPrediction(data);
    set((state) => ({ predictions: [prediction, ...state.predictions] }));
    get().fetchPredictionsSummary();
    return prediction;
  },

  updatePrediction: async (id, data) => {
    const prediction = await predictionsApi.updatePrediction(id, data);
    set((state) => ({
      predictions: state.predictions.map((p) => (p.id === id ? prediction : p)),
    }));
    return prediction;
  },

  closePrediction: async (id, data) => {
    const prediction = await predictionsApi.closePrediction(id, data);
    set((state) => ({
      predictions: state.predictions.map((p) => (p.id === id ? prediction : p)),
    }));
    get().fetchPredictionsSummary();
    get().addToast({ type: 'success', title: 'Prediction Closed', message: prediction.market });
    return prediction;
  },

  deletePrediction: async (id) => {
    await predictionsApi.deletePrediction(id);
    set((state) => ({
      predictions: state.predictions.filter((p) => p.id !== id),
    }));
    get().fetchPredictionsSummary();
    get().addToast({ type: 'success', title: 'Prediction Deleted' });
  },

  fetchPredictionsSummary: async () => {
    set({ predictionsSummaryLoading: true, predictionsSummaryError: null });
    try {
      const summary = await predictionsApi.fetchPredictionsSummary();
      set({ predictionsSummary: summary, predictionsSummaryLoading: false });
    } catch (error) {
      set({ predictionsSummaryError: (error as Error).message, predictionsSummaryLoading: false });
    }
  },

  // Chart Snapshots
  chartSnapshots: {},
  chartSnapshotsLoading: {},

  fetchChartSnapshots: async (tradeId) => {
    // Skip if already loading
    if (get().chartSnapshotsLoading[tradeId]) return;
    set((state) => ({ chartSnapshotsLoading: { ...state.chartSnapshotsLoading, [tradeId]: true } }));
    try {
      const snapshots = await snapshotsApi.fetchSnapshots(tradeId);
      set((state) => ({
        chartSnapshots: { ...state.chartSnapshots, [tradeId]: snapshots },
        chartSnapshotsLoading: { ...state.chartSnapshotsLoading, [tradeId]: false },
      }));
    } catch (error) {
      console.error('Failed to fetch chart snapshots:', error);
      set((state) => ({ chartSnapshotsLoading: { ...state.chartSnapshotsLoading, [tradeId]: false } }));
    }
  },

  captureChartSnapshots: async (tradeId, tradeDate) => {
    set((state) => ({ chartSnapshotsLoading: { ...state.chartSnapshotsLoading, [tradeId]: true } }));
    try {
      const result = await snapshotsApi.captureSnapshots(tradeId, { tradeDate });
      set((state) => ({
        chartSnapshots: { ...state.chartSnapshots, [tradeId]: result.snapshots },
        chartSnapshotsLoading: { ...state.chartSnapshotsLoading, [tradeId]: false },
      }));
      const total = result.status.captured.length + result.status.theoretical.length;
      if (total > 0) {
        get().addToast({ type: 'success', title: 'Chart Data Captured', message: `${total} snapshot${total > 1 ? 's' : ''} saved` });
      }
      if (result.status.failed.length > 0) {
        get().addToast({ type: 'info', title: 'Some captures failed', message: result.status.failed.join(', ') });
      }
    } catch (error) {
      console.error('Failed to capture chart snapshots:', error);
      set((state) => ({ chartSnapshotsLoading: { ...state.chartSnapshotsLoading, [tradeId]: false } }));
      get().addToast({ type: 'error', title: 'Capture Failed', message: (error as Error).message });
    }
  },

  deleteChartSnapshot: async (tradeId, snapshotId) => {
    await snapshotsApi.deleteSnapshot(tradeId, snapshotId);
    set((state) => {
      const existing = state.chartSnapshots[tradeId] || [];
      return { chartSnapshots: { ...state.chartSnapshots, [tradeId]: existing.filter((s) => s.id !== snapshotId) } };
    });
  },

  // Rules
  rules: [],
  rulesLoading: false,

  fetchRules: async () => {
    set({ rulesLoading: true });
    try {
      const rules = await rulesApi.fetchRules();
      set({ rules, rulesLoading: false });
    } catch (error) {
      console.error('Failed to fetch rules:', error);
      set({ rulesLoading: false });
    }
  },

  addRule: async (content) => {
    const rule = await rulesApi.createRule(content);
    set((state) => ({ rules: [...state.rules, rule] }));
    get().addToast({ type: 'success', title: 'Rule Added' });
    return rule;
  },

  updateRule: async (id, content) => {
    const rule = await rulesApi.updateRule(id, content);
    set((state) => ({
      rules: state.rules.map((r) => (r.id === id ? rule : r)),
    }));
    get().addToast({ type: 'success', title: 'Rule Updated' });
    return rule;
  },

  deleteRule: async (id) => {
    await rulesApi.deleteRule(id);
    set((state) => ({
      rules: state.rules.filter((r) => r.id !== id),
    }));
    get().addToast({ type: 'success', title: 'Rule Deleted' });
  },
}));
