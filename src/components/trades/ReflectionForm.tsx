import { useState } from 'react';
import type { Reflection, ReflectionType, ReflectionSuggestion } from '../../types';
import Modal from '../Modal';
import { CheckCircle, GraduationCap, AlertTriangle, Sparkles, X, Loader2 } from 'lucide-react';
import { suggestReflections } from '../../api/ai';

const TYPES: { value: ReflectionType; label: string; icon: typeof CheckCircle; color: string; bg: string }[] = [
  { value: 'success', label: 'Success', icon: CheckCircle, color: 'var(--profit)', bg: 'rgba(52, 211, 153, 0.12)' },
  { value: 'lesson', label: 'Lesson', icon: GraduationCap, color: 'var(--accent-violet)', bg: 'rgba(139, 92, 246, 0.12)' },
  { value: 'mistake', label: 'Mistake', icon: AlertTriangle, color: 'var(--accent-warm)', bg: 'rgba(245, 158, 11, 0.12)' },
];

const TYPE_ICONS: Record<ReflectionType, typeof CheckCircle> = {
  success: CheckCircle,
  lesson: GraduationCap,
  mistake: AlertTriangle,
};

const TYPE_COLORS: Record<ReflectionType, { color: string; bg: string }> = {
  success: { color: 'var(--profit)', bg: 'rgba(52, 211, 153, 0.08)' },
  lesson: { color: 'var(--accent-violet)', bg: 'rgba(139, 92, 246, 0.08)' },
  mistake: { color: 'var(--accent-warm)', bg: 'rgba(245, 158, 11, 0.08)' },
};

interface ReflectionFormProps {
  positionId: string;
  editing?: Reflection | null;
  onSave: (data: { positionId: string; type: ReflectionType; content: string }) => Promise<void>;
  onClose: () => void;
}

export default function ReflectionForm({ positionId, editing, onSave, onClose }: ReflectionFormProps) {
  const [type, setType] = useState<ReflectionType>(editing?.type || 'success');
  const [content, setContent] = useState(editing?.content || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ReflectionSuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError('Content is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ positionId, type, content: content.trim() });
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  const handleAiSuggest = async () => {
    setAiLoading(true);
    setAiError(null);
    setSuggestions([]);
    try {
      const results = await suggestReflections(positionId);
      setSuggestions(results);
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes('API key')) {
        setAiError('AI features require an OpenAI API key configured on the server.');
      } else if (message.includes('Rate limit')) {
        setAiError('Rate limit reached. Please try again in a moment.');
      } else {
        setAiError(message);
      }
    } finally {
      setAiLoading(false);
    }
  };

  const acceptSuggestion = (suggestion: ReflectionSuggestion) => {
    setType(suggestion.type);
    setContent(suggestion.content);
    setSuggestions([]);
  };

  const dismissSuggestion = (index: number) => {
    setSuggestions(prev => prev.filter((_, i) => i !== index));
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

        {/* AI Suggest Button */}
        {!editing && (
          <div>
            <button
              onClick={handleAiSuggest}
              disabled={aiLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: 'var(--radius-btn)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                background: 'rgba(139, 92, 246, 0.08)',
                color: 'var(--accent-violet)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: aiLoading ? 'default' : 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s ease',
                opacity: aiLoading ? 0.7 : 1,
              }}
            >
              {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {aiLoading ? 'Generating...' : 'AI Suggest'}
            </button>

            {/* AI Error */}
            {aiError && (
              <p style={{ fontSize: '12px', color: 'var(--loss)', marginTop: '8px' }}>
                {aiError}
              </p>
            )}

            {/* Suggestion Cards */}
            {suggestions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                {suggestions.map((suggestion, idx) => {
                  const SugIcon = TYPE_ICONS[suggestion.type];
                  const colors = TYPE_COLORS[suggestion.type];
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        border: `1px solid var(--border)`,
                        background: colors.bg,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <SugIcon size={13} style={{ color: colors.color }} />
                        <span style={{ fontSize: '12px', fontWeight: 600, color: colors.color, textTransform: 'capitalize' }}>
                          {suggestion.type}
                        </span>
                        <button
                          onClick={() => dismissSuggestion(idx)}
                          style={{
                            marginLeft: 'auto',
                            display: 'flex',
                            alignItems: 'center',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '2px',
                          }}
                          title="Dismiss"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {suggestion.content}
                      </p>
                      <button
                        onClick={() => acceptSuggestion(suggestion)}
                        style={{
                          alignSelf: 'flex-start',
                          padding: '4px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          background: colors.color,
                          color: '#000',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        Accept
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

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
