import { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Shield, Target, Zap } from 'lucide-react';
import { useStore } from '../../store/useStore';
import TokenSearch from './TokenSearch';
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
    chain: position?.chain ?? null,
    contractAddress: position?.contractAddress ?? null,
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

  const totalValue = formData.price && formData.quantity ? formData.price * formData.quantity : 0;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-6"
      style={{
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'overlayIn 0.25s ease-out',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-[520px] max-h-[85vh] overflow-hidden flex flex-col"
        style={{
          background: 'var(--bg-surface)',
          borderRadius: '20px',
          border: '1px solid var(--border-light)',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.03)',
          animation: 'modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Accent bar */}
        <div style={{
          height: '3px',
          background: isClosing
            ? 'linear-gradient(90deg, var(--loss), transparent)'
            : 'linear-gradient(90deg, var(--accent), rgba(16, 185, 129, 0.1))',
          borderRadius: '20px 20px 0 0',
        }} />

        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{ padding: '20px 24px 16px' }}
        >
          <div className="flex items-center gap-3">
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: isClosing
                ? 'rgba(239, 68, 68, 0.1)'
                : 'var(--accent-glow)',
              border: `1px solid ${isClosing ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.15)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {isClosing ? (
                <TrendingDown size={18} style={{ color: 'var(--loss)' }} />
              ) : (
                <Zap size={18} style={{ color: 'var(--accent)' }} />
              )}
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>{title}</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {isClosing ? `Selling ${formData.symbol}` : isEditing ? `Editing ${formData.symbol}` : 'Enter your position details'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.borderColor = 'var(--border-light)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'var(--bg-elevated)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            <X size={14} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1" style={{ padding: '0 24px 24px' }}>
          {error && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              fontSize: '13px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
              color: 'var(--loss)',
              marginBottom: '16px',
            }}>
              {error}
            </div>
          )}

          {isClosing && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              fontSize: '13px',
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.15)',
              color: '#60a5fa',
              marginBottom: '16px',
            }}>
              Creating a sell order to close your {formData.symbol} position.
            </div>
          )}

          {isEditing ? (
            <div className="flex flex-col" style={{ gap: '16px' }}>
              {/* Stop Loss & Take Profit */}
              <FieldSection label="Risk Management" icon={<Shield size={12} />}>
                <div className="grid grid-cols-2 gap-3">
                  <FieldGroup label="Stop Loss">
                    <PrefixInput
                      prefix="$"
                      type="number"
                      name="stopLoss"
                      value={formData.stopLoss || ''}
                      onChange={handleChange}
                      step="any"
                      min="0"
                      placeholder="0.00"
                    />
                  </FieldGroup>
                  <FieldGroup label="Take Profit">
                    <PrefixInput
                      prefix="$"
                      type="number"
                      name="takeProfit"
                      value={formData.takeProfit || ''}
                      onChange={handleChange}
                      step="any"
                      min="0"
                      placeholder="0.00"
                    />
                  </FieldGroup>
                </div>
              </FieldSection>

              <FieldSection label="Thesis" icon={<Target size={12} />}>
                <FieldGroup label="Hypothesis / Trade Thesis">
                  <textarea
                    name="hypothesis"
                    value={formData.hypothesis}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Why are you making this trade?"
                    className="w-full resize-none"
                  />
                </FieldGroup>
                <FieldGroup label="Notes">
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={2}
                    placeholder="Additional notes..."
                    className="w-full resize-none"
                  />
                </FieldGroup>
              </FieldSection>
            </div>
          ) : (
            <div className="flex flex-col" style={{ gap: '16px' }}>
              {/* Market Section */}
              <FieldSection label="Market" icon={<TrendingUp size={12} />}>
                <div className="grid grid-cols-2 gap-3">
                  <FieldGroup label="Asset Type">
                    {/* Segmented control */}
                    <div style={{
                      display: 'flex',
                      gap: '2px',
                      padding: '3px',
                      borderRadius: '10px',
                      background: 'rgba(26, 26, 36, 0.6)',
                      border: '1px solid var(--border)',
                    }}>
                      {(['crypto', 'stock'] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => !isClosing && setFormData((prev) => ({
                            ...prev,
                            assetType: type,
                            chain: type === 'stock' ? null : prev.chain,
                            contractAddress: type === 'stock' ? null : prev.contractAddress,
                          }))}
                          disabled={isClosing}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 500,
                            fontFamily: 'inherit',
                            border: 'none',
                            cursor: isClosing ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s ease',
                            background: formData.assetType === type
                              ? 'var(--bg-hover)'
                              : 'transparent',
                            color: formData.assetType === type
                              ? 'var(--text-primary)'
                              : 'var(--text-muted)',
                            boxShadow: formData.assetType === type
                              ? '0 1px 3px rgba(0,0,0,0.2)'
                              : 'none',
                          }}
                        >
                          {type === 'crypto' ? 'Crypto' : 'Stock'}
                        </button>
                      ))}
                    </div>
                  </FieldGroup>
                  <FieldGroup label="Symbol">
                    {formData.assetType === 'crypto' && !isClosing ? (
                      <TokenSearch
                        value={formData.symbol}
                        chain={formData.chain ?? null}
                        contractAddress={formData.contractAddress ?? null}
                        disabled={isClosing}
                        onChange={({ symbol, chain, contractAddress }) => {
                          setFormData((prev) => ({ ...prev, symbol, chain, contractAddress }));
                        }}
                      />
                    ) : (
                      <input
                        type="text"
                        name="symbol"
                        value={formData.symbol}
                        onChange={handleChange}
                        disabled={isClosing}
                        placeholder={formData.assetType === 'stock' ? 'e.g., AAPL' : 'e.g., BTC'}
                        className="w-full uppercase disabled:opacity-50"
                        required
                      />
                    )}
                  </FieldGroup>
                </div>
              </FieldSection>

              {/* Order Section */}
              <FieldSection label="Order" icon={<Zap size={12} />}>
                {/* Buy / Sell toggle */}
                <div style={{
                  display: 'flex',
                  gap: '3px',
                  padding: '3px',
                  borderRadius: '10px',
                  background: 'rgba(26, 26, 36, 0.6)',
                  border: '1px solid var(--border)',
                }}>
                  <button
                    type="button"
                    onClick={() => !isClosing && setFormData((prev) => ({ ...prev, side: 'buy' }))}
                    disabled={isClosing}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      letterSpacing: '0.3px',
                      border: 'none',
                      cursor: isClosing ? 'not-allowed' : 'pointer',
                      opacity: isClosing ? 0.5 : 1,
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      background: formData.side === 'buy'
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'transparent',
                      color: formData.side === 'buy'
                        ? 'var(--profit)'
                        : 'var(--text-muted)',
                      boxShadow: formData.side === 'buy'
                        ? 'inset 0 0 0 1px rgba(16, 185, 129, 0.25)'
                        : 'none',
                    }}
                  >
                    <TrendingUp size={14} />
                    Buy
                  </button>
                  <button
                    type="button"
                    onClick={() => !isClosing && setFormData((prev) => ({ ...prev, side: 'sell' }))}
                    disabled={isClosing}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      letterSpacing: '0.3px',
                      border: 'none',
                      cursor: isClosing ? 'not-allowed' : 'pointer',
                      opacity: isClosing ? 0.5 : 1,
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      background: formData.side === 'sell'
                        ? 'rgba(239, 68, 68, 0.15)'
                        : 'transparent',
                      color: formData.side === 'sell'
                        ? 'var(--loss)'
                        : 'var(--text-muted)',
                      boxShadow: formData.side === 'sell'
                        ? 'inset 0 0 0 1px rgba(239, 68, 68, 0.25)'
                        : 'none',
                    }}
                  >
                    <TrendingDown size={14} />
                    Sell
                  </button>
                </div>

                <FieldGroup label={isClosing ? 'Exit Date' : 'Entry Date'}>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    className="w-full"
                    required
                  />
                </FieldGroup>

                <div className="grid grid-cols-2 gap-3">
                  <FieldGroup label={isClosing ? 'Exit Price' : 'Entry Price'}>
                    <PrefixInput
                      prefix="$"
                      type="number"
                      name="price"
                      value={formData.price || ''}
                      onChange={handleChange}
                      step="any"
                      min="0"
                      placeholder="0.00"
                      required
                    />
                  </FieldGroup>
                  <FieldGroup label="Quantity">
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
                  </FieldGroup>
                </div>

                {/* Total value inline */}
                {totalValue > 0 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total</span>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'DM Mono', monospace" }}>
                      ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </FieldSection>

              {/* Risk Management (only for new buys) */}
              {formData.side === 'buy' && !isClosing && (
                <FieldSection label="Risk Management" icon={<Shield size={12} />}>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldGroup label="Stop Loss" optional>
                      <PrefixInput
                        prefix="$"
                        type="number"
                        name="stopLoss"
                        value={formData.stopLoss || ''}
                        onChange={handleChange}
                        step="any"
                        min="0"
                        placeholder="0.00"
                      />
                    </FieldGroup>
                    <FieldGroup label="Take Profit" optional>
                      <PrefixInput
                        prefix="$"
                        type="number"
                        name="takeProfit"
                        value={formData.takeProfit || ''}
                        onChange={handleChange}
                        step="any"
                        min="0"
                        placeholder="0.00"
                      />
                    </FieldGroup>
                  </div>
                </FieldSection>
              )}

              {/* Thesis */}
              <FieldSection label="Thesis" icon={<Target size={12} />}>
                {!isClosing && (
                  <FieldGroup label="Hypothesis">
                    <textarea
                      name="hypothesis"
                      value={formData.hypothesis}
                      onChange={handleChange}
                      rows={2}
                      placeholder="Why are you making this trade?"
                      className="w-full resize-none"
                    />
                  </FieldGroup>
                )}
                <FieldGroup label="Notes">
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={2}
                    placeholder="Additional notes..."
                    className="w-full resize-none"
                  />
                </FieldGroup>
              </FieldSection>
            </div>
          )}

          {/* Actions */}
          <div
            className="flex gap-3"
            style={{ paddingTop: '20px', marginTop: '20px', borderTop: '1px solid var(--border)' }}
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
              style={isClosing ? {
                background: 'linear-gradient(135deg, var(--loss) 0%, #dc2626 100%)',
                boxShadow: '0 2px 12px rgba(239, 68, 68, 0.2)',
              } : {}}
            >
              {loading ? 'Saving...' : isClosing ? 'Close Position' : isEditing ? 'Update Position' : 'Add Trade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


/* ---------- Subcomponents ---------- */

function FieldSection({ label, icon, children }: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      padding: '14px',
      borderRadius: '14px',
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        color: 'var(--text-muted)',
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
      }}>
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

function FieldGroup({ label, optional, children }: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="block mb-1.5"
        style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}
      >
        {label}
        {optional && (
          <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '4px' }}>
            (opt)
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

function PrefixInput({ prefix, ...props }: { prefix: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span
        className="absolute left-3.5 top-1/2 -translate-y-1/2"
        style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}
      >
        {prefix}
      </span>
      <input
        {...props}
        className={`w-full ${props.className || ''}`}
        style={{ paddingLeft: '28px', ...props.style }}
      />
    </div>
  );
}
