import { create } from 'zustand';
import type { Trade, PriceData, PortfolioSummary } from '../types';
import * as tradesApi from '../api/trades';
import * as pricesApi from '../api/prices';

interface StoreState {
  // Trades
  trades: Trade[];
  tradesLoading: boolean;
  tradesError: string | null;

  // Prices
  prices: Record<string, PriceData>;
  pricesLoading: boolean;

  // Portfolio
  portfolioSummary: PortfolioSummary | null;
  portfolioLoading: boolean;

  // Actions
  fetchTrades: (filters?: { status?: string; assetType?: string; symbol?: string }) => Promise<void>;
  createTrade: (data: Parameters<typeof tradesApi.createTrade>[0]) => Promise<Trade>;
  updateTrade: (id: string, data: Partial<Trade>) => Promise<Trade>;
  deleteTrade: (id: string) => Promise<void>;
  fetchPortfolioSummary: () => Promise<void>;
  fetchPrices: (assets: { symbol: string; assetType: 'crypto' | 'stock' }[]) => Promise<void>;
  refreshPrices: () => Promise<void>;
}

export const useStore = create<StoreState>((set, get) => ({
  // Initial state
  trades: [],
  tradesLoading: false,
  tradesError: null,
  prices: {},
  pricesLoading: false,
  portfolioSummary: null,
  portfolioLoading: false,

  // Trades actions
  fetchTrades: async (filters) => {
    set({ tradesLoading: true, tradesError: null });
    try {
      const trades = await tradesApi.fetchTrades(filters);
      set({ trades, tradesLoading: false });

      // Auto-fetch prices for open positions
      const openTrades = trades.filter((t) => t.status === 'open' && t.side === 'buy');
      if (openTrades.length > 0) {
        const assets = openTrades.map((t) => ({ symbol: t.symbol, assetType: t.assetType }));
        // Deduplicate
        const uniqueAssets = Array.from(
          new Map(assets.map((a) => [`${a.symbol}-${a.assetType}`, a])).values()
        );
        get().fetchPrices(uniqueAssets);
      }
    } catch (error) {
      set({ tradesError: (error as Error).message, tradesLoading: false });
    }
  },

  createTrade: async (data) => {
    const trade = await tradesApi.createTrade(data);
    set((state) => ({ trades: [trade, ...state.trades] }));
    get().fetchPortfolioSummary();
    return trade;
  },

  updateTrade: async (id, data) => {
    const trade = await tradesApi.updateTrade(id, data);
    set((state) => ({
      trades: state.trades.map((t) => (t.id === id ? trade : t)),
    }));
    get().fetchPortfolioSummary();
    return trade;
  },

  deleteTrade: async (id) => {
    await tradesApi.deleteTrade(id);
    set((state) => ({
      trades: state.trades.filter((t) => t.id !== id),
    }));
    get().fetchPortfolioSummary();
  },

  fetchPortfolioSummary: async () => {
    set({ portfolioLoading: true });
    try {
      const summary = await tradesApi.fetchPortfolioSummary();
      set({ portfolioSummary: summary, portfolioLoading: false });
    } catch {
      set({ portfolioLoading: false });
    }
  },

  // Prices actions
  fetchPrices: async (assets) => {
    if (assets.length === 0) return;
    set({ pricesLoading: true });
    try {
      const priceData = await pricesApi.fetchPricesBatch(assets);
      const pricesMap = { ...get().prices };
      priceData.forEach((p) => {
        if (!('error' in p)) {
          pricesMap[`${p.symbol}-${p.assetType}`] = p;
        }
      });
      set({ prices: pricesMap, pricesLoading: false });
    } catch {
      set({ pricesLoading: false });
    }
  },

  refreshPrices: async () => {
    const { trades } = get();
    const openTrades = trades.filter((t) => t.status === 'open' && t.side === 'buy');
    if (openTrades.length > 0) {
      const assets = openTrades.map((t) => ({ symbol: t.symbol, assetType: t.assetType }));
      const uniqueAssets = Array.from(
        new Map(assets.map((a) => [`${a.symbol}-${a.assetType}`, a])).values()
      );
      await get().fetchPrices(uniqueAssets);
    }
  },
}));
