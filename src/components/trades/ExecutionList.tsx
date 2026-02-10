import { useState } from 'react';
import type { Position, Execution } from '../../types';
import { useStore } from '../../store/useStore';
import { formatCurrency, formatQuantity, formatDate } from '../../utils/format';
import { tableHeaderStyle, tableCellStyle } from '../../utils/styles';
import { Trash2, ArrowUpRight, ArrowDownRight, MoreVertical } from 'lucide-react';

interface ExecutionWithContext extends Execution {
  symbol: string;
  assetType: string;
}

interface ExecutionListProps {
  positions: Position[];
}

export default function ExecutionList({ positions }: ExecutionListProps) {
  const { deleteExecution } = useStore();
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ positionId: string; executionId: string } | null>(null);

  // Flatten all executions with position context, sorted by date descending
  const executions: ExecutionWithContext[] = positions
    .flatMap((p) =>
      p.executions.map((e) => ({
        ...e,
        symbol: p.symbol,
        assetType: p.assetType,
      }))
    )
    .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await deleteExecution(deleteConfirm.positionId, deleteConfirm.executionId);
    setDeleteConfirm(null);
    setMenuOpen(null);
  };

  if (executions.length === 0) {
    return (
      <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>No executions yet</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Click "New Trade" to record your first trade
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={thStyle}>Asset</th>
            <th style={thStyle}>Side</th>
            <th style={thStyle}>Date</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Price</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Quantity</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Value</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>P&L</th>
            <th style={{ ...thStyle, width: '40px' }}></th>
          </tr>
        </thead>
        <tbody>
          {executions.map((exec, idx) => {
            const value = exec.price * exec.quantity;

            return (
              <tr key={exec.id} style={{ borderBottom: '1px solid var(--border)', animation: `slideUp 0.35s ease-out ${idx * 0.04}s both` }}>
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
                      {exec.symbol.slice(0, 2)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{exec.symbol}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {exec.assetType}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={tdStyle}>
                  <span className={`badge ${exec.side === 'buy' ? 'badge-profit' : 'badge-loss'}`}>
                    {exec.side === 'buy' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {exec.side.toUpperCase()}
                  </span>
                </td>
                <td style={tdStyle}>
                  {formatDate(exec.executedAt)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                  {formatCurrency(exec.price)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                  {formatQuantity(exec.quantity)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>
                  {formatCurrency(value)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {exec.pnl !== null ? (
                    <div>
                      <div style={{
                        fontFamily: "'DM Mono', monospace",
                        fontWeight: 500,
                        color: exec.pnl >= 0 ? 'var(--profit)' : 'var(--loss)'
                      }}>
                        {exec.pnl >= 0 ? '+' : ''}{formatCurrency(exec.pnl)}
                      </div>
                      {exec.pnlPercent !== null && (
                        <div style={{
                          fontSize: '12px',
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
                <td style={tdStyle}>
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setMenuOpen(menuOpen === exec.id ? null : exec.id)}
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

                    {menuOpen === exec.id && (
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
                            onClick={() => {
                              setDeleteConfirm({ positionId: exec.positionId, executionId: exec.id });
                              setMenuOpen(null);
                            }}
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
              Delete Execution?
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
              This will remove the execution and recompute the position. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} className="btn-ghost">
                Cancel
              </button>
              <button
                onClick={handleDelete}
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
