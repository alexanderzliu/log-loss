import { Fragment, useState } from 'react';
import type { Position } from '../../types';
import { useStore } from '../../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { formatCurrency, formatPrice, formatQuantity, formatDate } from '../../utils/format';
import PnlDisplay from '../PnlDisplay';
import { priceKey as getPriceKey } from '../../utils/priceKey';
import { calculateUnrealizedPnl } from '../../utils/aggregatePositions';
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
  StickyNote,
  MessageSquare,
} from 'lucide-react';
import ReflectionList from './ReflectionList';

interface PositionListProps {
  positions: Position[];
  onEdit: (position: Position) => void;
  onClosePosition: (position: Position) => void;
  sortField?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (field: string) => void;
}

export default function PositionList({ positions, onEdit, onClosePosition, sortField, sortDir, onSort }: PositionListProps) {
  const { deletePosition, prices, addToast, reflections } = useStore(useShallow((s) => ({
    deletePosition: s.deletePosition,
    prices: s.prices,
    addToast: s.addToast,
    reflections: s.reflections,
  })));
  const [expandedPositions, toggleExpanded] = useSetToggle();
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    try {
      await deletePosition(id);
    } catch (err) {
      console.error('Failed to delete position:', err);
      addToast({ type: 'error', title: 'Delete Failed', message: 'Failed to delete position. Please try again.' });
    }
    setDeleteConfirm(null);
    setMenuOpen(null);
  };

  if (positions.length === 0) {
    return (
      <div className="card empty-state">
        <p className="empty-state-title">No positions yet</p>
        <p className="empty-state-text">Click "New Trade" to open your first position</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ overflow: 'visible' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={thStyle}>
              <SortHeader field="symbol" label="Asset" sortField={sortField} sortDir={sortDir} onSort={onSort} />
            </th>
            <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Avg Entry</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Quantity</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>
              <SortHeader field="costBasis" label="Cost Basis" sortField={sortField} sortDir={sortDir} onSort={onSort} align="right" />
            </th>
            <th style={{ ...thStyle, textAlign: 'right' }}>
              <SortHeader field="pnl" label="P&L" sortField={sortField} sortDir={sortDir} onSort={onSort} align="right" />
            </th>
            <th style={{ ...thStyle, width: '40px' }}></th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position, posIdx) => {
            const isExpanded = expandedPositions.has(position.id);
            const isOpen = position.status === 'open';
            const pk = getPriceKey(position);
            const currentPrice = prices[pk]?.price;

            let displayPnl: number | null = position.realizedPnl;
            let displayPnlPercent: number | null = position.realizedPnlPercent;

            if (isOpen) {
              const { pnl, pnlPercent } = calculateUnrealizedPnl(position, currentPrice);
              if (pnl !== null) {
                displayPnl = pnl;
                displayPnlPercent = pnlPercent;
              }
            }

            const costBasis = position.avgEntryPrice * (isOpen ? position.remainingQuantity : position.totalQuantity);
            const reflectionCount = (reflections[position.id] || []).length;

            return (
              <Fragment key={position.id}>
                {/* Position row */}
                <tr
                  style={{
                    borderBottom: isExpanded ? 'none' : '1px solid var(--border)',
                    cursor: 'pointer',
                    animation: `slideUp 0.35s ease-out ${Math.min(posIdx * 0.04, 0.4)}s both`,
                  }}
                  onClick={() => toggleExpanded(position.id)}
                >
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ color: 'var(--text-muted)', width: '16px' }}>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </div>
                      <div className="asset-icon">
                        {position.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                            {position.symbol}
                          </span>
                          {position.chain && (
                            <span className="chain-badge">{position.chain}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          <span>
                            {position.contractAddress
                              ? `${position.contractAddress.slice(0, 6)}...${position.contractAddress.slice(-4)}`
                              : position.assetType
                            } · {position.executions.length} execution{position.executions.length !== 1 ? 's' : ''}
                          </span>
                          {position.hypothesis && (
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
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span className={`badge ${isOpen ? 'badge-profit' : 'badge-neutral'}`}>
                      {position.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="font-mono text-right" style={tdStyle}>
                    {formatPrice(position.avgEntryPrice)}
                  </td>
                  <td className="font-mono text-right" style={tdStyle}>
                    {isOpen
                      ? formatQuantity(position.remainingQuantity)
                      : formatQuantity(position.totalQuantity)}
                  </td>
                  <td className="font-mono text-right font-medium" style={tdStyle}>
                    {formatCurrency(costBasis)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <PnlDisplay
                      pnl={displayPnl}
                      pnlPercent={displayPnlPercent}
                    />
                  </td>
                  <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu
                      isOpen={menuOpen === position.id}
                      onToggle={() => setMenuOpen(menuOpen === position.id ? null : position.id)}
                      onClose={() => setMenuOpen(null)}
                    >
                      <button
                        onClick={() => { onEdit(position); setMenuOpen(null); }}
                        style={menuItemStyle}
                      >
                        <Edit2 size={14} /> Edit
                      </button>
                      {isOpen && (
                        <button
                          onClick={() => { onClosePosition(position); setMenuOpen(null); }}
                          style={menuItemStyle}
                        >
                          <X size={14} /> Close Position
                        </button>
                      )}
                      <button
                        onClick={() => { setDeleteConfirm(position.id); setMenuOpen(null); }}
                        style={{ ...menuItemStyle, color: 'var(--loss)' }}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </DropdownMenu>
                  </td>
                </tr>

                {/* Expanded hypothesis/notes */}
                {isExpanded && (position.hypothesis || position.notes) && (
                  <tr style={{ background: 'var(--bg-tertiary)', borderBottom: 'none' }}>
                    <td colSpan={7} style={{ padding: '0 24px 0 72px' }}>
                      <div style={{
                        padding: '14px 16px',
                        borderLeft: '3px solid var(--accent-violet)',
                        background: 'rgba(139, 92, 246, 0.06)',
                        borderRadius: '0 8px 8px 0',
                        margin: '12px 0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}>
                        {position.hypothesis && (
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            <Lightbulb size={15} style={{ color: 'var(--accent-warm)', flexShrink: 0, marginTop: '2px' }} />
                            <div>
                              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Hypothesis</div>
                              <div style={{ fontSize: '13.5px', color: 'var(--text-primary)', lineHeight: 1.5, fontWeight: 500 }}>
                                {position.hypothesis}
                              </div>
                            </div>
                          </div>
                        )}
                        {position.notes && (
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            <StickyNote size={15} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />
                            <div>
                              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Notes</div>
                              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                {position.notes}
                              </div>
                            </div>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); onEdit(position); }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--accent-violet)',
                              fontSize: '12px',
                              fontWeight: 500,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                          >
                            <Edit2 size={12} /> Edit
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Expanded reflections */}
                {isExpanded && (
                  <tr style={{ background: 'var(--bg-tertiary)', borderBottom: 'none' }}>
                    <td colSpan={7} style={{ padding: '4px 24px 12px 72px' }}>
                      <ReflectionList positionId={position.id} />
                    </td>
                  </tr>
                )}

                {/* Expanded executions */}
                {isExpanded && position.executions.map((exec, execIdx) => {
                  const isLast = execIdx === position.executions.length - 1;
                  const value = exec.price * exec.quantity;

                  return (
                    <tr
                      key={exec.id}
                      style={{
                        borderBottom: isLast ? '1px solid var(--border)' : 'none',
                        background: 'var(--bg-tertiary)',
                        animation: `slideUp 0.25s ease-out ${execIdx * 0.03}s both`,
                      }}
                    >
                      <td style={{ ...tdStyle, paddingLeft: '72px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span className={`badge ${exec.side === 'buy' ? 'badge-profit' : 'badge-loss'}`}>
                            {exec.side === 'buy' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                            {exec.side.toUpperCase()}
                          </span>
                          <div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                              {formatPrice(exec.price)} × {formatQuantity(exec.quantity)}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {formatDate(exec.executedAt)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span className={`badge ${exec.side === 'buy' ? 'badge-profit' : 'badge-loss'}`} style={{ fontSize: '11px' }}>
                          {exec.side.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {formatPrice(exec.price)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {formatQuantity(exec.quantity)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {formatCurrency(value)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <PnlDisplay pnl={exec.pnl} pnlPercent={exec.pnlPercent} size="sm" />
                      </td>
                      <td style={tdStyle}></td>
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
          title="Delete Position?"
          message="This will delete the position and all its executions. This action cannot be undone."
          onConfirm={() => handleDelete(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
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

const thStyle = { ...tableHeaderStyle, padding: '18px 24px' };
const tdStyle = { ...tableCellStyle, padding: '16px 24px' };
