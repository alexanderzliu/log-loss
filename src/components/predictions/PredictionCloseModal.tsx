import { useState } from 'react';
import { TrendingDown } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { formatCurrency } from '../../utils/format';
import Modal from '../Modal';
import { FieldGroup, PrefixInput } from '../form';
import type { Prediction } from '../../types';

interface PredictionCloseModalProps {
  prediction: Prediction;
  onClose: () => void;
}

export default function PredictionCloseModal({ prediction, onClose }: PredictionCloseModalProps) {
  const { closePrediction, fetchPredictions } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exitPrice, setExitPrice] = useState<number | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const pnlPreview = exitPrice !== null
    ? (exitPrice - prediction.entryPrice) * prediction.quantity
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (exitPrice === null) return;
    setError(null);
    setLoading(true);

    try {
      await closePrediction(prediction.id, {
        exitPrice,
        date,
        notes: notes || undefined,
      });
      await fetchPredictions();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const headerContent = (
    <div className="flex items-center gap-3">
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '12px',
        background: 'rgba(248, 113, 113, 0.1)',
        border: '1px solid rgba(248, 113, 113, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <TrendingDown size={18} style={{ color: 'var(--loss)' }} />
      </div>
      <div>
        <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>Close Prediction</h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
          Sell your position at a custom price
        </p>
      </div>
    </div>
  );

  return (
    <Modal
      onClose={onClose}
      maxWidth="440px"
      accentBar="linear-gradient(90deg, var(--loss), transparent)"
      header={headerContent}
      error={error}
    >
        <form onSubmit={handleSubmit} style={{ padding: '0 24px 24px' }}>

          {/* Context */}
          <div style={{
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            marginBottom: '16px',
            fontSize: '13px',
          }}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>
              {prediction.market}
            </div>
            <div style={{ display: 'flex', gap: '12px', color: 'var(--text-muted)', fontSize: '12px' }}>
              <span>
                <span className={`badge ${prediction.side === 'yes' ? 'badge-profit' : 'badge-loss'}`} style={{ fontSize: '10px', marginRight: '4px' }}>
                  {prediction.side.toUpperCase()}
                </span>
              </span>
              <span>Entry: ${prediction.entryPrice.toFixed(2)}</span>
              <span>Qty: {prediction.quantity}</span>
            </div>
          </div>

          <div className="flex flex-col" style={{ gap: '12px' }}>
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup label="Exit Price">
                <PrefixInput
                  prefix="$"
                  type="number"
                  value={exitPrice ?? ''}
                  onChange={(e) => setExitPrice(e.target.value === '' ? null : parseFloat(e.target.value))}
                  step="0.01"
                  min="0"
                  max="1"
                  placeholder="0.75"
                  required
                />
              </FieldGroup>
              <FieldGroup label="Exit Date">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full"
                  required
                />
              </FieldGroup>
            </div>

            {/* P&L Preview */}
            {pnlPreview !== null && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderRadius: '10px',
                background: pnlPreview >= 0
                  ? 'rgba(52, 211, 153, 0.06)'
                  : 'rgba(248, 113, 113, 0.06)',
                border: `1px solid ${pnlPreview >= 0 ? 'rgba(52, 211, 153, 0.15)' : 'rgba(248, 113, 113, 0.15)'}`,
              }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Projected P&L
                </span>
                <span style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: "'DM Mono', monospace",
                  color: pnlPreview >= 0 ? 'var(--profit)' : 'var(--loss)',
                }}>
                  {pnlPreview >= 0 ? '+' : ''}{formatCurrency(pnlPreview)}
                </span>
              </div>
            )}

            <FieldGroup label="Notes" optional>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Additional notes..."
                className="w-full resize-none"
              />
            </FieldGroup>
          </div>

          {/* Actions */}
          <div
            className="flex gap-3"
            style={{ paddingTop: '20px', marginTop: '20px', borderTop: '1px solid var(--border)' }}
          >
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || exitPrice === null}
              className="btn-primary flex-1"
              style={{
                background: 'linear-gradient(135deg, var(--loss) 0%, #dc2626 100%)',
                boxShadow: '0 2px 12px rgba(248, 113, 113, 0.2)',
              }}
            >
              {loading ? 'Closing...' : 'Close Prediction'}
            </button>
          </div>
        </form>
    </Modal>
  );
}
