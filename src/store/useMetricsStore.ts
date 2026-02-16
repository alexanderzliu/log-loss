import { create } from 'zustand';
import type { TokenMetrics, DerivativesResult, DerivativeWindow, SnapshotHistoryPoint } from '../types';
import * as metricsApi from '../api/metrics';

interface CachedData<T> {
  data: T;
  fetchedAt: number;
}

interface MetricsState {
  // Token metrics keyed by "chain:address"
  metrics: Record<string, TokenMetrics>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;

  // Derivatives keyed by "chain:address:window"
  derivatives: Record<string, CachedData<DerivativesResult>>;
  derivativesLoading: Record<string, boolean>;

  // Snapshot history keyed by "chain:address:hours"
  history: Record<string, CachedData<SnapshotHistoryPoint[]>>;
  historyLoading: Record<string, boolean>;

  fetchMetrics: (chain: string, address: string) => Promise<void>;
  getMetrics: (chain: string, address: string) => TokenMetrics | undefined;
  fetchDerivatives: (chain: string, address: string, window?: DerivativeWindow) => Promise<void>;
  fetchHistory: (chain: string, address: string, hours?: number) => Promise<void>;
}

function metricsKey(chain: string, address: string): string {
  return `${chain}:${address}`;
}

function derivativesKey(chain: string, address: string, window: DerivativeWindow): string {
  return `${chain}:${address}:${window}`;
}

function historyKey(chain: string, address: string, hours: number): string {
  return `${chain}:${address}:${hours}`;
}

const DERIVATIVES_TTL = 60_000; // 1 minute
const HISTORY_TTL = 5 * 60_000; // 5 minutes

export const useMetricsStore = create<MetricsState>((set, get) => ({
  metrics: {},
  loading: {},
  errors: {},
  derivatives: {},
  derivativesLoading: {},
  history: {},
  historyLoading: {},

  fetchMetrics: async (chain, address) => {
    const key = metricsKey(chain, address);
    if (get().loading[key]) return;

    set((state) => ({
      loading: { ...state.loading, [key]: true },
      errors: { ...state.errors, [key]: null },
    }));

    try {
      const data = await metricsApi.fetchTokenMetrics(chain, address);
      set((state) => ({
        metrics: { ...state.metrics, [key]: data },
        loading: { ...state.loading, [key]: false },
      }));
    } catch (error) {
      set((state) => ({
        loading: { ...state.loading, [key]: false },
        errors: { ...state.errors, [key]: (error as Error).message },
      }));
    }
  },

  getMetrics: (chain, address) => {
    const key = metricsKey(chain, address);
    return get().metrics[key];
  },

  fetchDerivatives: async (chain, address, window = '1h') => {
    const key = derivativesKey(chain, address, window);
    const existing = get().derivatives[key];
    if (existing && Date.now() - existing.fetchedAt < DERIVATIVES_TTL) return;
    if (get().derivativesLoading[key]) return;

    set((state) => ({
      derivativesLoading: { ...state.derivativesLoading, [key]: true },
    }));

    try {
      const data = await metricsApi.fetchDerivatives(chain, address, window);
      set((state) => ({
        derivatives: { ...state.derivatives, [key]: { data, fetchedAt: Date.now() } },
        derivativesLoading: { ...state.derivativesLoading, [key]: false },
      }));
    } catch {
      set((state) => ({
        derivativesLoading: { ...state.derivativesLoading, [key]: false },
      }));
    }
  },

  fetchHistory: async (chain, address, hours = 24) => {
    const key = historyKey(chain, address, hours);
    const existing = get().history[key];
    if (existing && Date.now() - existing.fetchedAt < HISTORY_TTL) return;
    if (get().historyLoading[key]) return;

    set((state) => ({
      historyLoading: { ...state.historyLoading, [key]: true },
    }));

    try {
      const data = await metricsApi.fetchSnapshotHistory(chain, address, hours);
      set((state) => ({
        history: { ...state.history, [key]: { data, fetchedAt: Date.now() } },
        historyLoading: { ...state.historyLoading, [key]: false },
      }));
    } catch {
      set((state) => ({
        historyLoading: { ...state.historyLoading, [key]: false },
      }));
    }
  },
}));
