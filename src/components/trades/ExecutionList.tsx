import { useState } from 'react';
import type { Position, Execution } from '../../types';
import { useStore } from '../../store/useStore';
import { formatCurrency, formatQuantity, formatDate } from '../../utils/format';
import { tableHeaderStyle, tableCellStyle } from '../../utils/styles';
import ConfirmDialog from '../ConfirmDialog';
import DropdownMenu from '../DropdownMenu';
import { menuItemStyle } from '../../utils/menuStyles';
import { Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react';

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
                  <DropdownMenu
                    isOpen={menuOpen === exec.id}
                    onToggle={() => setMenuOpen(menuOpen === exec.id ? null : exec.id)}
                    onClose={() => setMenuOpen(null)}
                  >
                    <button
                      onClick={() => {
                        setDeleteConfirm({ positionId: exec.positionId, executionId: exec.id });
                        setMenuOpen(null);
                      }}
                      style={{ ...menuItemStyle, color: 'var(--loss)' }}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {deleteConfirm && (
        <ConfirmDialog
          title="Delete Execution?"
          message="This will remove the execution and recompute the position. This action cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}

const thStyle = tableHeaderStyle;
const tdStyle = tableCellStyle;

