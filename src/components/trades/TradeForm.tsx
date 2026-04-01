import { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Zap,
  Target,
  Layers,
  Tag,
  Plus,
  X,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import Modal from '../Modal';
import { FieldSection, FieldGroup, PrefixInput } from '../form';
import type {
  Trade,
  TradeCreateData,
  TradeUpdateData,
  TradeCloseData,
  TradeStrategy,
  TradeAssetType,
  TradeSide,
  EntryQuality,
  TradeLeg,
  OptionType,
} from '../../types';

type FormMode = 'create' | 'edit' | 'close';

interface TradeFormProps {
  trade?: Trade | null;
  mode?: FormMode;
  onClose: () => void;
}

type LegDraft = {
  id?: string;
  ticker: string;
  optionType: OptionType | null;
  strike: string;
  expiration: string;
  side: TradeSide;
  quantity: string;
  entryPrice: string;
  exitPrice: string;
};

type TagDraft = { tag: string; category?: string };

const STRATEGIES: { value: TradeStrategy; label: string }[] = [
  { value: 'long', label: 'Long' },
  { value: 'short', label: 'Short' },
  { value: 'debit_spread', label: 'Debit Spread' },
  { value: 'credit_spread', label: 'Credit Spread' },
  { value: 'iron_condor', label: 'Iron Condor' },
  { value: 'straddle', label: 'Straddle' },
  { value: 'strangle', label: 'Strangle' },
  { value: 'custom', label: 'Custom' },
];

const ASSET_TYPES: { value: TradeAssetType; label: string }[] = [
  { value: 'option', label: 'Option' },
  { value: 'futures', label: 'Futures' },
  { value: 'stock', label: 'Stock' },
];

const ENTRY_QUALITIES: { value: EntryQuality; label: string; color: string; bg: string }[] = [
  { value: 'clean', label: 'Clean', color: 'var(--profit)', bg: 'rgba(52, 211, 153, 0.12)' },
  { value: 'intuitive', label: 'Intuitive', color: 'var(--accent-violet)', bg: 'rgba(139, 92, 246, 0.12)' },
  { value: 'chased', label: 'Chased', color: 'var(--accent-warm)', bg: 'rgba(245, 158, 11, 0.12)' },
  { value: 'fomo', label: 'FOMO', color: 'var(--loss)', bg: 'rgba(248, 113, 113, 0.12)' },
];

function makeLegDraft(side: TradeSide): LegDraft {
  return { ticker: '', optionType: 'call', strike: '', expiration: '', side, quantity: '', entryPrice: '', exitPrice: '' };
}

function scaffoldLegs(strategy: TradeStrategy, side: TradeSide): LegDraft[] {
  switch (strategy) {
    case 'long':
      return [makeLegDraft(side)];
    case 'short':
      return [makeLegDraft(side)];
    case 'debit_spread':
      return [makeLegDraft('buy'), makeLegDraft('sell')];
    case 'credit_spread':
      return [makeLegDraft('sell'), makeLegDraft('buy')];
    case 'iron_condor':
      return [
        { ...makeLegDraft('sell'), optionType: 'put' },
        { ...makeLegDraft('buy'), optionType: 'put' },
        { ...makeLegDraft('sell'), optionType: 'call' },
        { ...makeLegDraft('buy'), optionType: 'call' },
      ];
    case 'straddle':
      return [
        { ...makeLegDraft('buy'), optionType: 'call' },
        { ...makeLegDraft('buy'), optionType: 'put' },
      ];
    case 'strangle':
      return [
        { ...makeLegDraft('buy'), optionType: 'call' },
        { ...makeLegDraft('buy'), optionType: 'put' },
      ];
    case 'custom':
    default:
      return [];
  }
}

function existingLegsToClose(trade: Trade): LegDraft[] {
  return trade.legs.map((l) => ({
    id: l.id,
    ticker: l.ticker,
    optionType: l.optionType,
    strike: l.strike !== null ? String(l.strike) : '',
    expiration: l.expiration ?? '',
    side: l.side,
    quantity: String(l.quantity),
    entryPrice: l.entryPrice !== null ? String(l.entryPrice) : '',
    exitPrice: l.exitPrice !== null ? String(l.exitPrice) : '',
  }));
}

export default function TradeForm({ trade, mode = 'create', onClose }: TradeFormProps) {
  const { createTrade, updateTrade, closeTrade } = useStore(useShallow((s) => ({
    createTrade: s.createTrade,
    updateTrade: s.updateTrade,
    closeTrade: s.closeTrade,
  })));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Create mode state ---
  const [name, setName] = useState(trade?.name ?? '');
  const [underlying, setUnderlying] = useState(trade?.underlying ?? '');
  const [assetType, setAssetType] = useState<TradeAssetType>(trade?.assetType ?? 'option');
  const [strategy, setStrategy] = useState<TradeStrategy>(trade?.strategy ?? 'long');
  const [side, setSide] = useState<TradeSide>(trade?.side ?? 'buy');
  const [quantity, setQuantity] = useState(trade?.quantity ? String(trade.quantity) : '');
  const [entryPrice, setEntryPrice] = useState(trade?.entryPrice !== null && trade?.entryPrice !== undefined ? String(trade.entryPrice) : '');
  const [fees, setFees] = useState(trade?.fees !== null && trade?.fees !== undefined ? String(trade.fees) : '');
  const [openDate, setOpenDate] = useState(trade?.openDate ?? new Date().toISOString().slice(0, 16));
  const [entryQuality, setEntryQuality] = useState<EntryQuality | null>(trade?.entryQuality ?? null);
  const [thesis, setThesis] = useState(trade?.thesis ?? '');
  const [exitPlan, setExitPlan] = useState(trade?.exitPlan ?? '');
  const [notes, setNotes] = useState(trade?.notes ?? '');
  const [savePlanned, setSavePlanned] = useState(false);

  // Legs
  const initialLegs = mode === 'close' && trade
    ? existingLegsToClose(trade)
    : mode === 'create'
      ? scaffoldLegs(strategy, side)
      : [];
  const [legs, setLegs] = useState<LegDraft[]>(initialLegs);

  // Tags
  const [tags, setTags] = useState<TagDraft[]>(trade?.tags?.map((t) => ({ tag: t.tag, category: t.category ?? undefined })) ?? []);
  const [tagInput, setTagInput] = useState('');

  // --- Close mode state ---
  const [exitPrice, setExitPrice] = useState('');
  const [closeDate, setCloseDate] = useState(new Date().toISOString().slice(0, 16));
  const [realizedPnl, setRealizedPnl] = useState('');
  const [followedPlan, setFollowedPlan] = useState<boolean | null>(null);
  const [reflection, setReflection] = useState('');

  const parseNum = (s: string) => { const n = parseFloat(s); return isNaN(n) ? 0 : n; };

  const handleStrategyChange = (newStrategy: TradeStrategy) => {
    setStrategy(newStrategy);
    if (mode === 'create') {
      setLegs(scaffoldLegs(newStrategy, side));
    }
  };

  const updateLeg = (idx: number, field: keyof LegDraft, value: string | TradeSide | OptionType | null) => {
    setLegs((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const addLeg = () => {
    setLegs((prev) => [...prev, makeLegDraft('buy')]);
  };

  const removeLeg = (idx: number) => {
    setLegs((prev) => prev.filter((_, i) => i !== idx));
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.some((t) => t.tag === trimmed)) {
      setTags((prev) => [...prev, { tag: trimmed }]);
      setTagInput('');
    }
  };

  const removeTag = (idx: number) => {
    setTags((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'create') {
        if (!underlying.trim()) {
          setError('Underlying is required');
          setLoading(false);
          return;
        }

        const legData: Omit<TradeLeg, 'id' | 'tradeId'>[] = legs.map((l) => ({
          ticker: l.ticker || underlying,
          optionType: l.optionType,
          strike: l.strike ? parseNum(l.strike) : null,
          expiration: l.expiration || null,
          side: l.side,
          quantity: parseNum(l.quantity) || parseNum(quantity) || 1,
          entryPrice: l.entryPrice ? parseNum(l.entryPrice) : parseNum(entryPrice) || null,
          exitPrice: null,
          entryUnderlyingPrice: null,
          exitUnderlyingPrice: null,
          delta: null,
          gamma: null,
          theta: null,
          vega: null,
          iv: null,
        }));

        const data: TradeCreateData = {
          name: name.trim(),
          assetType,
          underlying: underlying.trim().toUpperCase(),
          status: savePlanned ? 'planned' : 'open',
          strategy,
          side,
          quantity: parseNum(quantity) || 1,
          entryPrice: entryPrice ? parseNum(entryPrice) : null,
          fees: fees ? parseNum(fees) : null,
          openDate: openDate || null,
          entryQuality,
          thesis: thesis.trim(),
          exitPlan: exitPlan.trim(),
          notes: notes.trim(),
          legs: legData,
          tags,
        };

        await createTrade(data);
      } else if (mode === 'edit' && trade) {
        const data: TradeUpdateData = {
          name: name.trim(),
          thesis: thesis.trim(),
          exitPlan: exitPlan.trim(),
          notes: notes.trim(),
          entryQuality: entryQuality ?? undefined,
          fees: fees ? parseNum(fees) : undefined,
        };

        await updateTrade(trade.id, data);
      } else if (mode === 'close' && trade) {
        if (!realizedPnl) {
          setError('Realized P&L is required');
          setLoading(false);
          return;
        }

        const legExits = legs
          .filter((l) => l.id && l.exitPrice)
          .map((l) => ({ id: l.id!, exitPrice: parseNum(l.exitPrice) }));

        const data: TradeCloseData = {
          exitPrice: exitPrice ? parseNum(exitPrice) : null,
          closeDate: closeDate || new Date().toISOString(),
          realizedPnl: parseNum(realizedPnl),
          reflection: reflection.trim() || undefined,
          followedPlan: followedPlan ?? undefined,
          legs: legExits.length > 0 ? legExits : undefined,
        };

        await closeTrade(trade.id, data);
      }

      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const title = mode === 'close'
    ? 'Close Trade'
    : mode === 'edit'
    ? 'Edit Trade'
    : 'New Trade';

  const subtitle = mode === 'close'
    ? `Closing ${trade?.name || trade?.underlying}`
    : mode === 'edit'
    ? `Editing ${trade?.name || trade?.underlying}`
    : 'Enter your trade details';

  const headerContent = (
    <div className="flex items-center gap-3">
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '12px',
        background: mode === 'close'
          ? 'rgba(248, 113, 113, 0.1)'
          : 'var(--accent-glow)',
        border: `1px solid ${mode === 'close' ? 'rgba(248, 113, 113, 0.2)' : 'rgba(16, 185, 129, 0.15)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {mode === 'close' ? (
          <TrendingDown size={18} style={{ color: 'var(--loss)' }} />
        ) : (
          <Zap size={18} style={{ color: 'var(--accent)' }} />
        )}
      </div>
      <div>
        <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>{title}</h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{subtitle}</p>
      </div>
    </div>
  );

  return (
    <Modal
      onClose={onClose}
      maxWidth={mode === 'create' ? '640px' : '520px'}
      accentBar={mode === 'close'
        ? 'linear-gradient(90deg, var(--loss), transparent)'
        : 'linear-gradient(90deg, var(--accent), rgba(16, 185, 129, 0.1))'}
      header={headerContent}
      error={error}
    >
      <form onSubmit={handleSubmit} className="overflow-y-auto flex-1" style={{ padding: '0 24px 24px' }}>

        {mode === 'close' && (
          <div style={{
            padding: '10px 14px',
            borderRadius: '12px',
            fontSize: '13px',
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.15)',
            color: '#60a5fa',
            marginBottom: '16px',
          }}>
            Closing your {trade?.underlying} {trade?.strategy.replace(/_/g, ' ')} trade.
          </div>
        )}

        {/* ==================== CREATE MODE ==================== */}
        {mode === 'create' && (
          <div className="flex flex-col" style={{ gap: '16px' }}>

            {/* Market Section */}
            <FieldSection label="Market" icon={<TrendingUp size={12} />}>
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="Name" optional>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., SPY 0DTE Put"
                    className="w-full"
                  />
                </FieldGroup>
                <FieldGroup label="Underlying">
                  <input
                    type="text"
                    value={underlying}
                    onChange={(e) => setUnderlying(e.target.value)}
                    placeholder="e.g., SPY, AAPL"
                    className="w-full uppercase"
                    required
                  />
                </FieldGroup>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="Asset Type">
                  <select
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value as TradeAssetType)}
                    className="w-full"
                  >
                    {ASSET_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </FieldGroup>
                <FieldGroup label="Strategy">
                  <select
                    value={strategy}
                    onChange={(e) => handleStrategyChange(e.target.value as TradeStrategy)}
                    className="w-full"
                  >
                    {STRATEGIES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </FieldGroup>
              </div>
            </FieldSection>

            {/* Order Section */}
            <FieldSection label="Order" icon={<Zap size={12} />}>
              {/* Buy / Sell toggle */}
              <div style={{
                display: 'flex',
                position: 'relative',
                borderBottom: '2px solid var(--border)',
              }}>
                <button
                  type="button"
                  onClick={() => setSide('buy')}
                  style={{
                    ...sideToggleStyle,
                    color: side === 'buy' ? 'var(--profit)' : 'var(--text-muted)',
                  }}
                >
                  <TrendingUp size={16} />
                  Buy
                </button>
                <button
                  type="button"
                  onClick={() => setSide('sell')}
                  style={{
                    ...sideToggleStyle,
                    color: side === 'sell' ? 'var(--loss)' : 'var(--text-muted)',
                  }}
                >
                  <TrendingDown size={16} />
                  Sell
                </button>
                <div style={{
                  position: 'absolute',
                  bottom: '-2px',
                  left: 0,
                  width: '50%',
                  height: '2px',
                  borderRadius: '2px',
                  background: side === 'buy' ? 'var(--profit)' : 'var(--loss)',
                  transform: `translateX(${side === 'sell' ? '100%' : '0'})`,
                  transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s ease, box-shadow 0.3s ease',
                  boxShadow: side === 'buy'
                    ? '0 0 8px rgba(52, 211, 153, 0.6), 0 0 20px rgba(52, 211, 153, 0.3)'
                    : '0 0 8px rgba(248, 113, 113, 0.6), 0 0 20px rgba(248, 113, 113, 0.3)',
                }} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <FieldGroup label="Entry Price">
                  <PrefixInput
                    prefix="$"
                    type="text"
                    inputMode="decimal"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    placeholder="0.00"
                  />
                </FieldGroup>
                <FieldGroup label="Quantity">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0"
                    className="w-full"
                  />
                </FieldGroup>
                <FieldGroup label="Fees" optional>
                  <PrefixInput
                    prefix="$"
                    type="text"
                    inputMode="decimal"
                    value={fees}
                    onChange={(e) => setFees(e.target.value)}
                    placeholder="0.00"
                  />
                </FieldGroup>
              </div>

              <FieldGroup label="Open Date">
                <input
                  type="datetime-local"
                  value={openDate}
                  onChange={(e) => setOpenDate(e.target.value)}
                  className="w-full"
                />
              </FieldGroup>
            </FieldSection>

            {/* Entry Quality */}
            <FieldSection label="Entry Quality" icon={<Target size={12} />}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {ENTRY_QUALITIES.map((q) => {
                  const isActive = entryQuality === q.value;
                  return (
                    <button
                      key={q.value}
                      type="button"
                      onClick={() => setEntryQuality(isActive ? null : q.value)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-btn)',
                        border: `1px solid ${isActive ? q.color : 'var(--border)'}`,
                        background: isActive ? q.bg : 'transparent',
                        color: isActive ? q.color : 'var(--text-muted)',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {q.label}
                    </button>
                  );
                })}
              </div>
            </FieldSection>

            {/* Legs Builder */}
            <FieldSection label="Legs" icon={<Layers size={12} />}>
              {legs.length === 0 && (
                <div style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px dashed var(--border)',
                  fontSize: '12.5px',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                }}>
                  No legs yet. Add legs to track individual contracts.
                </div>
              )}
              {legs.map((leg, idx) => (
                <div key={idx} style={{
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  position: 'relative',
                }}>
                  <button
                    type="button"
                    onClick={() => removeLeg(idx)}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      padding: '2px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X size={14} />
                  </button>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Leg {idx + 1}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <FieldGroup label="Ticker">
                      <input
                        type="text"
                        value={leg.ticker}
                        onChange={(e) => updateLeg(idx, 'ticker', e.target.value)}
                        placeholder={underlying || 'SPY'}
                        className="w-full uppercase"
                        style={{ fontSize: '13px' }}
                      />
                    </FieldGroup>
                    <FieldGroup label="Type">
                      <select
                        value={leg.optionType ?? ''}
                        onChange={(e) => updateLeg(idx, 'optionType', (e.target.value || null) as OptionType | null)}
                        className="w-full"
                        style={{ fontSize: '13px' }}
                      >
                        <option value="">--</option>
                        <option value="call">Call</option>
                        <option value="put">Put</option>
                      </select>
                    </FieldGroup>
                    <FieldGroup label="Side">
                      <select
                        value={leg.side}
                        onChange={(e) => updateLeg(idx, 'side', e.target.value as TradeSide)}
                        className="w-full"
                        style={{ fontSize: '13px' }}
                      >
                        <option value="buy">Buy</option>
                        <option value="sell">Sell</option>
                      </select>
                    </FieldGroup>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <FieldGroup label="Strike">
                      <PrefixInput
                        prefix="$"
                        type="text"
                        inputMode="decimal"
                        value={leg.strike}
                        onChange={(e) => updateLeg(idx, 'strike', e.target.value)}
                        placeholder="0"
                        style={{ fontSize: '13px' }}
                      />
                    </FieldGroup>
                    <FieldGroup label="Expiration">
                      <input
                        type="date"
                        value={leg.expiration}
                        onChange={(e) => updateLeg(idx, 'expiration', e.target.value)}
                        className="w-full"
                        style={{ fontSize: '13px' }}
                      />
                    </FieldGroup>
                    <FieldGroup label="Qty">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={leg.quantity}
                        onChange={(e) => updateLeg(idx, 'quantity', e.target.value)}
                        placeholder={quantity || '1'}
                        className="w-full"
                        style={{ fontSize: '13px' }}
                      />
                    </FieldGroup>
                    <FieldGroup label="Entry $">
                      <PrefixInput
                        prefix="$"
                        type="text"
                        inputMode="decimal"
                        value={leg.entryPrice}
                        onChange={(e) => updateLeg(idx, 'entryPrice', e.target.value)}
                        placeholder="0.00"
                        style={{ fontSize: '13px' }}
                      />
                    </FieldGroup>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addLeg}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-btn)',
                  border: '1px dashed var(--border)',
                  background: 'transparent',
                  color: 'var(--accent)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s ease',
                  width: '100%',
                }}
              >
                <Plus size={14} /> Add Leg
              </button>
            </FieldSection>

            {/* Thesis */}
            <FieldSection label="Thesis" icon={<Target size={12} />}>
              <FieldGroup label="Thesis">
                <textarea
                  value={thesis}
                  onChange={(e) => setThesis(e.target.value)}
                  rows={2}
                  placeholder="Why are you making this trade?"
                  className="w-full resize-none"
                />
              </FieldGroup>
              <FieldGroup label="Exit Plan">
                <textarea
                  value={exitPlan}
                  onChange={(e) => setExitPlan(e.target.value)}
                  rows={2}
                  placeholder="When/how will you exit?"
                  className="w-full resize-none"
                />
              </FieldGroup>
              <FieldGroup label="Notes" optional>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Additional notes..."
                  className="w-full resize-none"
                />
              </FieldGroup>
            </FieldSection>

            {/* Tags */}
            <FieldSection label="Tags" icon={<Tag size={12} />}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {tags.map((t, idx) => (
                  <span key={idx} style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    fontWeight: 500,
                    padding: '4px 10px',
                    borderRadius: '12px',
                    background: 'rgba(139, 92, 246, 0.1)',
                    color: 'var(--accent-violet)',
                    border: '1px solid rgba(139, 92, 246, 0.2)',
                  }}>
                    {t.tag}
                    <button
                      type="button"
                      onClick={() => removeTag(idx)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="Add a tag..."
                  className="w-full"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={addTag}
                  disabled={!tagInput.trim()}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-btn)',
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: tagInput.trim() ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: tagInput.trim() ? 'pointer' : 'default',
                    fontFamily: 'inherit',
                    opacity: tagInput.trim() ? 1 : 0.5,
                  }}
                >
                  Add
                </button>
              </div>
            </FieldSection>
          </div>
        )}

        {/* ==================== EDIT MODE ==================== */}
        {mode === 'edit' && (
          <div className="flex flex-col" style={{ gap: '16px' }}>
            <FieldSection label="Details" icon={<Target size={12} />}>
              <FieldGroup label="Name">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Trade name"
                  className="w-full"
                />
              </FieldGroup>
              <FieldGroup label="Fees">
                <PrefixInput
                  prefix="$"
                  type="text"
                  inputMode="decimal"
                  value={fees}
                  onChange={(e) => setFees(e.target.value)}
                  placeholder="0.00"
                />
              </FieldGroup>
            </FieldSection>

            <FieldSection label="Entry Quality" icon={<Target size={12} />}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {ENTRY_QUALITIES.map((q) => {
                  const isActive = entryQuality === q.value;
                  return (
                    <button
                      key={q.value}
                      type="button"
                      onClick={() => setEntryQuality(isActive ? null : q.value)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-btn)',
                        border: `1px solid ${isActive ? q.color : 'var(--border)'}`,
                        background: isActive ? q.bg : 'transparent',
                        color: isActive ? q.color : 'var(--text-muted)',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {q.label}
                    </button>
                  );
                })}
              </div>
            </FieldSection>

            <FieldSection label="Thesis" icon={<Target size={12} />}>
              <FieldGroup label="Thesis">
                <textarea
                  value={thesis}
                  onChange={(e) => setThesis(e.target.value)}
                  rows={3}
                  placeholder="Why are you making this trade?"
                  className="w-full resize-none"
                />
              </FieldGroup>
              <FieldGroup label="Exit Plan">
                <textarea
                  value={exitPlan}
                  onChange={(e) => setExitPlan(e.target.value)}
                  rows={2}
                  placeholder="When/how will you exit?"
                  className="w-full resize-none"
                />
              </FieldGroup>
              <FieldGroup label="Notes" optional>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Additional notes..."
                  className="w-full resize-none"
                />
              </FieldGroup>
            </FieldSection>
          </div>
        )}

        {/* ==================== CLOSE MODE ==================== */}
        {mode === 'close' && (
          <div className="flex flex-col" style={{ gap: '16px' }}>
            <FieldSection label="Close Details" icon={<TrendingDown size={12} />}>
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="Exit Price">
                  <PrefixInput
                    prefix="$"
                    type="text"
                    inputMode="decimal"
                    value={exitPrice}
                    onChange={(e) => setExitPrice(e.target.value)}
                    placeholder="0.00"
                  />
                </FieldGroup>
                <FieldGroup label="Close Date">
                  <input
                    type="datetime-local"
                    value={closeDate}
                    onChange={(e) => setCloseDate(e.target.value)}
                    className="w-full"
                    required
                  />
                </FieldGroup>
              </div>
              <FieldGroup label="Realized P&L">
                <PrefixInput
                  prefix="$"
                  type="text"
                  inputMode="decimal"
                  value={realizedPnl}
                  onChange={(e) => setRealizedPnl(e.target.value)}
                  placeholder="0.00 (positive or negative)"
                  required
                />
              </FieldGroup>
            </FieldSection>

            {/* Followed Plan toggle */}
            <FieldSection label="Execution" icon={<Target size={12} />}>
              <FieldGroup label="Did you follow your plan?">
                <div style={{ display: 'flex', gap: '8px' }}>
                  {([
                    { value: true, label: 'Yes', color: 'var(--profit)', bg: 'rgba(52, 211, 153, 0.12)' },
                    { value: false, label: 'No', color: 'var(--loss)', bg: 'rgba(248, 113, 113, 0.12)' },
                  ] as const).map((opt) => {
                    const isActive = followedPlan === opt.value;
                    return (
                      <button
                        key={String(opt.value)}
                        type="button"
                        onClick={() => setFollowedPlan(isActive ? null : opt.value)}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '10px',
                          borderRadius: 'var(--radius-btn)',
                          border: `1px solid ${isActive ? opt.color : 'var(--border)'}`,
                          background: isActive ? opt.bg : 'transparent',
                          color: isActive ? opt.color : 'var(--text-muted)',
                          fontSize: '13px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </FieldGroup>
              <FieldGroup label="Reflection" optional>
                <textarea
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  rows={3}
                  placeholder="What did you learn from this trade?"
                  className="w-full resize-none"
                />
              </FieldGroup>
            </FieldSection>

            {/* Per-leg exit prices */}
            {legs.length > 0 && (
              <FieldSection label="Leg Exit Prices" icon={<Layers size={12} />}>
                {legs.map((leg, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ flex: 1, fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <span style={{ fontWeight: 500 }}>{leg.ticker || trade?.underlying}</span>
                      {leg.optionType && (
                        <span style={{ marginLeft: '6px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          {leg.optionType}
                        </span>
                      )}
                      {leg.strike && (
                        <span style={{ marginLeft: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                          ${leg.strike}
                        </span>
                      )}
                    </div>
                    <div style={{ width: '120px' }}>
                      <PrefixInput
                        prefix="$"
                        type="text"
                        inputMode="decimal"
                        value={leg.exitPrice}
                        onChange={(e) => updateLeg(idx, 'exitPrice', e.target.value)}
                        placeholder="Exit $"
                        style={{ fontSize: '13px' }}
                      />
                    </div>
                  </div>
                ))}
              </FieldSection>
            )}
          </div>
        )}

        {/* Actions */}
        <div
          style={{ paddingTop: '20px', marginTop: '20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          {mode === 'create' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={savePlanned}
                onChange={(e) => setSavePlanned(e.target.checked)}
                style={{ accentColor: '#60a5fa', width: '16px', height: '16px' }}
              />
              Save as planned (don't open yet)
            </label>
          )}
          <div className="flex gap-3">
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
              style={mode === 'close' ? {
                background: 'linear-gradient(135deg, var(--loss) 0%, #dc2626 100%)',
                boxShadow: '0 2px 12px rgba(248, 113, 113, 0.2)',
              } : savePlanned ? {
                background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
                boxShadow: '0 2px 12px rgba(96, 165, 250, 0.2)',
              } : {}}
            >
              {loading
                ? 'Saving...'
                : mode === 'close'
                ? 'Close Trade'
                : mode === 'edit'
                ? 'Update Trade'
                : savePlanned
                ? 'Save Plan'
                : 'Create Trade'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

const sideToggleStyle: React.CSSProperties = {
  flex: 1,
  padding: '12px',
  fontWeight: 600,
  fontSize: '14px',
  fontFamily: 'inherit',
  letterSpacing: '0.3px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  transition: 'color 0.2s ease',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
};
