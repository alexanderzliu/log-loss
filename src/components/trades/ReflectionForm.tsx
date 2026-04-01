import { useState } from 'react';
import type { Reflection, ReflectionType } from '../../types';
import Modal from '../Modal';
import { CheckCircle, GraduationCap, AlertTriangle } from 'lucide-react';

const TYPES: { value: ReflectionType; label: string; icon: typeof CheckCircle; color: string; bg: string }[] = [
  { value: 'success', label: 'Success', icon: CheckCircle, color: 'var(--profit)', bg: 'rgba(52, 211, 153, 0.12)' },
  { value: 'lesson', label: 'Lesson', icon: GraduationCap, color: 'var(--accent-violet)', bg: 'rgba(139, 92, 246, 0.12)' },
  { value: 'mistake', label: 'Mistake', icon: AlertTriangle, color: 'var(--accent-warm)', bg: 'rgba(245, 158, 11, 0.12)' },
];

interface ReflectionFormProps {
  tradeId: string;
  editing?: Reflection | null;
  onSave: (data: { tradeId: string; type: ReflectionType; content: string }) => Promise<void>;
  onClose: () => void;
}

export default function ReflectionForm({ tradeId, editing, onSave, onClose }: ReflectionFormProps) {
  const [type, setType] = useState<ReflectionType>(editing?.type || 'success');
  const [content, setContent] = useState(editing?.content || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError('Content is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ tradeId, type, content: content.trim() });
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      maxWidth="520px"
      accentBar={`linear-gradient(90deg, ${TYPES.find((t) => t.value === type)?.color}, transparent)`}
      header={
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {editing ? 'Edit Reflection' : 'Add Reflection'}
        </h3>
      }
      error={error}
    >
      <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
        {/* Type selector */}
        <div>
          <label style={labelStyle}>Type</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {TYPES.map((t) => {
              const Icon = t.icon;
              const isActive = type === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-btn)',
                    border: `1px solid ${isActive ? t.color : 'var(--border)'}`,
                    background: isActive ? t.bg : 'transparent',
                    color: isActive ? t.color : 'var(--text-muted)',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={14} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div>
          <label style={labelStyle}>Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What did you observe, learn, or want to remember about this trade?"
            rows={5}
            style={textareaStyle}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving || !content.trim()}
            className="btn-primary"
            style={{ opacity: saving || !content.trim() ? 0.5 : 1 }}
          >
            {saving ? 'Saving...' : editing ? 'Update' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: '8px',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 'var(--radius-input)',
  border: '1px solid var(--border)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  fontSize: '14px',
  fontFamily: 'inherit',
  lineHeight: 1.6,
  resize: 'vertical',
  outline: 'none',
};
