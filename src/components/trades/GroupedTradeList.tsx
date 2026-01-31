import { Fragment, useState } from 'react';
import type { Trade } from '../../types';
import type { GroupedTrades } from '../../utils/aggregatePositions';
import { useStore } from '../../store/useStore';
import { formatCurrency, formatQuantity, formatDate, calculatePnl } from '../../utils/format';
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

interface GroupedTradeListProps {
  groups: GroupedTrades[];
  onEdit: (trade: Trade) => void;
  onClosePosition: (trade: Trade) => void;
}

export default function GroupedTradeList({ groups, onEdit, onClosePosition }: GroupedTradeListProps) {
  const { deleteTrade, prices } = useStore();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const toggleExpanded = (key: string) => {
    setExpandedGroups((prev) => {
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
    await deleteTrade(id);
    setDeleteConfirm(null);
    setMenuOpen(null);
  };

  if (groups.length === 0) {
    return (
      <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>No trades yet</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Click "New Trade" to record your first trade
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
            <th style={{ ...thStyle, textAlign: 'center' }}>Trades</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Total Value</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Realized P&L</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const groupKey = `${group.symbol}-${group.assetType}`;
            const isExpanded = expandedGroups.has(groupKey);
            const priceKey = groupKey;
            const currentPrice = prices[priceKey]?.price;

            return (
              <Fragment key={groupKey}>
                {/* Group header row */}
                <tr
                  style={{
                    borderBottom: isExpanded ? 'none' : '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                  onClick={() => toggleExpanded(groupKey)}
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
                        {group.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                          {group.symbol}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          {group.assetType}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                      {group.openCount > 0 && (
                        <span className="badge badge-profit" style={{ fontSize: '11px' }}>
                          {group.openCount} open
                        </span>
                      )}
                      {group.closedCount > 0 && (
                        <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                          {group.closedCount} closed
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>
                    {formatCurrency(group.totalValue)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {group.totalPnl !== null ? (
                      <span style={{
                        fontFamily: "'DM Mono', monospace",
                        fontWeight: 500,
                        color: group.totalPnl >= 0 ? 'var(--profit)' : 'var(--loss)'
                      }}>
                        {group.totalPnl >= 0 ? '+' : ''}{formatCurrency(group.totalPnl)}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                </tr>

                {/* Expanded individual trades */}
                {isExpanded && group.trades.map((trade, idx) => {
                  const isOpen = trade.status === 'open' && trade.side === 'buy';
                  const isLast = idx === group.trades.length - 1;

                  let displayPnl = trade.pnl;
                  let displayPnlPercent = trade.pnlPercent;

                  if (isOpen) {
                    const { pnl, pnlPercent } = calculatePnl(trade.entryPrice, currentPrice, trade.quantity);
                    displayPnl = pnl ?? trade.pnl;
                    displayPnlPercent = pnlPercent ?? trade.pnlPercent;
                  }

                  return (
                    <tr
                      key={trade.id}
                      style={{
                        borderBottom: isLast ? '1px solid var(--border)' : 'none',
                        background: 'var(--bg-tertiary)',
                      }}
                    >
                      <td style={{ ...tdStyle, paddingLeft: '72px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span className={`badge ${trade.side === 'buy' ? 'badge-profit' : 'badge-loss'}`}>
                            {trade.side === 'buy' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                            {trade.side.toUpperCase()}
                          </span>
                          <div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                              {formatCurrency(trade.entryPrice)} × {formatQuantity(trade.quantity)}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {formatDate(trade.entryDate)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                          {trade.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {formatCurrency(trade.entryPrice * trade.quantity)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          {displayPnl !== null ? (
                            <div>
                              <div style={{
                                fontFamily: "'DM Mono', monospace",
                                fontSize: '13px',
                                color: displayPnl >= 0 ? 'var(--profit)' : 'var(--loss)'
                              }}>
                                {displayPnl >= 0 ? '+' : ''}{formatCurrency(displayPnl)}
                              </div>
                              {displayPnlPercent !== null && (
                                <div style={{
                                  fontSize: '11px',
                                  color: displayPnlPercent >= 0 ? 'var(--profit)' : 'var(--loss)'
                                }}>
                                  {displayPnlPercent >= 0 ? '+' : ''}{displayPnlPercent.toFixed(2)}%
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}

                          {/* Action menu */}
                          <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setMenuOpen(menuOpen === trade.id ? null : trade.id)}
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

                            {menuOpen === trade.id && (
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
                                    onClick={() => { onEdit(trade); setMenuOpen(null); }}
                                    style={menuItemStyle}
                                  >
                                    <Edit2 size={14} /> Edit
                                  </button>
                                  {isOpen && (
                                    <button
                                      onClick={() => { onClosePosition(trade); setMenuOpen(null); }}
                                      style={menuItemStyle}
                                    >
                                      <X size={14} /> Close Position
                                    </button>
                                  )}
                                  <button
                                    onClick={() => { setDeleteConfirm(trade.id); setMenuOpen(null); }}
                                    style={{ ...menuItemStyle, color: 'var(--loss)' }}
                                  >
                                    <Trash2 size={14} /> Delete
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
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
          zIndex: 50
        }}>
          <div className="card" style={{ padding: '24px', maxWidth: '400px', width: '100%', margin: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
              Delete Trade?
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
              This action cannot be undone.
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
