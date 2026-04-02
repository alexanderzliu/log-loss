import { Fragment, useState, useRef, useEffect } from 'react';
import type { Trade, EntryQuality } from '../../types';
import { useStore } from '../../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { formatPrice, formatQuantity, formatDate } from '../../utils/format';
import PnlDisplay from '../PnlDisplay';
import { tableHeaderStyle, tableCellStyle } from '../../utils/styles';
import { useSetToggle } from '../../hooks/useSetToggle';
import ConfirmDialog from '../ConfirmDialog';
import DropdownMenu from '../DropdownMenu';
import { menuItemStyle } from '../../utils/menuStyles';
import {
  Edit2,
  Trash2,
  X,
  ArrowUpRight,
  ArrowDownRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  MessageSquare,
  Check,
  Minus,
  Tag,
  Clock,
} from 'lucide-react';
import ReflectionList from './ReflectionList';
import TradeChart from './TradeChart';
import DteBadge from '../DteBadge';
import { getDTE, getEarliestExpiration } from '../../utils/dte';

interface TradeListProps {
  trades: Trade[];
  onEdit: (trade: Trade) => void;
  onClose: (trade: Trade) => void;
  onOpen?: (trade: Trade) => void;
  onDelete: (id: string) => void;

  sortField?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (field: string) => void;

  initialExpandedId?: string;
}

