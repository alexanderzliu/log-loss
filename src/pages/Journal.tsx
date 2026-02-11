import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { Plus, List, LayoutGrid, Search } from 'lucide-react';
import ExecutionList from '../components/trades/ExecutionList';
import PositionList from '../components/trades/PositionList';
import TradeForm from '../components/trades/TradeForm';
import FilterPills from '../components/FilterPills';
import PageTransition from '../components/PageTransition';
import type { Position } from '../types';

export default function Journal() {
  const { positions, positionsLoading, fetchPositions } = useStore(useShallow((s) => ({
    positions: s.positions,
    positionsLoading: s.positionsLoading,
    fetchPositions: s.fetchPositions,
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

  const sortedPositions = useMemo(() => {
    const sorted = [...filteredPositions];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'date': cmp = new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime(); break;
        case 'symbol': cmp = a.symbol.localeCompare(b.symbol); break;
        case 'pnl': cmp = (a.realizedPnl || 0) - (b.realizedPnl || 0); break;
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
  }, [filteredPositions, sortField, sortDir]);

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
    <div className="page-container">
      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="page-header">Journal</h1>
          <p className="page-subtitle">Track and manage your positions</p>
        </div>
        <button onClick={handleNewTrade} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} />
          New Trade
        </button>
      </div>

      {/* Filters, Search, and View Toggle */}
      <div className="flex justify-between items-center mb-7">
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
          }}>
            <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search symbol..."
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
