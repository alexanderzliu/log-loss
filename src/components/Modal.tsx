import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
  /** Accent bar gradient, e.g. 'linear-gradient(90deg, var(--accent), transparent)'. Omit for no bar. */
  accentBar?: string;
  /** Header content rendered to the left of the close button */
  header?: ReactNode;
  /** Error message shown above content */
  error?: string | null;
}

export default function Modal({ onClose, children, maxWidth = '520px', accentBar, header, error }: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-6"
      style={{
        background: 'var(--overlay-bg)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'overlayIn 0.25s ease-out',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full overflow-hidden flex flex-col"
        style={{
          maxWidth,
          maxHeight: '85vh',
          background: 'var(--bg-surface)',
          borderRadius: '20px',
          border: '1px solid var(--border-light)',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(16, 185, 129, 0.04), 0 0 0 1px rgba(255,255,255,0.03)',
          animation: 'modalIn 0.35s var(--spring)',
        }}
      >
        {accentBar && (
          <div style={{
            height: '3px',
            background: accentBar,
            borderRadius: '20px 20px 0 0',
          }} />
        )}

        {header && (
          <div
            className="flex items-center justify-between"
            style={{ padding: '20px 24px 16px' }}
          >
            {header}
            <button
              onClick={onClose}
              className="modal-close-btn"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            >
              <X size={14} style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
        )}

        {error && (
          <div style={{
            padding: '10px 14px',
            borderRadius: '12px',
            fontSize: '13px',
            background: 'rgba(248, 113, 113, 0.06)',
            border: '1px solid rgba(248, 113, 113, 0.12)',
            color: 'var(--loss)',
            margin: header ? '0 24px 16px' : '24px 24px 16px',
          }}>
            {error}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
