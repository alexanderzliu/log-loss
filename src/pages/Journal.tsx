import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { Plus, Search } from 'lucide-react';
import TradeList from '../components/trades/TradeList';
import TradeForm from '../components/trades/TradeForm';
import FilterPills from '../components/FilterPills';
import PageTransition from '../components/PageTransition';
import { FilterDropdown, TagFilterSelect, DateRangeFilter, FilterToggleButton, FilterPanel } from '../components/FilterControls';
import { useTradeFilters, type StatusFilter } from '../hooks/useTradeFilters';
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
  const [showFilters, setShowFilters] = useState(false);

  const filters = useTradeFilters(trades);

  // Auto-expand filter panel when filters are active on mount (e.g. from URL params)
  useEffect(() => {
    if (filters.activeFilterCount > 0) setShowFilters(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

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

  const searchBox = (
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
        value={filters.search}
        onChange={(e) => filters.setSearch(e.target.value)}
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
  );

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

      {/* Filters and Search */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        marginBottom: '16px',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Top bar: always one compact row */}
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
        }}>
          <FilterPills
            options={[
              { key: 'all', label: 'All', count: filters.statusCounts.all },
              { key: 'planned', label: 'Planned', count: filters.statusCounts.planned },
              { key: 'open', label: 'Open', count: filters.statusCounts.open },
              { key: 'closed', label: 'Closed', count: filters.statusCounts.closed },
            ]}
            active={filters.statusFilter}
            onChange={(key) => filters.setStatusFilter(key as StatusFilter)}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FilterToggleButton
              activeCount={filters.activeFilterCount}
              isOpen={showFilters}
              onToggle={() => setShowFilters((v) => !v)}
            />
            {searchBox}
          </div>
        </div>

        {/* Expanded filter panel: separate section below */}
        <FilterPanel isOpen={showFilters}>
          {/* Row 1: Trade properties */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            <FilterDropdown
              label="Strategy"
              value={filters.strategyFilter}
              options={filters.filterOptions.strategies}
              onChange={filters.setStrategyFilter}
              formatLabel={(s) => s.replace(/_/g, ' ')}
            />
            <FilterDropdown
              label="Asset Type"
              value={filters.assetTypeFilter}
              options={filters.filterOptions.assetTypes}
              onChange={filters.setAssetTypeFilter}
            />
            <FilterDropdown
              label="Option Type"
              value={filters.optionTypeFilter}
              options={filters.filterOptions.optionTypes}
              onChange={filters.setOptionTypeFilter}
            />
            <FilterDropdown
              label="Side"
              value={filters.sideFilter}
              options={filters.filterOptions.sides}
              onChange={filters.setSideFilter}
            />
          </div>

          {/* Row 2: Quality, time, tags */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-start' }}>
            <FilterDropdown
              label="Entry Quality"
              value={filters.entryQualityFilter}
              options={filters.filterOptions.entryQualities}
              onChange={filters.setEntryQualityFilter}
            />
            <FilterDropdown
              label="Followed Plan"
              value={filters.followedPlanFilter}
              options={['yes', 'no']}
              onChange={filters.setFollowedPlanFilter}
            />
            <TagFilterSelect
              selected={filters.tagFilter}
              options={filters.filterOptions.tags}
              onChange={filters.setTagFilter}
            />
            <DateRangeFilter
              from={filters.dateFrom}
              to={filters.dateTo}
              onChange={filters.updateDateRange}
            />
            {filters.activeFilterCount > 0 && (
              <button
                onClick={filters.clearAllFilters}
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
                  alignSelf: 'center',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                Clear all
              </button>
            )}
          </div>
        </FilterPanel>
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
      {tradesLoading ? (
        <div className="card empty-state">
          <p className="empty-state-text">Loading...</p>
        </div>
      ) : (
        <TradeList
          trades={filters.sortedTrades}
          onEdit={handleEditTrade}
          onClose={handleCloseTrade}
          onOpen={handleOpenTrade}
          onDelete={(id: string) => useStore.getState().deleteTrade(id)}
          sortField={filters.sortField}
          sortDir={filters.sortDir}
          onSort={filters.handleSort}
          initialExpandedId={filters.highlightTradeId || undefined}
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
