import { useEffect, useState } from 'react';
import type { Reflection, ReflectionType } from '../../types';
import { useStore } from '../../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import ReflectionForm from './ReflectionForm';
import ConfirmDialog from '../ConfirmDialog';
import DropdownMenu from '../DropdownMenu';
import { menuItemStyle } from '../../utils/menuStyles';
import {
  Plus,
  BookOpen,
  Lightbulb,
  AlertTriangle,
  Edit2,
  Trash2,
} from 'lucide-react';

const EMPTY_REFLECTIONS: Reflection[] = [];

const TYPE_CONFIG: Record<ReflectionType, { icon: typeof BookOpen; color: string; bg: string; label: string }> = {
  reflection: { icon: BookOpen, color: 'var(--accent-violet)', bg: 'rgba(139, 92, 246, 0.1)', label: 'Reflection' },
  lesson: { icon: Lightbulb, color: 'var(--profit)', bg: 'rgba(52, 211, 153, 0.1)', label: 'Lesson' },
  mistake: { icon: AlertTriangle, color: 'var(--accent-warm)', bg: 'rgba(245, 158, 11, 0.1)', label: 'Mistake' },
};

interface ReflectionListProps {
  positionId: string;
}

export default function ReflectionList({ positionId }: ReflectionListProps) {
  const { reflections, fetchReflections, createReflection, updateReflection, deleteReflection, addToast } = useStore(
    useShallow((s) => ({
      reflections: s.reflections[positionId] ?? EMPTY_REFLECTIONS,
      fetchReflections: s.fetchReflections,
      createReflection: s.createReflection,
      updateReflection: s.updateReflection,
      deleteReflection: s.deleteReflection,
      addToast: s.addToast,
    }))
  );

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Reflection | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchReflections(positionId);
  }, [positionId, fetchReflections]);

  const handleSave = async (data: { positionId: string; type: ReflectionType; content: string; tags: string[] }) => {
    if (editing) {
      await updateReflection(editing.id, { content: data.content, type: data.type, tags: data.tags });
    } else {
      await createReflection(data);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteReflection(id, positionId);
    } catch (err) {
      console.error('Failed to delete reflection:', err);
      addToast({ type: 'error', title: 'Delete Failed', message: 'Failed to delete reflection. Please try again.' });
    }
    setDeleteConfirm(null);
    setMenuOpen(null);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Reflections {reflections.length > 0 && `(${reflections.length})`}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); setEditing(null); setShowForm(true); }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--accent-violet)',
            fontSize: '12px',
            fontWeight: 500,
            padding: '4px 8px',
            borderRadius: '6px',
            fontFamily: 'inherit',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
        >
          <Plus size={13} /> Add
        </button>
      </div>

      {/* Reflection items */}
      {reflections.length === 0 ? (
        <div style={{
          padding: '12px 14px',
          borderRadius: '8px',
          background: 'rgba(139, 92, 246, 0.04)',
          border: '1px dashed var(--border)',
          fontSize: '12.5px',
          color: 'var(--text-muted)',
          textAlign: 'center',
        }}>
          Add a reflection to capture what you learned from this trade
        </div>
      ) : (
        reflections.map((r) => {
          const cfg = TYPE_CONFIG[r.type];
          const Icon = cfg.icon;
          return (
            <div
              key={r.id}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
              }}
            >
              <div style={{
                padding: '5px',
                borderRadius: '6px',
                background: cfg.bg,
                color: cfg.color,
                flexShrink: 0,
                marginTop: '1px',
              }}>
                <Icon size={13} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: cfg.color,
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                  }}>
                    {cfg.label}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {formatDate(r.createdAt)}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {r.content}
                </div>
                {r.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                    {r.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          padding: '2px 7px',
                          borderRadius: 'var(--radius-badge)',
                          background: 'rgba(139, 92, 246, 0.08)',
                          color: 'var(--text-muted)',
                          fontSize: '11px',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <DropdownMenu
                  isOpen={menuOpen === r.id}
                  onToggle={() => setMenuOpen(menuOpen === r.id ? null : r.id)}
                  onClose={() => setMenuOpen(null)}
                >
                  <button
                    onClick={() => { setEditing(r); setShowForm(true); setMenuOpen(null); }}
                    style={menuItemStyle}
                  >
                    <Edit2 size={14} /> Edit
                  </button>
                  <button
                    onClick={() => { setDeleteConfirm(r.id); setMenuOpen(null); }}
                    style={{ ...menuItemStyle, color: 'var(--loss)' }}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </DropdownMenu>
              </div>
            </div>
          );
        })
      )}

      {/* Form modal */}
      {showForm && (
        <ReflectionForm
          positionId={positionId}
          editing={editing}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <ConfirmDialog
          title="Delete Reflection?"
          message="This reflection will be permanently deleted."
          onConfirm={() => handleDelete(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
