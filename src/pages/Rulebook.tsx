import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import PageTransition from '../components/PageTransition';
import type { Rule } from '../types';

export default function Rulebook() {
  const rules = useStore(s => s.rules);
  const rulesLoading = useStore(s => s.rulesLoading);
  const fetchRules = useStore(s => s.fetchRules);
  const addRule = useStore(s => s.addRule);
  const updateRule = useStore(s => s.updateRule);
  const deleteRule = useStore(s => s.deleteRule);

  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    fetchRules();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = async () => {
    const trimmed = newContent.trim();
    if (!trimmed) return;
    try {
      await addRule(trimmed);
      setNewContent('');
    } catch {
      // toast handled in store
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  const startEdit = (rule: Rule) => {
    setEditingId(rule.id);
    setEditContent(rule.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const trimmed = editContent.trim();
    if (!trimmed) return;
    try {
      await updateRule(editingId, trimmed);
      setEditingId(null);
      setEditContent('');
    } catch {
      // toast handled in store
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRule(id);
    } catch {
      // toast handled in store
    }
  };

  return (
    <PageTransition>
      <div className="page-container">
        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <h1 className="page-header">Rulebook</h1>
          <p className="page-subtitle">Your personal trading rules and principles</p>
        </div>

        {/* Add Rule Input */}
        <div className="card" style={{
          padding: '20px 24px',
          marginBottom: '24px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
        }}>
          <input
            type="text"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a new trading rule..."
            maxLength={500}
            style={{
              flex: 1,
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '12px 16px',
              color: 'var(--text-primary)',
              fontSize: '14px',
              outline: 'none',
              fontFamily: 'inherit',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          />
          <button
            onClick={handleAdd}
            disabled={!newContent.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 20px',
              borderRadius: '10px',
              border: 'none',
              background: newContent.trim() ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: newContent.trim() ? '#000' : 'var(--text-muted)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: newContent.trim() ? 'pointer' : 'default',
              fontFamily: 'inherit',
              transition: 'all 0.2s',
              opacity: newContent.trim() ? 1 : 0.5,
            }}
          >
            <Plus size={16} />
            Add
          </button>
        </div>

        {/* Rules List */}
        {rulesLoading ? (
          <div className="card empty-state">
            <p className="empty-state-text">Loading...</p>
          </div>
        ) : rules.length === 0 ? (
          <div className="card empty-state">
            <p className="empty-state-title" style={{ fontSize: '16px', fontWeight: 600 }}>No rules yet</p>
            <p className="empty-state-text">
              Add your first trading rule above to build your personal rulebook
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rules.map((rule, idx) => (
              <div
                key={rule.id}
                className="card"
                style={{
                  padding: '16px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  position: 'relative',
                  overflow: 'hidden',
                  animation: `slideUp 0.35s ease-out ${idx * 0.04}s both`,
                }}
              >
                {/* Rule number */}
                <span style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--accent)',
                  minWidth: '28px',
                  textAlign: 'center',
                  opacity: 0.7,
                }}>
                  {idx + 1}.
                </span>

                {editingId === rule.id ? (
                  /* Edit mode */
                  <>
                    <input
                      type="text"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      maxLength={500}
                      autoFocus
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: '1px solid var(--border-accent)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        outline: 'none',
                        fontFamily: 'inherit',
                      }}
                    />
                    <button
                      onClick={saveEdit}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'rgba(52, 211, 153, 0.1)',
                        color: 'var(--profit)',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                      title="Save (Enter)"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={cancelEdit}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'rgba(248, 113, 113, 0.1)',
                        color: 'var(--loss)',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                      title="Cancel (Escape)"
                    >
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  /* View mode */
                  <>
                    <p
                      style={{
                        flex: 1,
                        color: 'var(--text-secondary)',
                        fontSize: '14px',
                        lineHeight: 1.6,
                        cursor: 'pointer',
                      }}
                      onClick={() => startEdit(rule)}
                      title="Click to edit"
                    >
                      {rule.content}
                    </p>
                    <button
                      onClick={() => startEdit(rule)}
                      className="btn-ghost"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        padding: 0,
                        color: 'var(--text-muted)',
                        opacity: 0.5,
                        transition: 'opacity 0.2s',
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; }}
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="btn-ghost"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        padding: 0,
                        color: 'var(--text-muted)',
                        opacity: 0.5,
                        transition: 'opacity 0.2s',
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--loss)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
