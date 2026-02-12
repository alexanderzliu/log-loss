import { useState } from 'react';
import { TrendingUp, TrendingDown, Shield, Target, Zap } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import TokenSearch from './TokenSearch';
import Modal from '../Modal';
import { FieldSection, FieldGroup, PrefixInput } from '../form';
import { priceKey as getPriceKey } from '../../utils/priceKey';
import type { Position, TradeFormData, PositionUpdateData } from '../../types';

interface TradeFormProps {
  position?: Position | null;
  isClosing?: boolean;
  isEditing?: boolean;
  onClose: () => void;
}

export default function TradeForm({ position, isClosing, isEditing, onClose }: TradeFormProps) {
  const { createTrade, updatePosition, prices } = useStore(useShallow((s) => ({
    createTrade: s.createTrade,
    updatePosition: s.updatePosition,
    prices: s.prices,
  })));
  const currentPrice = position ? prices[getPriceKey(position)]?.price : undefined;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialPrice = isClosing && currentPrice ? currentPrice : 0;

  const [formData, setFormData] = useState<TradeFormData>({
    assetType: position?.assetType || 'crypto',
    symbol: position?.symbol || '',
    side: isClosing ? 'sell' : 'buy',
    date: new Date().toISOString().split('T')[0],
    price: initialPrice,
    quantity: isClosing ? (position?.remainingQuantity || 0) : 0,
    stopLoss: position?.stopLoss ?? null,
    takeProfit: position?.takeProfit ?? null,
    hypothesis: position?.hypothesis || '',
    chain: position?.chain ?? null,
    contractAddress: position?.contractAddress ?? null,
    notes: '',
    positionId: isClosing ? position?.id : undefined,
  });

  // Auto-calculation: raw strings for display, parsed numbers for math
  const [priceStr, setPriceStr] = useState(isClosing && currentPrice ? String(currentPrice) : '');
  const [quantityStr, setQuantityStr] = useState(isClosing && position?.remainingQuantity ? String(position.remainingQuantity) : '');
  const initialTotal = isClosing && currentPrice && position?.remainingQuantity
    ? String(currentPrice * position.remainingQuantity)
    : '';
  const [totalStr, setTotalStr] = useState(initialTotal);
  const [editedFields, setEditedFields] = useState<[string, string]>(['price', 'quantity']);

  const calculatedField = ['price', 'quantity', 'total'].find(f => !editedFields.includes(f)) || 'total';

  const parseNum = (s: string) => { const n = parseFloat(s); return isNaN(n) ? 0 : n; };

  const updateEditedPair = (field: string): [string, string] => {
    if (editedFields[1] === field) return editedFields;
    const newPair: [string, string] = [editedFields[1], field];
    setEditedFields(newPair);
    return newPair;
  };

  const recalculate = (price: number, quantity: number, total: number, pair: [string, string]) => {
    const calc = ['price', 'quantity', 'total'].find(f => !pair.includes(f));
    if (calc === 'total') {
      const v = price * quantity;
      setTotalStr(v ? String(v) : '');
    } else if (calc === 'quantity' && price > 0) {
      const v = total / price;
      setQuantityStr(v ? String(v) : '');
      setFormData(prev => ({ ...prev, quantity: v }));
    } else if (calc === 'price' && quantity > 0) {
      const v = total / quantity;
      setPriceStr(v ? String(v) : '');
      setFormData(prev => ({ ...prev, price: v }));
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setPriceStr(raw);
    const val = parseNum(raw);
    setFormData(prev => ({ ...prev, price: val }));
    const pair = updateEditedPair('price');
    recalculate(val, parseNum(quantityStr), parseNum(totalStr), pair);
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setQuantityStr(raw);
    const val = parseNum(raw);
    setFormData(prev => ({ ...prev, quantity: val }));
    const pair = updateEditedPair('quantity');
    recalculate(parseNum(priceStr), val, parseNum(totalStr), pair);
  };

  const handleTotalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setTotalStr(raw);
    const val = parseNum(raw);
    const pair = updateEditedPair('total');
    recalculate(parseNum(priceStr), parseNum(quantityStr), val, pair);
  };

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
        };
        await updatePosition(position.id, updateData);
      } else {
        if (formData.price <= 0) {
          setError('Price must be greater than zero');
          setLoading(false);
          return;
        }
        if (formData.quantity <= 0) {
          setError('Quantity must be greater than zero');
          setLoading(false);
          return;
        }
        await createTrade(formData);
      }
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

  const headerContent = (
    <div className="flex items-center gap-3">
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '12px',
        background: isClosing
          ? 'rgba(248, 113, 113, 0.1)'
          : 'var(--accent-glow)',
        border: `1px solid ${isClosing ? 'rgba(248, 113, 113, 0.2)' : 'rgba(16, 185, 129, 0.15)'}`,
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
  );

  return (
    <Modal
      onClose={onClose}
      accentBar={isClosing
        ? 'linear-gradient(90deg, var(--loss), transparent)'
        : 'linear-gradient(90deg, var(--accent), rgba(16, 185, 129, 0.1))'}
      header={headerContent}
      error={error}
    >
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1" style={{ padding: '0 24px 24px' }}>

          {isClosing && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '12px',
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
              </FieldSection>
            </div>
          ) : (
            <div className="flex flex-col" style={{ gap: '16px' }}>
              {/* Market Section */}
              <FieldSection label="Market" icon={<TrendingUp size={12} />}>
                <div className="grid grid-cols-2 gap-3">
                  <FieldGroup label="Asset Type">
                    {/* Glowing underline toggle */}
                    <div style={{
                      display: 'flex',
                      position: 'relative',
                      borderBottom: '2px solid var(--border)',
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
                            padding: '10px 12px',
                            fontSize: '13px',
                            fontWeight: 600,
                            fontFamily: 'inherit',
                            border: 'none',
                            background: 'transparent',
                            cursor: isClosing ? 'not-allowed' : 'pointer',
                            transition: 'color 0.2s ease',
                            color: formData.assetType === type
                              ? 'var(--text-primary)'
                              : 'var(--text-muted)',
                          }}
                        >
                          {type === 'crypto' ? 'Crypto' : 'Stock'}
                        </button>
                      ))}
                      {/* Sliding glowing underline */}
                      <div style={{
                        position: 'absolute',
                        bottom: '-2px',
                        left: 0,
                        width: '50%',
                        height: '2px',
                        borderRadius: '2px',
                        background: 'var(--accent)',
                        transform: `translateX(${formData.assetType === 'stock' ? '100%' : '0'})`,
                        transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        boxShadow: '0 0 8px rgba(16, 185, 129, 0.6), 0 0 20px rgba(16, 185, 129, 0.3)',
                      }} />
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
                {/* Buy / Sell toggle with glowing underline */}
                <div style={{
                  display: 'flex',
                  position: 'relative',
                  borderBottom: '2px solid var(--border)',
                }}>
                  <button
                    type="button"
                    onClick={() => !isClosing && setFormData((prev) => ({ ...prev, side: 'buy' }))}
                    disabled={isClosing}
                    style={{
                      flex: 1,
                      padding: '12px',
                      fontWeight: 600,
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      letterSpacing: '0.3px',
                      border: 'none',
                      background: 'transparent',
                      cursor: isClosing ? 'not-allowed' : 'pointer',
                      opacity: isClosing ? 0.5 : 1,
                      transition: 'color 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      color: formData.side === 'buy'
                        ? 'var(--profit)'
                        : 'var(--text-muted)',
                    }}
                  >
                    <TrendingUp size={16} />
                    Buy
                  </button>
                  <button
                    type="button"
                    onClick={() => !isClosing && setFormData((prev) => ({ ...prev, side: 'sell' }))}
                    disabled={isClosing}
                    style={{
                      flex: 1,
                      padding: '12px',
                      fontWeight: 600,
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      letterSpacing: '0.3px',
                      border: 'none',
                      background: 'transparent',
                      cursor: isClosing ? 'not-allowed' : 'pointer',
                      opacity: isClosing ? 0.5 : 1,
                      transition: 'color 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      color: formData.side === 'sell'
                        ? 'var(--loss)'
                        : 'var(--text-muted)',
                    }}
                  >
                    <TrendingDown size={16} />
                    Sell
                  </button>
                  {/* Glowing underline */}
                  <div style={{
                    position: 'absolute',
                    bottom: '-2px',
                    left: 0,
                    width: '50%',
                    height: '2px',
                    borderRadius: '2px',
                    background: formData.side === 'buy' ? 'var(--profit)' : 'var(--loss)',
                    transform: `translateX(${formData.side === 'sell' ? '100%' : '0'})`,
                    transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s ease, box-shadow 0.3s ease',
                    boxShadow: formData.side === 'buy'
                      ? '0 0 8px rgba(52, 211, 153, 0.6), 0 0 20px rgba(52, 211, 153, 0.3)'
                      : '0 0 8px rgba(248, 113, 113, 0.6), 0 0 20px rgba(248, 113, 113, 0.3)',
                  }} />
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

                <div className="grid grid-cols-3 gap-3">
                  <FieldGroup label={`${isClosing ? 'Exit Price' : 'Entry Price'}${calculatedField === 'price' ? ' (calc)' : ''}`}>
                    <PrefixInput
                      prefix="$"
                      type="text"
                      inputMode="decimal"
                      name="price"
                      value={priceStr}
                      onChange={handlePriceChange}
                      placeholder="0.00"
                      required
                    />
                    {isClosing && currentPrice !== undefined && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '6px',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                      }}>
                        <span>Mkt: ${currentPrice < 0.01 ? currentPrice.toPrecision(4) : currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const p = String(currentPrice);
                            setPriceStr(p);
                            setFormData(prev => ({ ...prev, price: currentPrice }));
                            const pair = updateEditedPair('price');
                            recalculate(currentPrice, parseNum(quantityStr), parseNum(totalStr), pair);
                          }}
                          style={{
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            borderRadius: '6px',
                            padding: '2px 8px',
                            fontSize: '10px',
                            fontWeight: 600,
                            color: 'var(--accent)',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          Use market price
                        </button>
                      </div>
                    )}
                  </FieldGroup>
                  <FieldGroup label={`Quantity${calculatedField === 'quantity' ? ' (calc)' : ''}`}>
                    <input
                      type="text"
                      inputMode="decimal"
                      name="quantity"
                      value={quantityStr}
                      onChange={handleQuantityChange}
                      placeholder="0"
                      className="w-full"
                      required
                    />
                  </FieldGroup>
                  <FieldGroup label={`Total${calculatedField === 'total' ? ' (calc)' : ''}`}>
                    <PrefixInput
                      prefix="$"
                      type="text"
                      inputMode="decimal"
                      name="total"
                      value={totalStr}
                      onChange={handleTotalChange}
                      placeholder="0.00"
                    />
                  </FieldGroup>
                </div>
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
                boxShadow: '0 2px 12px rgba(248, 113, 113, 0.2)',
              } : {}}
            >
              {loading ? 'Saving...' : isClosing ? 'Close Position' : isEditing ? 'Update Position' : 'Add Trade'}
            </button>
          </div>
        </form>
    </Modal>
  );
}
