import { create } from 'zustand';
import type { Trade, PriceData, PortfolioSummary, AssetType } from '../types';
import * as tradesApi from '../api/trades';
import * as pricesApi from '../api/prices';

// Extract unique assets from open buy positions
function getUniqueOpenAssets(trades: Trade[]): { symbol: string; assetType: AssetType }[] {
  const openBuys = trades.filter((t) => t.status === 'open' && t.side === 'buy');
  const assets = openBuys.map((t) => ({ symbol: t.symbol, assetType: t.assetType }));
  return Array.from(
    new Map(assets.map((a) => [`${a.symbol}-${a.assetType}`, a])).values()
  );
}

interface StoreState {
  // Trades
  trades: Trade[];
  tradesLoading: boolean;
  tradesError: string | null;

  // Prices
  prices: Record<string, PriceData>;
  pricesLoading: boolean;
  pricesError: string | null;

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
  pricesError: null,
  portfolioSummary: null,
  portfolioLoading: false,

  // Trades actions
  fetchTrades: async (filters) => {
    set({ tradesLoading: true, tradesError: null });
    try {
      const trades = await tradesApi.fetchTrades(filters);
      set({ trades, tradesLoading: false });

      // Auto-fetch prices for open positions
      const uniqueAssets = getUniqueOpenAssets(trades);
      if (uniqueAssets.length > 0) {
        get().fetchPrices(uniqueAssets);
      }
    } catch (error) {
      set({ tradesError: (error as Error).message, tradesLoading: false });
    }
  },

  createTrade: async (data) => {
    const { trade, linkedTrade } = await tradesApi.createTrade(data);
    set((state) => {
      let updatedTrades = [trade, ...state.trades];
      // If we closed a position, update the linked trade in the list
      if (linkedTrade) {
        updatedTrades = updatedTrades.map((t) =>
          t.id === linkedTrade.id ? linkedTrade : t
        );
      }
      return { trades: updatedTrades };
    });
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
      // Remove the trade and any trades linked to it (backend deletes both)
      trades: state.trades.filter((t) => t.id !== id && t.linkedTradeId !== id),
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
    const uniqueAssets = getUniqueOpenAssets(get().trades);
    if (uniqueAssets.length > 0) {
      await get().fetchPrices(uniqueAssets);
    }
  },
}));
