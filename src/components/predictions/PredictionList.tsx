import { useState } from 'react';
import type { Prediction } from '../../types';
import { useStore } from '../../store/useStore';
import { formatCurrency, formatDate } from '../../utils/format';
import { tableHeaderStyle, tableCellStyle } from '../../utils/styles';
import { menuItemStyle } from '../../utils/menuStyles';
import ConfirmDialog from '../ConfirmDialog';
import DropdownMenu from '../DropdownMenu';
import {
  Edit2,
  Trash2,
  DollarSign,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface PredictionListProps {
  predictions: Prediction[];
  onEdit: (prediction: Prediction) => void;
  onClose: (prediction: Prediction) => void;
}

export default function PredictionList({ predictions, onEdit, onClose }: PredictionListProps) {
  const { closePrediction, deletePrediction } = useStore();
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [resolveConfirm, setResolveConfirm] = useState<{ id: string; resolution: 'yes' | 'no' } | null>(null);

  const handleDelete = async (id: string) => {
    await deletePrediction(id);
    setDeleteConfirm(null);
    setMenuOpen(null);
  };

  const handleResolve = async () => {
    if (!resolveConfirm) return;
    const prediction = predictions.find(p => p.id === resolveConfirm.id);
    if (!prediction) return;
    await closePrediction(resolveConfirm.id, {
      resolution: resolveConfirm.resolution,
      date: new Date().toISOString().split('T')[0],
    });
    setResolveConfirm(null);
    setMenuOpen(null);
  };

  const getResolvePreview = () => {
    if (!resolveConfirm) return { exitPrice: 0, pnl: 0 };
    const prediction = predictions.find(p => p.id === resolveConfirm.id);
    if (!prediction) return { exitPrice: 0, pnl: 0 };
    const exitPrice = resolveConfirm.resolution === 'yes'
      ? (prediction.side === 'yes' ? 1.00 : 0.00)
      : (prediction.side === 'yes' ? 0.00 : 1.00);
    const pnl = (exitPrice - prediction.entryPrice) * prediction.quantity;
    return { exitPrice, pnl };
  };

  if (predictions.length === 0) {
    return (
      <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>No predictions yet</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Click "New Prediction" to log your first bet
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={thStyle}>Market</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>Side</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Date</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Entry</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Exit</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Qty</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>P&L</th>
            <th style={{ ...thStyle, width: '40px' }}></th>
          </tr>
        </thead>
        <tbody>
          {predictions.map((prediction, idx) => {
            const isOpen = prediction.status === 'open';

            return (
              <tr
                key={prediction.id}
                style={{
                  borderBottom: '1px solid var(--border)',
                  animation: `slideUp 0.35s ease-out ${idx * 0.04}s both`,
                }}
              >
                <td style={{ ...tdStyle, maxWidth: '300px' }}>
                  <div>
                    <div style={{
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {prediction.market}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      {prediction.category && (
                        <span style={{
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: 'var(--bg-elevated)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border)',
                        }}>
                          {prediction.category}
                        </span>
                      )}
                      <StatusBadge prediction={prediction} />
                    </div>
                  </div>
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <span className={`badge ${prediction.side === 'yes' ? 'badge-profit' : 'badge-loss'}`}>
                    {prediction.side.toUpperCase()}
                  </span>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontSize: '13px', color: 'var(--text-muted)' }}>
                  {formatDate(prediction.openedAt)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                  ${prediction.entryPrice.toFixed(2)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                  {prediction.exitPrice !== null
                    ? `$${prediction.exitPrice.toFixed(2)}`
                    : <span style={{ color: 'var(--text-muted)' }}>---</span>
                  }
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                  {prediction.quantity}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {prediction.pnl !== null ? (
                    <div>
                      <div style={{
                        fontFamily: "'DM Mono', monospace",
                        fontWeight: 500,
                        color: prediction.pnl >= 0 ? 'var(--profit)' : 'var(--loss)',
                      }}>
                        {prediction.pnl >= 0 ? '+' : ''}{formatCurrency(prediction.pnl)}
                      </div>
                      {prediction.pnlPercent !== null && (
                        <div style={{
                          fontSize: '12px',
                          color: prediction.pnlPercent >= 0 ? 'var(--profit)' : 'var(--loss)',
                        }}>
                          {prediction.pnlPercent >= 0 ? '+' : ''}{prediction.pnlPercent.toFixed(2)}%
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>---</span>
                  )}
                </td>
                <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu
                    isOpen={menuOpen === prediction.id}
                    onToggle={() => setMenuOpen(menuOpen === prediction.id ? null : prediction.id)}
                    onClose={() => setMenuOpen(null)}
                  >
                    <button
                      onClick={() => { onEdit(prediction); setMenuOpen(null); }}
                      style={menuItemStyle}
                    >
                      <Edit2 size={14} /> Edit
                    </button>
                    {isOpen && (
                      <>
                        <button
                          onClick={() => { onClose(prediction); setMenuOpen(null); }}
                          style={menuItemStyle}
                        >
                          <DollarSign size={14} /> Close at Price
                        </button>
                        <button
                          onClick={() => { setResolveConfirm({ id: prediction.id, resolution: 'yes' }); setMenuOpen(null); }}
                          style={{ ...menuItemStyle, color: 'var(--profit)' }}
                        >
                          <CheckCircle2 size={14} /> Resolve Yes
                        </button>
                        <button
                          onClick={() => { setResolveConfirm({ id: prediction.id, resolution: 'no' }); setMenuOpen(null); }}
                          style={{ ...menuItemStyle, color: 'var(--loss)' }}
                        >
                          <XCircle size={14} /> Resolve No
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => { setDeleteConfirm(prediction.id); setMenuOpen(null); }}
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
          title="Delete Prediction?"
          message="This will permanently delete this prediction. This action cannot be undone."
          onConfirm={() => handleDelete(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {resolveConfirm && (() => {
        const { exitPrice, pnl } = getResolvePreview();
        return (
          <ConfirmDialog
            title={`Resolve as ${resolveConfirm.resolution.toUpperCase()}?`}
            message={`Exit at $${exitPrice.toFixed(2)} — P&L: ${pnl >= 0 ? '+' : ''}${formatCurrency(pnl)}`}
            onConfirm={handleResolve}
            onCancel={() => setResolveConfirm(null)}
          />
        );
      })()}
    </div>
  );
}

function StatusBadge({ prediction }: { prediction: Prediction }) {
  if (prediction.status === 'open') return null;

  if (prediction.resolution) {
    const isWin = prediction.pnl !== null && prediction.pnl > 0;
    return (
      <span style={{
        fontSize: '10px',
        padding: '1px 6px',
        borderRadius: '4px',
        background: isWin ? 'rgba(52, 211, 153, 0.1)' : 'rgba(248, 113, 113, 0.1)',
        color: isWin ? 'var(--profit)' : 'var(--loss)',
        border: `1px solid ${isWin ? 'rgba(52, 211, 153, 0.2)' : 'rgba(248, 113, 113, 0.2)'}`,
        fontWeight: 600,
      }}>
        RESOLVED {prediction.resolution.toUpperCase()}
      </span>
    );
  }

  return (
    <span style={{
      fontSize: '10px',
      padding: '1px 6px',
      borderRadius: '4px',
      background: 'var(--bg-elevated)',
      color: 'var(--text-muted)',
      border: '1px solid var(--border)',
      fontWeight: 600,
    }}>
      SOLD
    </span>
  );
}

const thStyle = { ...tableHeaderStyle, padding: '18px 24px' };
const tdStyle = { ...tableCellStyle, padding: '16px 24px' };
