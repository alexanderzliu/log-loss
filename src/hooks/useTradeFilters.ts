import { useMemo, useCallback, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Trade } from '../types';
import { getDerivedOptionType, getTradeDate, isDateInRange } from '../utils/tradeFilters';

export type StatusFilter = 'all' | 'planned' | 'open' | 'closed';
export type SortField = 'date' | 'pnl';

export function useTradeFilters(trades: Trade[]) {
  const [searchParams, setSearchParams] = useSearchParams();

  // --- Filter state ---
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [strategyFilter, setStrategyFilter] = useState('');
  const [assetTypeFilter, setAssetTypeFilter] = useState('');
  const [entryQualityFilter, setEntryQualityFilter] = useState('');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [optionTypeFilter, setOptionTypeFilter] = useState('');
  const [sideFilter, setSideFilter] = useState('');
  const [followedPlanFilter, setFollowedPlanFilter] = useState('');

  // --- Sort state ---
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // --- Cross-page navigation from URL params ---
  const highlightTradeId = searchParams.get('highlight') || '';

  // Read URL params on mount
  useEffect(() => {
    const dateParam = searchParams.get('date');
    const highlightParam = searchParams.get('highlight');

    if (dateParam) {
      setDateFrom(dateParam);
      setDateTo(dateParam);
    }

    // When highlighting a specific trade, clear all filters so it's guaranteed visible
    if (highlightParam) {
      setStatusFilter('all');
      setSearch('');
      setStrategyFilter('');
      setAssetTypeFilter('');
      setEntryQualityFilter('');
      setTagFilter([]);
      setDateFrom('');
      setDateTo('');
      setOptionTypeFilter('');
      setSideFilter('');
      setFollowedPlanFilter('');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Bidirectional URL sync for date params ---
  const updateDateRange = useCallback((from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (from && to && from === to) {
        next.set('date', from);
      } else if (from || to) {
        if (from) next.set('dateFrom', from);
        else next.delete('dateFrom');
        if (to) next.set('dateTo', to);
        else next.delete('dateTo');
        next.delete('date');
      } else {
        next.delete('date');
        next.delete('dateFrom');
        next.delete('dateTo');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // --- Sort handler ---
  const handleSort = useCallback((field: string) => {
    const f = field as SortField;
    if (sortField === f) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(f);
      setSortDir('desc');
    }
  }, [sortField]);

  // --- Available filter options (derived from data) ---
  const filterOptions = useMemo(() => {
    const strategies = new Set<string>();
    const assetTypes = new Set<string>();
    const tags = new Set<string>();
    const entryQualities = new Set<string>();
    const optionTypes = new Set<string>();
    const sides = new Set<string>();

    for (const t of trades) {
      if (t.strategy) strategies.add(t.strategy);
      if (t.assetType) assetTypes.add(t.assetType);
      if (t.entryQuality) entryQualities.add(t.entryQuality);
      if (t.side) sides.add(t.side);
      for (const tag of t.tags) tags.add(tag.tag);
      const ot = getDerivedOptionType(t.legs);
      if (ot) optionTypes.add(ot);
    }

    return {
      strategies: Array.from(strategies).sort(),
      assetTypes: Array.from(assetTypes).sort(),
      tags: Array.from(tags).sort(),
      entryQualities: Array.from(entryQualities).sort(),
      optionTypes: Array.from(optionTypes).sort(),
      sides: Array.from(sides).sort(),
    };
  }, [trades]);

  // --- Active filter count ---
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (strategyFilter) count++;
    if (assetTypeFilter) count++;
    if (entryQualityFilter) count++;
    if (optionTypeFilter) count++;
    if (sideFilter) count++;
    if (followedPlanFilter) count++;
    if (dateFrom || dateTo) count++;
    count += tagFilter.length;
    return count;
  }, [strategyFilter, assetTypeFilter, entryQualityFilter, optionTypeFilter, sideFilter, followedPlanFilter, dateFrom, dateTo, tagFilter]);

  // --- Clear all ---
  const clearAllFilters = useCallback(() => {
    setStrategyFilter('');
    setAssetTypeFilter('');
    setEntryQualityFilter('');
    setTagFilter([]);
    setOptionTypeFilter('');
    setSideFilter('');
    setFollowedPlanFilter('');
    updateDateRange('', '');
  }, [updateDateRange]);

  // --- Status counts ---
  const statusCounts = useMemo(() => ({
    all: trades.length,
    planned: trades.filter((t) => t.status === 'planned').length,
    open: trades.filter((t) => t.status === 'open').length,
    closed: trades.filter((t) => t.status === 'closed').length,
  }), [trades]);

  // --- Filtered trades ---
  const filteredTrades = useMemo(() => trades.filter((trade) => {
    if (statusFilter !== 'all' && trade.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!trade.underlying.toLowerCase().includes(q) && !trade.name.toLowerCase().includes(q)) return false;
    }
    if (strategyFilter && trade.strategy !== strategyFilter) return false;
    if (assetTypeFilter && trade.assetType !== assetTypeFilter) return false;
    if (entryQualityFilter && trade.entryQuality !== entryQualityFilter) return false;
    if (tagFilter.length > 0) {
      const tradeTags = trade.tags.map((t) => t.tag);
      if (!tagFilter.every((f) => tradeTags.includes(f))) return false;
    }
    if ((dateFrom || dateTo) && !isDateInRange(getTradeDate(trade), dateFrom || null, dateTo || null)) return false;
    if (optionTypeFilter && getDerivedOptionType(trade.legs) !== optionTypeFilter) return false;
    if (sideFilter && trade.side !== sideFilter) return false;
    if (followedPlanFilter) {
      const expected = followedPlanFilter === 'yes';
      if (trade.followedPlan !== expected) return false;
    }
    return true;
  }), [trades, statusFilter, search, strategyFilter, assetTypeFilter, entryQualityFilter, tagFilter, dateFrom, dateTo, optionTypeFilter, sideFilter, followedPlanFilter]);

  // --- Sorted trades ---
  const sortedTrades = useMemo(() => {
    const sorted = [...filteredTrades];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'date':
          cmp = new Date(a.openDate ?? a.createdAt).getTime() - new Date(b.openDate ?? b.createdAt).getTime();
          break;
        case 'pnl':
          cmp = (a.realizedPnl ?? 0) - (b.realizedPnl ?? 0);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredTrades, sortField, sortDir]);

  return {
    // Filter state + setters
    statusFilter, setStatusFilter,
    search, setSearch,
    strategyFilter, setStrategyFilter,
    assetTypeFilter, setAssetTypeFilter,
    entryQualityFilter, setEntryQualityFilter,
    tagFilter, setTagFilter,
    dateFrom, dateTo, updateDateRange,
    optionTypeFilter, setOptionTypeFilter,
    sideFilter, setSideFilter,
    followedPlanFilter, setFollowedPlanFilter,

    // Sort
    sortField, sortDir, handleSort,

    // Derived
    filteredTrades,
    sortedTrades,
    filterOptions,
    statusCounts,
    activeFilterCount,
    clearAllFilters,

    // Cross-page
    highlightTradeId,
  };
}
