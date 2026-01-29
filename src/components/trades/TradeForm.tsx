import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { Trade, TradeFormData } from '../../types';

interface TradeFormProps {
  trade?: Trade | null;
  initialData?: Partial<TradeFormData>;
  isClosing?: boolean;
  onClose: () => void;
}

export default function TradeForm({ trade, initialData, isClosing, onClose }: TradeFormProps) {
  const { createTrade, updateTrade, fetchTrades } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<TradeFormData>({
    assetType: trade?.assetType || initialData?.assetType || 'crypto',
    symbol: trade?.symbol || initialData?.symbol || '',
    side: trade?.side || initialData?.side || 'buy',
    entryDate: trade?.entryDate?.split('T')[0] || new Date().toISOString().split('T')[0],
    entryPrice: trade?.entryPrice || 0,
    quantity: trade?.quantity || initialData?.quantity || 0,
    stopLoss: trade?.stopLoss || null,
    takeProfit: trade?.takeProfit || null,
    hypothesis: trade?.hypothesis || '',
    notes: trade?.notes || '',
    linkedTradeId: initialData?.linkedTradeId || null,
  });

  useEffect(() => {
    // Close modal on escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (trade && !isClosing) {
        await updateTrade(trade.id, {
          ...trade,
          ...formData,
        });
      } else {
        await createTrade(formData);
      }
      await fetchTrades();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'number'
          ? value === ''
            ? null
            : parseFloat(value)
          : value,
    }));
  };

  const title = isClosing
    ? 'Close Position'
    : trade
    ? 'Edit Trade'
    : 'New Trade';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {isClosing && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
              Creating a sell order to close your {formData.symbol} position.
            </div>
          )}

          {/* Asset Type & Symbol */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Asset Type
              </label>
              <select
                name="assetType"
                value={formData.assetType}
                onChange={handleChange}
                disabled={isClosing}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="crypto">Crypto</option>
                <option value="stock">Stock</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Symbol
              </label>
              <input
                type="text"
                name="symbol"
                value={formData.symbol}
                onChange={handleChange}
                disabled={isClosing}
                placeholder="e.g., BTC, AAPL"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 uppercase"
                required
              />
            </div>
          </div>

          {/* Side & Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Side
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => !isClosing && setFormData((prev) => ({ ...prev, side: 'buy' }))}
                  disabled={isClosing}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                    formData.side === 'buy'
                      ? 'bg-green-100 text-green-700 border-2 border-green-500'
                      : 'bg-gray-100 text-gray-600 border-2 border-transparent'
                  } ${isClosing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Buy
                </button>
                <button
                  type="button"
                  onClick={() => !isClosing && setFormData((prev) => ({ ...prev, side: 'sell' }))}
                  disabled={isClosing && formData.side === 'buy'}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                    formData.side === 'sell'
                      ? 'bg-red-100 text-red-700 border-2 border-red-500'
                      : 'bg-gray-100 text-gray-600 border-2 border-transparent'
                  }`}
                >
                  Sell
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isClosing ? 'Exit Date' : 'Entry Date'}
              </label>
              <input
                type="date"
                name="entryDate"
                value={formData.entryDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Price & Quantity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isClosing ? 'Exit Price' : 'Entry Price'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  name="entryPrice"
                  value={formData.entryPrice || ''}
                  onChange={handleChange}
                  step="any"
                  min="0"
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity
              </label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity || ''}
                onChange={handleChange}
                step="any"
                min="0"
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Stop Loss & Take Profit (only for buys) */}
          {formData.side === 'buy' && !isClosing && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stop Loss (optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    name="stopLoss"
                    value={formData.stopLoss || ''}
                    onChange={handleChange}
                    step="any"
                    min="0"
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Take Profit (optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    name="takeProfit"
                    value={formData.takeProfit || ''}
                    onChange={handleChange}
                    step="any"
                    min="0"
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Hypothesis */}
          {!isClosing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hypothesis / Trade Thesis
              </label>
              <textarea
                name="hypothesis"
                value={formData.hypothesis}
                onChange={handleChange}
                rows={3}
                placeholder="Why are you making this trade? What's your thesis?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
              placeholder="Additional notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Total Value Preview */}
          {formData.entryPrice > 0 && formData.quantity > 0 && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Value</span>
                <span className="font-medium text-gray-900">
                  ${(formData.entryPrice * formData.quantity).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 px-4 py-2 rounded-lg text-white font-medium ${
                isClosing
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              } disabled:opacity-50`}
            >
              {loading ? 'Saving...' : isClosing ? 'Close Position' : trade ? 'Update Trade' : 'Add Trade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
