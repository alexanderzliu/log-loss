import { useState } from 'react';
import type { Trade } from '../../types';
import { useStore } from '../../store/useStore';
import { formatCurrency, formatQuantity, formatDate, calculatePnl } from '../../utils/format';
import { tableHeaderStyle, tableCellStyle } from '../../utils/styles';
import { MoreVertical, Edit2, Trash2, X, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface TradeListProps {
  trades: Trade[];
  onEdit: (trade: Trade) => void;
  onClosePosition: (trade: Trade) => void;
}

export default function TradeList({ trades, onEdit, onClosePosition }: TradeListProps) {
  const { deleteTrade, prices } = useStore();
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    await deleteTrade(id);
    setDeleteConfirm(null);
    setMenuOpen(null);
  };

  if (trades.length === 0) {
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
            <th style={thStyle}>Type</th>
            <th style={thStyle}>Date</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Price</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Quantity</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Value</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>P&L</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
            <th style={{ ...thStyle, width: '40px' }}></th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => {
            const priceKey = `${trade.symbol}-${trade.assetType}`;
            const currentPrice = prices[priceKey]?.price;
            const isOpen = trade.status === 'open' && trade.side === 'buy';

            let displayPnl = trade.pnl;
            let displayPnlPercent = trade.pnlPercent;

            if (isOpen) {
              const { pnl, pnlPercent } = calculatePnl(trade.entryPrice, currentPrice, trade.quantity);
              displayPnl = pnl ?? trade.pnl;
              displayPnlPercent = pnlPercent ?? trade.pnlPercent;
            }

            const value = trade.entryPrice * trade.quantity;

            return (
              <tr key={trade.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'var(--bg-elevated)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      fontSize: '12px',
                      color: 'var(--text-primary)'
                    }}>
                      {trade.symbol.slice(0, 2)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{trade.symbol}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {trade.assetType}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={tdStyle}>
                  <span className={`badge ${trade.side === 'buy' ? 'badge-profit' : 'badge-loss'}`}>
                    {trade.side === 'buy' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {trade.side.toUpperCase()}
                  </span>
                </td>
                <td style={tdStyle}>
                  {formatDate(trade.entryDate)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                  {formatCurrency(trade.entryPrice)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                  {formatQuantity(trade.quantity)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>
                  {formatCurrency(value)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {displayPnl !== null ? (
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
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <span className="badge badge-neutral">
                    {trade.status.toUpperCase()}
                  </span>
                </td>
                <td style={tdStyle}>
                  <div style={{ position: 'relative' }}>
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
                          background: 'rgba(18, 18, 26, 0.95)',
                          backdropFilter: 'blur(12px)',
                          border: '1px solid var(--border-light)',
                          borderRadius: '12px',
                          zIndex: 20,
                          padding: '6px',
                          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Delete Modal */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
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

const thStyle = tableHeaderStyle;
const tdStyle = tableCellStyle;

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
