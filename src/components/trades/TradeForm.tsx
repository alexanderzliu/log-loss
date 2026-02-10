import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { Position, TradeFormData, PositionUpdateData } from '../../types';

interface TradeFormProps {
  position?: Position | null;
  isClosing?: boolean;
  isEditing?: boolean;
  onClose: () => void;
}

export default function TradeForm({ position, isClosing, isEditing, onClose }: TradeFormProps) {
  const { createTrade, updatePosition, fetchPositions } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<TradeFormData>({
    assetType: position?.assetType || 'crypto',
    symbol: position?.symbol || '',
    side: isClosing ? 'sell' : 'buy',
    date: new Date().toISOString().split('T')[0],
    price: 0,
    quantity: isClosing ? (position?.remainingQuantity || 0) : 0,
    stopLoss: position?.stopLoss ?? null,
    takeProfit: position?.takeProfit ?? null,
    hypothesis: position?.hypothesis || '',
    notes: isEditing ? (position?.notes || '') : '',
    positionId: isClosing ? position?.id : undefined,
  });

  useEffect(() => {
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
      if (isEditing && position) {
        const updateData: PositionUpdateData = {
          stopLoss: formData.stopLoss,
          takeProfit: formData.takeProfit,
          hypothesis: formData.hypothesis,
          notes: formData.notes,
        };
        await updatePosition(position.id, updateData);
      } else {
        await createTrade(formData);
      }
      await fetchPositions();
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
    : isEditing
    ? 'Edit Position'
    : 'New Trade';

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-6"
      style={{
        background: 'rgba(0, 0, 0, 0.6)',
        animation: 'overlayIn 0.25s ease-out',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
        style={{
          background: 'var(--bg-surface)',
          borderRadius: '20px',
          border: '1px solid var(--border-light)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          animation: 'modalIn 0.3s ease-out',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: '20px 28px',
            borderBottom: '1px solid var(--border)',
            background: 'linear-gradient(180deg, var(--bg-elevated) 0%, transparent 100%)',
          }}
        >
          <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full transition-all duration-200"
            style={{
              background: 'var(--bg-hover)',
              border: '1px solid var(--border)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'var(--bg-elevated)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <X size={18} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto flex-1" style={{ padding: '24px 28px' }}>
          {error && (
            <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--loss)' }}>
              {error}
            </div>
          )}

          {isClosing && (
            <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}>
              Creating a sell order to close your {formData.symbol} position.
            </div>
          )}

          {/* Edit mode: only metadata fields */}
          {isEditing ? (
            <>
              {/* Stop Loss & Take Profit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Stop Loss
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>$</span>
                    <input
                      type="number"
                      name="stopLoss"
                      value={formData.stopLoss || ''}
                      onChange={handleChange}
                      step="any"
                      min="0"
                      placeholder="0.00"
                      className="w-full"
                      style={{ paddingLeft: '28px' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Take Profit
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>$</span>
                    <input
                      type="number"
                      name="takeProfit"
                      value={formData.takeProfit || ''}
                      onChange={handleChange}
                      step="any"
                      min="0"
                      placeholder="0.00"
                      className="w-full"
                      style={{ paddingLeft: '28px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Hypothesis */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Hypothesis / Trade Thesis
                </label>
                <textarea
                  name="hypothesis"
                  value={formData.hypothesis}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Why are you making this trade? What's your thesis?"
                  className="w-full resize-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Additional notes..."
                  className="w-full resize-none"
                />
              </div>
            </>
          ) : (
            <>
              {/* Asset Type & Symbol */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Asset Type
                  </label>
                  <select
                    name="assetType"
                    value={formData.assetType}
                    onChange={handleChange}
                    disabled={isClosing}
                    className="w-full disabled:opacity-50"
                  >
                    <option value="crypto">Crypto</option>
                    <option value="stock">Stock</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Symbol
                  </label>
                  <input
                    type="text"
                    name="symbol"
                    value={formData.symbol}
                    onChange={handleChange}
                    disabled={isClosing}
                    placeholder="e.g., BTC, AAPL"
                    className="w-full uppercase disabled:opacity-50"
                    required
                  />
                </div>
              </div>

              {/* Side & Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Side
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => !isClosing && setFormData((prev) => ({ ...prev, side: 'buy' }))}
                      disabled={isClosing}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '10px',
                        fontWeight: 500,
                        fontSize: '14px',
                        border: formData.side === 'buy' ? '2px solid var(--profit)' : '2px solid transparent',
                        background: formData.side === 'buy' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-elevated)',
                        color: formData.side === 'buy' ? 'var(--profit)' : 'var(--text-muted)',
                        cursor: isClosing ? 'not-allowed' : 'pointer',
                        opacity: isClosing ? 0.5 : 1,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      Buy
                    </button>
                    <button
                      type="button"
                      onClick={() => !isClosing && setFormData((prev) => ({ ...prev, side: 'sell' }))}
                      disabled={isClosing}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '10px',
                        fontWeight: 500,
                        fontSize: '14px',
                        border: formData.side === 'sell' ? '2px solid var(--loss)' : '2px solid transparent',
                        background: formData.side === 'sell' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-elevated)',
                        color: formData.side === 'sell' ? 'var(--loss)' : 'var(--text-muted)',
                        cursor: isClosing ? 'not-allowed' : 'pointer',
                        opacity: isClosing ? 0.5 : 1,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      Sell
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    {isClosing ? 'Exit Date' : 'Entry Date'}
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    className="w-full"
                    required
                  />
                </div>
              </div>

              {/* Price & Quantity */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    {isClosing ? 'Exit Price' : 'Entry Price'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>$</span>
                    <input
                      type="number"
                      name="price"
                      value={formData.price || ''}
                      onChange={handleChange}
                      step="any"
                      min="0"
                      placeholder="0.00"
                      className="w-full"
                      style={{ paddingLeft: '28px' }}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
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
                    className="w-full"
                    required
                  />
                </div>
              </div>

              {/* Stop Loss & Take Profit (only for new buys) */}
              {formData.side === 'buy' && !isClosing && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                      Stop Loss (optional)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>$</span>
                      <input
                        type="number"
                        name="stopLoss"
                        value={formData.stopLoss || ''}
                        onChange={handleChange}
                        step="any"
                        min="0"
                        placeholder="0.00"
                        className="w-full"
                        style={{ paddingLeft: '28px' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                      Take Profit (optional)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>$</span>
                      <input
                        type="number"
                        name="takeProfit"
                        value={formData.takeProfit || ''}
                        onChange={handleChange}
                        step="any"
                        min="0"
                        placeholder="0.00"
                        className="w-full"
                        style={{ paddingLeft: '28px' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Hypothesis (only for new buys) */}
              {!isClosing && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Hypothesis / Trade Thesis
                  </label>
                  <textarea
                    name="hypothesis"
                    value={formData.hypothesis}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Why are you making this trade? What's your thesis?"
                    className="w-full resize-none"
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Additional notes..."
                  className="w-full resize-none"
                />
              </div>

              {/* Total Value Preview */}
              {formData.price > 0 && formData.quantity > 0 && (
                <div className="p-4 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--text-muted)' }}>Total Value</span>
                    <span className="font-semibold" style={{ color: 'var(--text-primary)', fontFamily: "'DM Mono', monospace" }}>
                      ${(formData.price * formData.quantity).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Actions */}
          <div
            className="flex gap-3 pt-5 mt-2"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1"
              style={isClosing ? { background: 'linear-gradient(135deg, var(--loss) 0%, #dc2626 100%)', boxShadow: '0 2px 12px rgba(239, 68, 68, 0.2)' } : {}}
            >
              {loading ? 'Saving...' : isClosing ? 'Close Position' : isEditing ? 'Update Position' : 'Add Trade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
