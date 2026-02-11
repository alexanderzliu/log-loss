import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { Plus, List, LayoutGrid } from 'lucide-react';
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

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const filteredPositions = useMemo(() => positions.filter((pos) => {
    if (filter === 'open' && pos.status !== 'open') return false;
    if (filter === 'closed' && pos.status !== 'closed') return false;
    return true;
  }), [positions, filter]);

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

      {/* Filters and View Toggle */}
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

      {/* Content */}
      {positionsLoading ? (
        <div className="card empty-state">
          <p className="empty-state-text">Loading...</p>
        </div>
      ) : viewMode === 'positions' ? (
        <PositionList
          positions={filteredPositions}
          onEdit={handleEditPosition}
          onClosePosition={handleClosePosition}
        />
      ) : (
        <ExecutionList positions={filteredPositions} />
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
