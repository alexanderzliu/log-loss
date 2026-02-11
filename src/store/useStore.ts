import { create } from 'zustand';
import type { Position, PriceData, PortfolioSummary, AssetType, TradeFormData, PositionUpdateData, Prediction, PredictionFormData, PredictionCloseData, PredictionUpdateData, PredictionsSummary, RecentActivity } from '../types';
import * as positionsApi from '../api/positions';
import * as pricesApi from '../api/prices';
import * as predictionsApi from '../api/predictions';
import { priceKey } from '../utils/priceKey';

// Extract unique assets from open positions
function getUniqueOpenAssets(positions: Position[]): { symbol: string; assetType: AssetType; chain?: string | null; contractAddress?: string | null }[] {
  const open = positions.filter((p) => p.status === 'open');
  const assets = open.map((p) => ({ symbol: p.symbol, assetType: p.assetType, chain: p.chain, contractAddress: p.contractAddress }));
  return Array.from(
    new Map(assets.map((a) => [priceKey(a), a])).values()
  );
}

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

  // Positions
  positions: Position[];
  positionsLoading: boolean;
  positionsError: string | null;

  // Prices
  prices: Record<string, PriceData>;
  pricesLoading: boolean;
  pricesError: string | null;

  // Portfolio
  portfolioSummary: PortfolioSummary | null;
  portfolioLoading: boolean;
  portfolioError: string | null;

  // Recent Activity
  recentActivity: RecentActivity[];
  recentActivityLoading: boolean;

  // Predictions
  predictions: Prediction[];
  predictionsLoading: boolean;
  predictionsError: string | null;
  predictionsSummary: PredictionsSummary | null;
  predictionsSummaryLoading: boolean;
  predictionsSummaryError: string | null;

  // Position Actions
  fetchPositions: (filters?: { status?: string; assetType?: string; symbol?: string }) => Promise<void>;
  createTrade: (data: TradeFormData) => Promise<Position>;
  updatePosition: (id: string, data: PositionUpdateData) => Promise<Position>;
  deletePosition: (id: string) => Promise<void>;
  deleteExecution: (positionId: string, executionId: string) => Promise<void>;
  fetchPortfolioSummary: () => Promise<void>;
  fetchRecentActivity: () => Promise<void>;
  fetchPrices: (assets: { symbol: string; assetType: AssetType; chain?: string | null; contractAddress?: string | null }[]) => Promise<void>;
  refreshPrices: () => Promise<void>;

  // Prediction Actions
  fetchPredictions: (filters?: { status?: string }) => Promise<void>;
  createPrediction: (data: PredictionFormData) => Promise<Prediction>;
  updatePrediction: (id: string, data: PredictionUpdateData) => Promise<Prediction>;
  closePrediction: (id: string, data: PredictionCloseData) => Promise<Prediction>;
  deletePrediction: (id: string) => Promise<void>;
  fetchPredictionsSummary: () => Promise<void>;
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
  positions: [],
  positionsLoading: false,
  positionsError: null,
  prices: {},
  pricesLoading: false,
  pricesError: null,
  portfolioSummary: null,
  portfolioLoading: false,
  portfolioError: null,
  recentActivity: [],
  recentActivityLoading: false,
  predictions: [],
  predictionsLoading: false,
  predictionsError: null,
  predictionsSummary: null,
  predictionsSummaryLoading: false,
  predictionsSummaryError: null,

  // Positions actions
  fetchPositions: async (filters) => {
    set({ positionsLoading: true, positionsError: null });
    try {
      const positions = await positionsApi.fetchPositions(filters);
      set({ positions, positionsLoading: false });

      // Auto-fetch prices for open positions
      const uniqueAssets = getUniqueOpenAssets(positions);
      if (uniqueAssets.length > 0) {
        get().fetchPrices(uniqueAssets);
      }
    } catch (error) {
      set({ positionsError: (error as Error).message, positionsLoading: false });
    }
  },

  createTrade: async (data) => {
    const { position } = await positionsApi.createTrade(data);
    set((state) => {
      const exists = state.positions.some((p) => p.id === position.id);
      if (exists) {
        return { positions: state.positions.map((p) => (p.id === position.id ? position : p)) };
      }
      return { positions: [position, ...state.positions] };
    });
    get().fetchPortfolioSummary();
    get().addToast({ type: 'success', title: 'Trade Created', message: `${data.side === 'sell' ? 'Sold' : 'Bought'} ${data.symbol}` });
    return position;
  },

  updatePosition: async (id, data) => {
    const position = await positionsApi.updatePosition(id, data);
    set((state) => ({
      positions: state.positions.map((p) => (p.id === id ? position : p)),
    }));
    return position;
  },

  deletePosition: async (id) => {
    await positionsApi.deletePosition(id);
    set((state) => ({
      positions: state.positions.filter((p) => p.id !== id),
    }));
    get().fetchPortfolioSummary();
    get().addToast({ type: 'success', title: 'Position Deleted' });
  },

  deleteExecution: async (positionId, executionId) => {
    const { position } = await positionsApi.deleteExecution(positionId, executionId);
    set((state) => {
      if (!position) {
        // Position was deleted (no executions left)
        return { positions: state.positions.filter((p) => p.id !== positionId) };
      }
      return { positions: state.positions.map((p) => (p.id === positionId ? position : p)) };
    });
    get().fetchPortfolioSummary();
  },

  fetchPortfolioSummary: async () => {
    set({ portfolioLoading: true, portfolioError: null });
    try {
      const summary = await positionsApi.fetchPortfolioSummary();
      set({ portfolioSummary: summary, portfolioLoading: false });
    } catch (error) {
      set({ portfolioError: (error as Error).message, portfolioLoading: false });
    }
  },

  fetchRecentActivity: async () => {
    set({ recentActivityLoading: true });
    try {
      const activity = await positionsApi.fetchRecentActivity();
      set({ recentActivity: activity, recentActivityLoading: false });
    } catch {
      set({ recentActivityLoading: false });
    }
  },

  // Prices actions
  fetchPrices: async (assets) => {
    if (assets.length === 0) return;
    set({ pricesLoading: true, pricesError: null });
    try {
      const priceData = await pricesApi.fetchPricesBatch(assets);
      const pricesMap = { ...get().prices };
      priceData.forEach((p) => {
        if (!('error' in p)) {
          pricesMap[priceKey(p)] = p;
        }
      });
      set({ prices: pricesMap, pricesLoading: false });
    } catch (error) {
      set({ pricesLoading: false, pricesError: (error as Error).message });
    }
  },

  refreshPrices: async () => {
    const uniqueAssets = getUniqueOpenAssets(get().positions);
    if (uniqueAssets.length > 0) {
      await get().fetchPrices(uniqueAssets);
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
}));
