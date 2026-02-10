import { Fragment, useState } from 'react';
import type { Position } from '../../types';
import { useStore } from '../../store/useStore';
import { formatCurrency, formatQuantity, formatDate } from '../../utils/format';
import { calculateUnrealizedPnl } from '../../utils/aggregatePositions';
import { tableHeaderStyle, tableCellStyle } from '../../utils/styles';
import {
  MoreVertical,
  Edit2,
  Trash2,
  X,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface PositionListProps {
  positions: Position[];
  onEdit: (position: Position) => void;
  onClosePosition: (position: Position) => void;
}

export default function PositionList({ positions, onEdit, onClosePosition }: PositionListProps) {
  const { deletePosition, prices } = useStore();
  const [expandedPositions, setExpandedPositions] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const toggleExpanded = (key: string) => {
    setExpandedPositions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    await deletePosition(id);
    setDeleteConfirm(null);
    setMenuOpen(null);
  };

  if (positions.length === 0) {
    return (
      <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>No positions yet</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Click "New Trade" to open your first position
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={thStyle}>Asset</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Avg Entry</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Quantity</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Cost Basis</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>P&L</th>
            <th style={{ ...thStyle, width: '40px' }}></th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position, posIdx) => {
            const isExpanded = expandedPositions.has(position.id);
            const isOpen = position.status === 'open';
            const priceKey = `${position.symbol}-${position.assetType}`;
            const currentPrice = prices[priceKey]?.price;

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

            return (
              <Fragment key={position.id}>
                {/* Position row */}
                <tr
                  style={{
                    borderBottom: isExpanded ? 'none' : '1px solid var(--border)',
                    cursor: 'pointer',
                    animation: `slideUp 0.35s ease-out ${posIdx * 0.04}s both`,
                  }}
                  onClick={() => toggleExpanded(position.id)}
                >
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ color: 'var(--text-muted)', width: '16px' }}>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </div>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: 'var(--bg-elevated)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: '14px',
                        color: 'var(--text-primary)'
                      }}>
                        {position.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                          {position.symbol}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          {position.assetType} · {position.executions.length} execution{position.executions.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span className={`badge ${isOpen ? 'badge-profit' : 'badge-neutral'}`}>
                      {position.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                    {formatCurrency(position.avgEntryPrice)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                    {isOpen
                      ? formatQuantity(position.remainingQuantity)
                      : formatQuantity(position.totalQuantity)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>
                    {formatCurrency(costBasis)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {displayPnl !== null && displayPnl !== 0 ? (
                      <div>
                        <div style={{
                          fontFamily: "'DM Mono', monospace",
                          fontWeight: 500,
                          color: displayPnl >= 0 ? 'var(--profit)' : 'var(--loss)'
                        }}>
                          {displayPnl >= 0 ? '+' : ''}{formatCurrency(displayPnl)}
                        </div>
                        {displayPnlPercent !== null && (
                          <div style={{
                            fontSize: '12px',
                            color: displayPnlPercent >= 0 ? 'var(--profit)' : 'var(--loss)'
                          }}>
                            {displayPnlPercent >= 0 ? '+' : ''}{displayPnlPercent.toFixed(2)}%
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={() => setMenuOpen(menuOpen === position.id ? null : position.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: '6px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: 'var(--text-muted)'
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>

                      {menuOpen === position.id && (
                        <>
                          <div
                            style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                            onClick={() => setMenuOpen(null)}
                          />
                          <div style={{
                            position: 'absolute',
                            right: 0,
                            marginTop: '4px',
                            width: '170px',
                            background: 'var(--dropdown-bg)',
                            backdropFilter: 'blur(12px)',
                            border: '1px solid var(--border-light)',
                            borderRadius: '12px',
                            zIndex: 20,
                            padding: '6px',
                            boxShadow: 'var(--dropdown-shadow)'
                          }}>
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
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>

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
                              {formatCurrency(exec.price)} × {formatQuantity(exec.quantity)}
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
                        {formatCurrency(exec.price)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {formatQuantity(exec.quantity)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {formatCurrency(value)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {exec.pnl !== null ? (
                          <div>
                            <div style={{
                              fontFamily: "'DM Mono', monospace",
                              fontSize: '13px',
                              color: exec.pnl >= 0 ? 'var(--profit)' : 'var(--loss)'
                            }}>
                              {exec.pnl >= 0 ? '+' : ''}{formatCurrency(exec.pnl)}
                            </div>
                            {exec.pnlPercent !== null && (
                              <div style={{
                                fontSize: '11px',
                                color: exec.pnlPercent >= 0 ? 'var(--profit)' : 'var(--loss)'
                              }}>
                                {exec.pnlPercent >= 0 ? '+' : ''}{exec.pnlPercent.toFixed(2)}%
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
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

      {/* Delete Modal */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--overlay-bg)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          animation: 'overlayIn 0.25s ease-out',
        }}>
          <div className="card" style={{ padding: '24px', maxWidth: '400px', width: '100%', margin: '16px', animation: 'modalIn 0.3s ease-out' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
              Delete Position?
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
              This will delete the position and all its executions. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} className="btn-ghost">
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--loss)',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle = { ...tableHeaderStyle, padding: '18px 24px' };
const tdStyle = { ...tableCellStyle, padding: '16px 24px' };

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  width: '100%',
  padding: '10px 14px',
  background: 'transparent',
  border: 'none',
  borderRadius: '8px',
  color: 'var(--text-secondary)',
  fontSize: '14px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'left',
  transition: 'background 0.15s ease',
};
