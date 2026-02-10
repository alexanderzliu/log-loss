import { useState } from 'react';
import { CircleDot, Zap, Target } from 'lucide-react';
import { useStore } from '../../store/useStore';
import Modal from '../Modal';
import { FieldSection, FieldGroup, PrefixInput } from '../form';
import type { Prediction, PredictionFormData, PredictionUpdateData } from '../../types';

interface PredictionFormProps {
  prediction?: Prediction | null;
  isEditing?: boolean;
  onClose: () => void;
}

export default function PredictionForm({ prediction, isEditing, onClose }: PredictionFormProps) {
  const { createPrediction, updatePrediction, fetchPredictions } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<PredictionFormData>({
    market: prediction?.market || '',
    category: prediction?.category || '',
    side: prediction?.side || 'yes',
    entryPrice: prediction?.entryPrice || 0,
    quantity: prediction?.quantity || 0,
    date: new Date().toISOString().split('T')[0],
    expiresAt: prediction?.expiresAt || null,
    hypothesis: prediction?.hypothesis || '',
    notes: prediction?.notes || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isEditing && prediction) {
        const updateData: PredictionUpdateData = {
          market: formData.market,
          category: formData.category,
          hypothesis: formData.hypothesis,
          notes: formData.notes,
        };
        await updatePrediction(prediction.id, updateData);
      } else {
        await createPrediction(formData);
      }
      await fetchPredictions();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'number'
          ? value === ''
            ? null
            : parseFloat(value)
          : value,
    }));
  };

  const title = isEditing ? 'Edit Prediction' : 'New Prediction';
  const costBasis = formData.entryPrice && formData.quantity
    ? formData.entryPrice * formData.quantity
    : 0;
  const impliedProbability = formData.entryPrice
    ? Math.round(formData.entryPrice * 100)
    : 0;

  const headerContent = (
    <div className="flex items-center gap-3">
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '12px',
        background: 'var(--accent-glow)',
        border: '1px solid rgba(16, 185, 129, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <CircleDot size={18} style={{ color: 'var(--accent)' }} />
      </div>
      <div>
        <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>{title}</h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
          {isEditing ? `Editing prediction` : 'Enter your prediction details'}
        </p>
      </div>
    </div>
  );

  return (
    <Modal
      onClose={onClose}
      accentBar={isEditing
        ? 'linear-gradient(90deg, var(--accent-warm), rgba(245, 158, 11, 0.1))'
        : 'linear-gradient(90deg, var(--accent), rgba(16, 185, 129, 0.1))'}
      header={headerContent}
      error={error}
    >
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1" style={{ padding: '0 24px 24px' }}>

          <div className="flex flex-col" style={{ gap: '16px' }}>
            {/* Market Section */}
            <FieldSection label="Market" icon={<CircleDot size={12} />}>
              <FieldGroup label="Market / Event">
                <input
                  type="text"
                  name="market"
                  value={formData.market}
                  onChange={handleChange}
                  placeholder="e.g., Will BTC exceed $100K by March?"
                  className="w-full"
                  required
                />
              </FieldGroup>
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="Category" optional>
                  <input
                    type="text"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    placeholder="e.g., Crypto"
                    className="w-full"
                  />
                </FieldGroup>
                <FieldGroup label="Expiration" optional>
                  <input
                    type="date"
                    name="expiresAt"
                    value={formData.expiresAt || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value || null }))}
                    className="w-full"
                  />
                </FieldGroup>
              </div>
            </FieldSection>

            {!isEditing && (
              <>
                {/* Position Section */}
                <FieldSection label="Position" icon={<Zap size={12} />}>
                  {/* Yes / No toggle */}
                  <div style={{
                    display: 'flex',
                    gap: '3px',
                    padding: '3px',
                    borderRadius: '12px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                  }}>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, side: 'yes' }))}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '10px',
                        fontWeight: 600,
                        fontSize: '13px',
                        fontFamily: 'inherit',
                        letterSpacing: '0.3px',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        background: formData.side === 'yes'
                          ? 'rgba(52, 211, 153, 0.12)'
                          : 'transparent',
                        color: formData.side === 'yes'
                          ? 'var(--profit)'
                          : 'var(--text-muted)',
                        boxShadow: formData.side === 'yes'
                          ? 'inset 0 0 0 1px rgba(52, 211, 153, 0.2)'
                          : 'none',
                      }}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, side: 'no' }))}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '10px',
                        fontWeight: 600,
                        fontSize: '13px',
                        fontFamily: 'inherit',
                        letterSpacing: '0.3px',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        background: formData.side === 'no'
                          ? 'rgba(248, 113, 113, 0.12)'
                          : 'transparent',
                        color: formData.side === 'no'
                          ? 'var(--loss)'
                          : 'var(--text-muted)',
                        boxShadow: formData.side === 'no'
                          ? 'inset 0 0 0 1px rgba(248, 113, 113, 0.2)'
                          : 'none',
                      }}
                    >
                      No
                    </button>
                  </div>

                  <FieldGroup label="Entry Date">
                    <input
                      type="date"
                      name="date"
                      value={formData.date}
                      onChange={handleChange}
                      className="w-full"
                      required
                    />
                  </FieldGroup>

                  <div className="grid grid-cols-2 gap-3">
                    <FieldGroup label="Entry Price">
                      <PrefixInput
                        prefix="$"
                        type="number"
                        name="entryPrice"
                        value={formData.entryPrice || ''}
                        onChange={handleChange}
                        step="0.01"
                        min="0.01"
                        max="0.99"
                        placeholder="0.55"
                        required
                      />
                    </FieldGroup>
                    <FieldGroup label="Contracts">
                      <input
                        type="number"
                        name="quantity"
                        value={formData.quantity || ''}
                        onChange={handleChange}
                        step="1"
                        min="1"
                        placeholder="10"
                        className="w-full"
                        required
                      />
                    </FieldGroup>
                  </div>

                  {/* Inline summary */}
                  {costBasis > 0 && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                    }}>
                      <div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cost Basis</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'DM Mono', monospace" }}>
                          ${costBasis.toFixed(2)}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {impliedProbability}% implied
                        </div>
                      </div>
                    </div>
                  )}
                </FieldSection>
              </>
            )}

            {/* Thesis Section */}
            <FieldSection label="Thesis" icon={<Target size={12} />}>
              <FieldGroup label="Hypothesis">
                <textarea
                  name="hypothesis"
                  value={formData.hypothesis}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Why are you making this prediction?"
                  className="w-full resize-none"
                />
              </FieldGroup>
              <FieldGroup label="Notes">
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Additional notes..."
                  className="w-full resize-none"
                />
              </FieldGroup>
            </FieldSection>
          </div>

          {/* Actions */}
          <div
            className="flex gap-3"
            style={{ paddingTop: '20px', marginTop: '20px', borderTop: '1px solid var(--border)' }}
          >
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Saving...' : isEditing ? 'Update Prediction' : 'Add Prediction'}
            </button>
          </div>
        </form>
    </Modal>
  );
}
