import { create } from 'zustand';
import type { Position, PriceData, PortfolioSummary, AssetType, TradeFormData, PositionUpdateData } from '../types';
import * as positionsApi from '../api/positions';
import * as pricesApi from '../api/prices';

// Extract unique assets from open positions
function getUniqueOpenAssets(positions: Position[]): { symbol: string; assetType: AssetType }[] {
  const open = positions.filter((p) => p.status === 'open');
  const assets = open.map((p) => ({ symbol: p.symbol, assetType: p.assetType }));
  return Array.from(
    new Map(assets.map((a) => [`${a.symbol}-${a.assetType}`, a])).values()
  );
}

interface StoreState {
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

  // Actions
  fetchPositions: (filters?: { status?: string; assetType?: string; symbol?: string }) => Promise<void>;
  createTrade: (data: TradeFormData) => Promise<Position>;
  updatePosition: (id: string, data: PositionUpdateData) => Promise<Position>;
  deletePosition: (id: string) => Promise<void>;
  deleteExecution: (positionId: string, executionId: string) => Promise<void>;
  fetchPortfolioSummary: () => Promise<void>;
  fetchPrices: (assets: { symbol: string; assetType: 'crypto' | 'stock' }[]) => Promise<void>;
  refreshPrices: () => Promise<void>;
}

export const useStore = create<StoreState>((set, get) => ({
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
        // Update existing position (scaled in or partial close)
        return { positions: state.positions.map((p) => (p.id === position.id ? position : p)) };
      }
      // New position
      return { positions: [position, ...state.positions] };
    });
    get().fetchPortfolioSummary();
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

  // Prices actions
  fetchPrices: async (assets) => {
    if (assets.length === 0) return;
    set({ pricesLoading: true, pricesError: null });
    try {
      const priceData = await pricesApi.fetchPricesBatch(assets);
      const pricesMap = { ...get().prices };
      priceData.forEach((p) => {
        if (!('error' in p)) {
          pricesMap[`${p.symbol}-${p.assetType}`] = p;
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
}));
