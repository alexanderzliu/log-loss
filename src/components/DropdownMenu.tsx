import { type ReactNode, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

interface DropdownMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: ReactNode;
}

export default function DropdownMenu({ isOpen, onToggle, onClose, children }: DropdownMenuProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  useLayoutEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
  }, [isOpen]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        onClick={onToggle}
        aria-label="Actions"
        aria-haspopup="true"
        aria-expanded={isOpen}
        style={{
          background: 'transparent',
          border: 'none',
          padding: '6px',
          borderRadius: '8px',
          cursor: 'pointer',
          color: 'var(--text-muted)'
        }}
      >
        <MoreVertical size={16} />
      </button>

      {isOpen && createPortal(
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 10 }}
            onClick={onClose}
          />
          <div style={{
            position: 'fixed',
            top: pos.top,
            right: pos.right,
            width: '170px',
            background: 'var(--dropdown-bg)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--border-light)',
            borderRadius: '14px',
            zIndex: 20,
            padding: '6px',
            boxShadow: 'var(--dropdown-shadow)'
          }}>
            {children}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
