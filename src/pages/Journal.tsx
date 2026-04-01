import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { Plus, Search, SlidersHorizontal } from 'lucide-react';
import TradeList from '../components/trades/TradeList';
import TradeForm from '../components/trades/TradeForm';
import FilterPills from '../components/FilterPills';
import PageTransition from '../components/PageTransition';
import { FilterDropdown, TagFilterSelect } from '../components/FilterControls';
import type { Trade } from '../types';

export default function Journal() {
  const { trades, tradesLoading, fetchTrades } = useStore(useShallow((s) => ({
    trades: s.trades,
    tradesLoading: s.tradesLoading,
    fetchTrades: s.fetchTrades,
  })));
  const [showForm, setShowForm] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [closingTrade, setClosingTrade] = useState<Trade | null>(null);
  const [filter, setFilter] = useState<'all' | 'planned' | 'open' | 'closed'>('all');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'date' | 'underlying' | 'pnl'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [strategyFilter, setStrategyFilter] = useState('');
  const [assetTypeFilter, setAssetTypeFilter] = useState('');
  const [entryQualityFilter, setEntryQualityFilter] = useState('');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const filterOptions = useMemo(() => {
    const strategies = new Set<string>();
    const assetTypes = new Set<string>();
    const tags = new Set<string>();
    const entryQualities = new Set<string>();
    for (const t of trades) {
      if (t.strategy) strategies.add(t.strategy);
      if (t.assetType) assetTypes.add(t.assetType);
      if (t.entryQuality) entryQualities.add(t.entryQuality);
      for (const tag of t.tags) tags.add(tag.tag);
    }
    return {
      strategies: Array.from(strategies).sort(),
      assetTypes: Array.from(assetTypes).sort(),
      tags: Array.from(tags).sort(),
      entryQualities: Array.from(entryQualities).sort(),
    };
  }, [trades]);

  const activeFilterCount = [strategyFilter, assetTypeFilter, entryQualityFilter].filter(Boolean).length + tagFilter.length;

  const clearAllFilters = () => {
    setStrategyFilter('');
    setAssetTypeFilter('');
    setEntryQualityFilter('');
    setTagFilter([]);
  };

  const filteredTrades = useMemo(() => trades.filter((trade) => {
    if (filter === 'planned' && trade.status !== 'planned') return false;
    if (filter === 'open' && trade.status !== 'open') return false;
    if (filter === 'closed' && trade.status !== 'closed') return false;
    if (search) {
      const q = search.toLowerCase();
      if (!trade.underlying.toLowerCase().includes(q) && !trade.name.toLowerCase().includes(q)) return false;
    }
    if (strategyFilter && trade.strategy !== strategyFilter) return false;
    if (assetTypeFilter && trade.assetType !== assetTypeFilter) return false;
    if (entryQualityFilter && trade.entryQuality !== entryQualityFilter) return false;
    if (tagFilter.length > 0) {
      const tradeTags = trade.tags.map(t => t.tag);
      if (!tagFilter.every(f => tradeTags.includes(f))) return false;
    }
    return true;
  }), [trades, filter, search, strategyFilter, assetTypeFilter, entryQualityFilter, tagFilter]);

  const sortedTrades = useMemo(() => {
    const sorted = [...filteredTrades];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'date': cmp = new Date(a.openDate ?? a.createdAt).getTime() - new Date(b.openDate ?? b.createdAt).getTime(); break;
        case 'underlying': cmp = a.underlying.localeCompare(b.underlying); break;
        case 'pnl': cmp = (a.realizedPnl ?? 0) - (b.realizedPnl ?? 0); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredTrades, sortField, sortDir]);

  const handleNewTrade = () => {
    setEditingTrade(null);
    setClosingTrade(null);
    setShowForm(true);
  };

  const handleEditTrade = (trade: Trade) => {
    setEditingTrade(trade);
    setClosingTrade(null);
    setShowForm(true);
  };

  const handleCloseTrade = (trade: Trade) => {
    setEditingTrade(null);
    setClosingTrade(trade);
    setShowForm(true);
  };

  const handleOpenTrade = async (trade: Trade) => {
    try {
      await useStore.getState().openTrade(trade.id, {
        openDate: new Date().toISOString(),
      });
    } catch {
      useStore.getState().addToast({ type: 'error', title: 'Failed to open trade' });
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingTrade(null);
    setClosingTrade(null);
  };

  const plannedCount = useMemo(() => trades.filter(t => t.status === 'planned').length, [trades]);
  const openCount = useMemo(() => trades.filter(t => t.status === 'open').length, [trades]);
  const closedCount = useMemo(() => trades.filter(t => t.status === 'closed').length, [trades]);

  return (
    <PageTransition>
    <div className="page-container" style={{ position: 'relative', overflow: 'visible' }}>
      {/* Atmospheric gradient orbs */}
      <div style={{
        position: 'absolute',
        top: '-120px',
        right: '-80px',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-200px',
        left: '-100px',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.05) 0%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Header */}
      <div className="flex justify-between items-center mb-10" style={{ position: 'relative', zIndex: 1 }}>
        <div>
          <h1 className="page-header">Journal</h1>
          <p className="page-subtitle">Track and manage your trades</p>
        </div>
        <button onClick={handleNewTrade} className="btn-primary" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 2px 12px var(--accent-glow), 0 0 40px rgba(16, 185, 129, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
        }}>
          <Plus size={18} />
          New Trade
        </button>
      </div>

      {/* Filters and Search - Glass Card */}
      <div style={{
        background: 'var(--gradient-card)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '28px',
        position: 'relative',
        zIndex: 1,
      }}>
        <FilterPills
          options={[
            { key: 'all', label: 'All', count: trades.length },
            { key: 'planned', label: 'Planned', count: plannedCount },
            { key: 'open', label: 'Open', count: openCount },
            { key: 'closed', label: 'Closed', count: closedCount },
          ]}
          active={filter}
          onChange={(key) => setFilter(key as typeof filter)}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Filters toggle */}
          <button
            onClick={() => setShowFilters(v => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: showFilters ? 'var(--accent-soft)' : 'transparent',
              border: showFilters ? '1px solid var(--border-accent)' : '1px solid var(--border)',
              borderRadius: '10px',
              padding: '7px 12px',
              color: showFilters ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s ease',
            }}
          >
            <SlidersHorizontal size={14} />
            Filters
            {activeFilterCount > 0 && (
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '0 5px',
                borderRadius: '9999px',
                background: 'var(--accent)',
                color: '#000',
                lineHeight: '16px',
              }}>
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Search */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '8px 14px',
            minWidth: '200px',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          }}>
            <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search trades..."
              className="journal-search-input"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
                width: '100%',
                padding: 0,
              }}
            />
          </div>
        </div>
      </div>

      {/* Collapsible filter row */}
      {showFilters && (
        <div style={{
          background: 'var(--gradient-card)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-card)',
          padding: '14px 20px',
          marginBottom: '28px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
          animation: 'slideUp 0.2s ease-out both',
        }}>
          <FilterDropdown
            label="Strategy"
            value={strategyFilter}
            options={filterOptions.strategies}
            onChange={setStrategyFilter}
            formatLabel={(s) => s.replace(/_/g, ' ')}
          />
          <FilterDropdown
            label="Asset Type"
            value={assetTypeFilter}
            options={filterOptions.assetTypes}
            onChange={setAssetTypeFilter}
          />
          <FilterDropdown
            label="Entry Quality"
            value={entryQualityFilter}
            options={filterOptions.entryQualities}
            onChange={setEntryQualityFilter}
          />
          <TagFilterSelect
            selected={tagFilter}
            options={filterOptions.tags}
            onChange={setTagFilter}
          />
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--text-muted)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                padding: '4px 8px',
                borderRadius: '6px',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
      {tradesLoading ? (
        <div className="card empty-state">
          <p className="empty-state-text">Loading...</p>
        </div>
      ) : (
        <TradeList
          trades={sortedTrades}
          onEdit={handleEditTrade}
          onClose={handleCloseTrade}
          onOpen={handleOpenTrade}
          onDelete={(id: string) => useStore.getState().deleteTrade(id)}
          sortField={sortField}
          sortDir={sortDir}
          onSort={(field) => handleSort(field as typeof sortField)}
        />
      )}

      </div>

      {/* Trade Form Modal */}
      {showForm && (
        <TradeForm
          trade={editingTrade || closingTrade}
          mode={closingTrade ? 'close' : editingTrade ? 'edit' : 'create'}
          onClose={handleFormClose}
        />
      )}
    </div>
    </PageTransition>
  );
}
