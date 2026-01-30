import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { Plus } from 'lucide-react';
import TradeList from '../components/trades/TradeList';
import TradeForm from '../components/trades/TradeForm';
import type { Trade, TradeFormData } from '../types';

export default function Journal() {
  const { trades, tradesLoading, fetchTrades } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [closingTrade, setClosingTrade] = useState<Trade | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const filteredTrades = trades.filter((trade) => {
    if (filter === 'open' && trade.status !== 'open') return false;
    if (filter === 'closed' && trade.status !== 'closed') return false;
    return true;
  });

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

  const handleClosePosition = (trade: Trade) => {
    setEditingTrade(null);
    setClosingTrade(trade);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingTrade(null);
    setClosingTrade(null);
  };

  const getInitialFormData = (): Partial<TradeFormData> | undefined => {
    if (closingTrade) {
      // Use remainingQuantity if available (for partial exits)
      const availableQty = closingTrade.remainingQuantity ?? closingTrade.quantity;
      return {
        assetType: closingTrade.assetType,
        symbol: closingTrade.symbol,
        side: 'sell',
        quantity: availableQty,
        linkedTradeId: closingTrade.id,
      };
    }
    return undefined;
  };

  const openCount = trades.filter(t => t.status === 'open').length;
  const closedCount = trades.filter(t => t.status === 'closed').length;

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Journal
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Track and manage your trades
          </p>
        </div>
        <button onClick={handleNewTrade} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} />
          New Trade
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '28px' }}>
        {[
          { key: 'all', label: 'All', count: trades.length },
          { key: 'open', label: 'Open', count: openCount },
          { key: 'closed', label: 'Closed', count: closedCount },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as typeof filter)}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: filter === f.key ? '1px solid var(--border-light)' : '1px solid transparent',
              background: filter === f.key ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
              color: filter === f.key ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s ease',
            }}
          >
            {f.label} <span style={{ opacity: 0.6, marginLeft: '4px' }}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Trade List */}
      {tradesLoading ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
        </div>
      ) : (
        <TradeList
          trades={filteredTrades}
          onEdit={handleEditTrade}
          onClosePosition={handleClosePosition}
        />
      )}

      {/* Trade Form Modal */}
      {showForm && (
        <TradeForm
          trade={editingTrade}
          initialData={getInitialFormData()}
          isClosing={!!closingTrade}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
}
