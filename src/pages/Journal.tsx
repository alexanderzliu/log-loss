import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { Plus, List, LayoutGrid, Search } from 'lucide-react';
import ExecutionList from '../components/trades/ExecutionList';
import PositionList from '../components/trades/PositionList';
import TradeForm from '../components/trades/TradeForm';
import FilterPills from '../components/FilterPills';
import PageTransition from '../components/PageTransition';
import { calculateUnrealizedPnl } from '../utils/aggregatePositions';
import { priceKey as getPriceKey } from '../utils/priceKey';
import type { Position } from '../types';

export default function Journal() {
  const { positions, positionsLoading, fetchPositions, prices } = useStore(useShallow((s) => ({
    positions: s.positions,
    positionsLoading: s.positionsLoading,
    fetchPositions: s.fetchPositions,
    prices: s.prices,
  })));
  const [showForm, setShowForm] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [closingPosition, setClosingPosition] = useState<Position | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [viewMode, setViewMode] = useState<'positions' | 'executions'>('positions');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'date' | 'symbol' | 'pnl' | 'costBasis'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const filteredPositions = useMemo(() => positions.filter((pos) => {
    if (filter === 'open' && pos.status !== 'open') return false;
    if (filter === 'closed' && pos.status !== 'closed') return false;
    if (search && !pos.symbol.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [positions, filter, search]);

  const getDisplayPnl = (pos: Position): number => {
    if (pos.status === 'open') {
      const pk = getPriceKey(pos);
      const currentPrice = prices[pk]?.price;
      const { pnl } = calculateUnrealizedPnl(pos, currentPrice);
      return pnl ?? 0;
    }
    return pos.realizedPnl || 0;
  };

  const sortedPositions = useMemo(() => {
    const sorted = [...filteredPositions];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'date': cmp = new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime(); break;
        case 'symbol': cmp = a.symbol.localeCompare(b.symbol); break;
        case 'pnl': cmp = getDisplayPnl(a) - getDisplayPnl(b); break;
        case 'costBasis': {
          const aCost = a.avgEntryPrice * (a.status === 'open' ? a.remainingQuantity : a.totalQuantity);
          const bCost = b.avgEntryPrice * (b.status === 'open' ? b.remainingQuantity : b.totalQuantity);
          cmp = aCost - bCost;
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredPositions, sortField, sortDir, prices]);

  const handleNewTrade = () => {
    setEditingPosition(null);
    setClosingPosition(null);
    setShowForm(true);
  };

  const handleEditPosition = (position: Position) => {
    setEditingPosition(position);
    setClosingPosition(null);
    setShowForm(true);
  };

  const handleClosePosition = (position: Position) => {
    setEditingPosition(null);
    setClosingPosition(position);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingPosition(null);
    setClosingPosition(null);
  };

  const openCount = useMemo(() => positions.filter(p => p.status === 'open').length, [positions]);
  const closedCount = useMemo(() => positions.filter(p => p.status === 'closed').length, [positions]);

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
          <p className="page-subtitle">Track and manage your positions</p>
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

      {/* Filters, Search, and View Toggle - Glass Card */}
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
            { key: 'all', label: 'All', count: positions.length },
            { key: 'open', label: 'Open', count: openCount },
            { key: 'closed', label: 'Closed', count: closedCount },
          ]}
          active={filter}
          onChange={(key) => setFilter(key as typeof filter)}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
              placeholder="Search symbol..."
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

          {/* View Toggle */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-tertiary)',
            borderRadius: '12px',
            padding: '4px',
            gap: '4px',
          }}>
            <button
              onClick={() => setViewMode('positions')}
              title="Positions view"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '32px',
                borderRadius: '10px',
                border: 'none',
                background: viewMode === 'positions' ? 'var(--bg-elevated)' : 'transparent',
                color: viewMode === 'positions' ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('executions')}
              title="Executions view"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '32px',
                borderRadius: '10px',
                border: 'none',
                background: viewMode === 'executions' ? 'var(--bg-elevated)' : 'transparent',
                color: viewMode === 'executions' ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
      {positionsLoading ? (
        <div className="card empty-state">
          <p className="empty-state-text">Loading...</p>
        </div>
      ) : viewMode === 'positions' ? (
        <PositionList
          positions={sortedPositions}
          onEdit={handleEditPosition}
          onClosePosition={handleClosePosition}
          sortField={sortField}
          sortDir={sortDir}
          onSort={(field) => handleSort(field as typeof sortField)}
        />
      ) : (
        <ExecutionList positions={sortedPositions} />
      )}

      </div>

      {/* Trade Form Modal */}
      {showForm && (
        <TradeForm
          position={editingPosition || closingPosition}
          isClosing={!!closingPosition}
          isEditing={!!editingPosition}
          onClose={handleFormClose}
        />
      )}
    </div>
    </PageTransition>
  );
}
