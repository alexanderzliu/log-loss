import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { Plus, Filter } from 'lucide-react';
import TradeList from '../components/trades/TradeList';
import TradeForm from '../components/trades/TradeForm';
import type { Trade, TradeFormData } from '../types';

export default function Journal() {
  const { trades, tradesLoading, fetchTrades } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [closingTrade, setClosingTrade] = useState<Trade | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [assetFilter, setAssetFilter] = useState<'all' | 'crypto' | 'stock'>('all');

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const filteredTrades = trades.filter((trade) => {
    if (filter === 'open' && trade.status !== 'open') return false;
    if (filter === 'closed' && trade.status !== 'closed') return false;
    if (assetFilter !== 'all' && trade.assetType !== assetFilter) return false;
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
      return {
        assetType: closingTrade.assetType,
        symbol: closingTrade.symbol,
        side: 'sell',
        quantity: closingTrade.quantity,
        linkedTradeId: closingTrade.id,
      };
    }
    return undefined;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trade Journal</h1>
          <p className="text-gray-500 mt-1">Track and manage your trades</p>
        </div>
        <button
          onClick={handleNewTrade}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          New Trade
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <span className="text-sm text-gray-500">Filter:</span>
        </div>
        <div className="flex gap-2">
          {(['all', 'open', 'closed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filter === f
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="h-6 w-px bg-gray-200" />
        <div className="flex gap-2">
          {(['all', 'crypto', 'stock'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setAssetFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                assetFilter === f
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {f === 'all' ? 'All Assets' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Trade List */}
      {tradesLoading ? (
        <div className="text-center py-12 text-gray-500">Loading trades...</div>
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
