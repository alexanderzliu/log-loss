import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { Plus, List, LayoutGrid } from 'lucide-react';
import ExecutionList from '../components/trades/ExecutionList';
import PositionList from '../components/trades/PositionList';
import TradeForm from '../components/trades/TradeForm';
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

  const filteredPositions = positions.filter((pos) => {
    if (filter === 'open' && pos.status !== 'open') return false;
    if (filter === 'closed' && pos.status !== 'closed') return false;
    return true;
  });

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

  const openCount = positions.filter(p => p.status === 'open').length;
  const closedCount = positions.filter(p => p.status === 'closed').length;

  return (
    <PageTransition>
    <div style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px', letterSpacing: '-0.5px' }}>
            Journal
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Track and manage your positions
          </p>
        </div>
        <button onClick={handleNewTrade} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} />
          New Trade
        </button>
      </div>

      {/* Filters and View Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { key: 'all', label: 'All', count: positions.length },
            { key: 'open', label: 'Open', count: openCount },
            { key: 'closed', label: 'Closed', count: closedCount },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as typeof filter)}
              style={{
                padding: '10px 18px',
                borderRadius: '9999px',
                border: filter === f.key ? '1px solid var(--border-accent)' : '1px solid transparent',
                background: filter === f.key ? 'var(--accent-soft)' : 'transparent',
                color: filter === f.key ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {f.label} <span style={{ opacity: 0.6, marginLeft: '4px' }}>{f.count}</span>
            </button>
          ))}
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

      {/* Content */}
      {positionsLoading ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
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