export default function TradeList({ trades, onEdit, onClose, onOpen, onDelete, sortField, sortDir, onSort, initialExpandedId }: TradeListProps) {
  const { deleteTrade, addToast } = useStore(useShallow((s) => ({
    deleteTrade: s.deleteTrade,
    addToast: s.addToast,
  })));
  const [expandedTrades, toggleExpanded] = useSetToggle(
    initialExpandedId ? [initialExpandedId] : undefined,
  );
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const highlightRef = useRef<HTMLTableRowElement>(null);

  // Scroll highlighted trade into view
  useEffect(() => {
    if (initialExpandedId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [initialExpandedId]);

  const handleDelete = async (id: string) => {
    try {
      await deleteTrade(id);
      onDelete(id);
    } catch (err) {
      console.error('Failed to delete trade:', err);
      addToast({ type: 'error', title: 'Delete Failed', message: 'Failed to delete trade. Please try again.' });
    }
    setDeleteConfirm(null);
    setMenuOpen(null);
  };

  if (trades.length === 0) {
    return (
      <div className="card empty-state">
        <p className="empty-state-title">No trades yet</p>
        <p className="empty-state-text">Click "New Trade" to log your first trade</p>
      </div>
    );
  }

  return (
    <div className="card" style={{
      overflow: 'visible',
      boxShadow: 'var(--shadow-card), 0 0 60px rgba(16, 185, 129, 0.03), 0 0 120px rgba(139, 92, 246, 0.02)',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={thStyle}>
              <SortHeader field="name" label="Name" sortField={sortField} sortDir={sortDir} onSort={onSort} />
            </th>
            <th style={thStyle}>
              <SortHeader field="date" label="Date" sortField={sortField} sortDir={sortDir} onSort={onSort} />
            </th>
            <th style={{ ...thStyle, textAlign: 'center' }}>Strategy</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Entry</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Qty</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>
              <SortHeader field="pnl" label="P&L" sortField={sortField} sortDir={sortDir} onSort={onSort} align="right" />
            </th>
            <th style={{ ...thStyle, textAlign: 'center' }}>Plan</th>
            <th style={{ ...thStyle, width: '40px' }}></th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade, tradeIdx) => {
            const isExpanded = expandedTrades.has(trade.id);
            const isOpen = trade.status === 'open';

            const displayPnl = trade.status === 'closed' ? trade.realizedPnl : null;
            const reflectionCount = trade.reflectionCount ?? 0;
            const isPnlPositive = displayPnl !== null ? displayPnl >= 0 : true;

            // Row gradient intensity scales with P&L magnitude
            const pnlAbs = displayPnl !== null ? Math.abs(displayPnl) : 0;
            const gradientIntensity = Math.min(1, Math.sqrt(pnlAbs / 500));
            const rowGradientColor = isPnlPositive ? '52, 211, 153' : '248, 113, 113';
            const rowGradientAlpha = displayPnl !== null
              ? (0.02 + 0.06 * gradientIntensity).toFixed(3)
              : '0';

            const displayName = trade.name || trade.underlying;
            const strategyLabel = trade.strategy.replace(/_/g, ' ');
            const tradeDate = trade.openDate ?? trade.createdAt;

            return (
              <Fragment key={trade.id}>
                {/* Trade row */}
                <tr
                  ref={trade.id === initialExpandedId ? highlightRef : undefined}
                  style={{
                    borderBottom: isExpanded ? 'none' : '1px solid var(--border)',
                    cursor: 'pointer',
                    animation: `slideUp 0.35s ease-out ${Math.min(tradeIdx * 0.04, 0.4)}s both`,
                    background: `linear-gradient(135deg, rgba(${rowGradientColor}, ${rowGradientAlpha}) 0%, transparent 60%)`,
                  }}
                  onClick={() => toggleExpanded(trade.id)}
                >
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ color: 'var(--text-muted)', width: '16px' }}>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </div>
                      <div className="asset-icon">
                        {trade.underlying.slice(0, 2)}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                            {displayName}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          <span style={{
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.3px',
                          }}>
                            {trade.underlying}
                          </span>
                          <span style={{ opacity: 0.4 }}>·</span>
                          <span>
                            {trade.assetType} · {trade.legs.length} leg{trade.legs.length !== 1 ? 's' : ''}
                          </span>
                          {trade.thesis && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--accent-warm)', fontSize: '11px', textTransform: 'none' }}>
                              <Lightbulb size={11} />
                              thesis
                            </span>
                          )}
                          {reflectionCount > 0 && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--accent-violet)', fontSize: '11px', textTransform: 'none' }}>
                              <MessageSquare size={11} />
                              {reflectionCount}
                            </span>
                          )}
                          {trade.entryQuality && (
                            <EntryQualityBadge quality={trade.entryQuality} />
                          )}
                          {trade.status === 'open' && (() => {
                            const earliest = getEarliestExpiration(trade.legs);
                            const dte = getDTE(earliest);
                            if (dte === null) return null;
                            return (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', textTransform: 'none' }}>
                                <Clock size={11} style={{ opacity: 0.6 }} />
                                <DteBadge dte={dte} />
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                        {formatDate(tradeDate)}
                      </div>
                      {trade.status === 'closed' && trade.closeDate && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Closed {formatDate(trade.closeDate)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      textTransform: 'capitalize',
                      color: 'var(--text-secondary)',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--border)',
                    }}>
                      {strategyLabel}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span className={`badge ${trade.status === 'open' ? 'badge-profit' : trade.status === 'planned' ? 'badge-info' : 'badge-neutral'}`}>
                      {trade.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="font-mono text-right" style={tdStyle}>
                    {trade.entryPrice !== null ? formatPrice(trade.entryPrice) : '\u2014'}
                  </td>
                  <td className="font-mono text-right" style={tdStyle}>
                    {formatQuantity(trade.quantity)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <PnlDisplay pnl={displayPnl} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <FollowedPlanIndicator value={trade.followedPlan} />
                  </td>
                  <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu
                      isOpen={menuOpen === trade.id}
                      onToggle={() => setMenuOpen(menuOpen === trade.id ? null : trade.id)}
                      onClose={() => setMenuOpen(null)}
                    >
                      <button
                        onClick={() => { onEdit(trade); setMenuOpen(null); }}
                        style={menuItemStyle}
                      >
                        <Edit2 size={14} /> Edit
                      </button>
                      {trade.status === 'planned' && onOpen && (
                        <button
                          onClick={() => { onOpen(trade); setMenuOpen(null); }}
                          style={menuItemStyle}
                        >
                          <ArrowUpRight size={14} /> Open Trade
                        </button>
                      )}
                      {isOpen && (
                        <button
                          onClick={() => { onClose(trade); setMenuOpen(null); }}
                          style={menuItemStyle}
                        >
                          <X size={14} /> Close Trade
                        </button>
                      )}
                      <button
                        onClick={() => { setDeleteConfirm(trade.id); setMenuOpen(null); }}
                        style={{ ...menuItemStyle, color: 'var(--loss)' }}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </DropdownMenu>
                  </td>
                </tr>

                {/* Expanded thesis - Thread line */}
                {isExpanded && trade.thesis && (
                  <tr style={expandedRowStyle}>
                    <td colSpan={9} style={expandedTdThesis}>
                      <div style={threadLineStyle}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            <Lightbulb size={15} style={{ color: 'var(--accent-warm)', flexShrink: 0, marginTop: '2px' }} />
                            <div>
                              <div style={thesisLabelStyle}>Thesis</div>
                              <div style={thesisTextStyle}>
                                {trade.thesis}
                              </div>
                              {trade.exitPlan && (
                                <>
                                  <div style={{ ...thesisLabelStyle, marginTop: '10px' }}>Exit Plan</div>
                                  <div style={thesisTextStyle}>{trade.exitPlan}</div>
                                </>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); onEdit(trade); }}
                            style={editBtnStyle}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.08)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                          >
                            <Edit2 size={12} /> Edit
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Expanded tags */}
                {isExpanded && trade.tags.length > 0 && (
                  <tr style={expandedRowStyle}>
                    <td colSpan={9} style={expandedTdTags}>
                      <div style={threadLineStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <Tag size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          {trade.tags.map((t) => (
                            <span key={t.id} style={tagPillStyle}>
                              {t.tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Expanded chart */}
                {isExpanded && (
                  <tr style={expandedRowStyle}>
                    <td colSpan={9} style={expandedTdChart}>
                      <div style={threadLineStyle}>
                        <TradeChart trade={trade} />
                      </div>
                    </td>
                  </tr>
                )}

                {/* Expanded reflections - Thread line */}
                {isExpanded && (
                  <tr style={expandedRowStyle}>
                    <td colSpan={9} style={expandedTdReflection}>
                      <div style={threadLineReflStyle}>
                        <ReflectionList tradeId={trade.id} />
                      </div>
                    </td>
                  </tr>
                )}

                {/* Expanded legs */}
                {isExpanded && trade.legs.map((leg, legIdx) => {
                  const isLast = legIdx === trade.legs.length - 1;

                  return (
                    <tr
                      key={leg.id}
                      style={{
                        borderBottom: isLast ? '1px solid var(--border)' : 'none',
                        animation: `slideUp 0.25s ease-out ${legIdx * 0.03}s both`,
                      }}
                    >
                      <td style={legTdLeft}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span className={`badge ${leg.side === 'buy' ? 'badge-profit' : 'badge-loss'}`}>
                            {leg.side === 'buy' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                            {leg.side.toUpperCase()}
                          </span>
                          <div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                              {leg.ticker}
                              {leg.optionType && (
                                <span style={{ marginLeft: '6px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                  {leg.optionType}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>
                                {leg.strike !== null && `$${leg.strike} strike`}
                                {leg.strike !== null && leg.expiration && ' · '}
                                {leg.expiration && formatDate(leg.expiration)}
                              </span>
                              {trade.status === 'open' && leg.expiration && (() => {
                                const dte = getDTE(leg.expiration);
                                if (dte === null) return null;
                                return <DteBadge dte={dte} />;
                              })()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle} />
                      <td style={tdStyle} />
                      <td style={tdStyle} />
                      <td style={legTdMono}>
                        {leg.entryPrice !== null ? formatPrice(leg.entryPrice) : '\u2014'}
                      </td>
                      <td style={legTdMono}>
                        {formatQuantity(leg.quantity)}
                      </td>
                      <td style={legTdMono}>
                        {leg.exitPrice !== null ? formatPrice(leg.exitPrice) : '\u2014'}
                      </td>
                      <td style={tdStyle} />
                      <td style={tdStyle} />
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {deleteConfirm && (
        <ConfirmDialog
          title="Delete Trade?"
          message="This will delete the trade and all its legs, tags, and reflections. This action cannot be undone."
          onConfirm={() => handleDelete(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}

function FollowedPlanIndicator({ value }: { value: boolean | null }) {
  if (value === true) {
    return <Check size={16} style={{ color: 'var(--profit)', display: 'inline' }} />;
  }
  if (value === false) {
    return <X size={16} style={{ color: 'var(--loss)', display: 'inline' }} />;
  }
  return <Minus size={14} style={{ color: 'var(--text-muted)', display: 'inline' }} />;
}

function SortHeader({ field, label, sortField, sortDir, onSort, align }: {
  field: string;
  label: string;
  sortField?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (field: string) => void;
  align?: 'left' | 'right';
}) {
  const isActive = sortField === field;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onSort?.(field); }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        font: 'inherit',
        color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
        fontSize: 'inherit',
        fontWeight: 'inherit',
        textTransform: 'inherit' as never,
        letterSpacing: 'inherit',
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        width: '100%',
      }}
    >
      {label}
      {isActive
        ? (sortDir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />)
        : <ArrowUpDown size={13} style={{ opacity: 0.4 }} />
      }
    </button>
  );
}

const ENTRY_QUALITY_STYLES: Record<EntryQuality, { color: string; bg: string }> = {
  clean: { color: 'var(--profit)', bg: 'rgba(52, 211, 153, 0.12)' },
  intuitive: { color: 'var(--accent-violet)', bg: 'rgba(139, 92, 246, 0.12)' },
  chased: { color: 'var(--accent-warm)', bg: 'rgba(245, 158, 11, 0.12)' },
  fomo: { color: 'var(--loss)', bg: 'rgba(248, 113, 113, 0.12)' },
};

function EntryQualityBadge({ quality }: { quality: EntryQuality }) {
  const style = ENTRY_QUALITY_STYLES[quality];
  return (
    <span style={{
      fontSize: '10px',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.3px',
      padding: '1px 6px',
      borderRadius: '4px',
      color: style.color,
      background: style.bg,
    }}>
      {quality}
    </span>
  );
}

const thStyle = { ...tableHeaderStyle, padding: '18px 24px' };
const tdStyle = { ...tableCellStyle, padding: '16px 24px' };

const threadLineStyle: React.CSSProperties = {
  borderLeft: '2px solid var(--border-light)',
  paddingLeft: '20px',
  paddingTop: '8px',
  paddingBottom: '8px',
  marginLeft: '17px',
};
const threadLineReflStyle: React.CSSProperties = {
  ...threadLineStyle,
  paddingTop: '4px',
  paddingBottom: '4px',
};
const expandedTdChart: React.CSSProperties = { padding: '8px 24px 4px 72px' };
const expandedTdThesis: React.CSSProperties = { padding: '4px 24px 4px 72px' };
const expandedTdTags: React.CSSProperties = { padding: '4px 24px 4px 72px' };
const expandedTdReflection: React.CSSProperties = { padding: '4px 24px 8px 72px' };
const expandedRowStyle: React.CSSProperties = { borderBottom: 'none' };
const legTdLeft: React.CSSProperties = { ...tdStyle, paddingLeft: '72px' };
const legTdMono: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'right',
  fontFamily: "'DM Mono', monospace",
  fontSize: '13px',
  color: 'var(--text-secondary)',
};
const thesisLabelStyle: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px',
};
const thesisTextStyle: React.CSSProperties = {
  fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.5,
};
const editBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--accent)', fontSize: '12px', fontWeight: 500,
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  padding: '4px 8px', borderRadius: '6px', flexShrink: 0,
  transition: 'background 0.15s',
};
const tagPillStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 500,
  padding: '3px 10px',
  borderRadius: '12px',
  background: 'rgba(139, 92, 246, 0.1)',
  color: 'var(--accent-violet)',
  border: '1px solid rgba(139, 92, 246, 0.2)',
};
