import type { ReactNode } from 'react';
import { MoreVertical } from 'lucide-react';

interface DropdownMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: ReactNode;
}

export default function DropdownMenu({ isOpen, onToggle, onClose, children }: DropdownMenuProps) {
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onToggle}
        style={{
          background: 'transparent',
          border: 'none',
          padding: '6px',
          borderRadius: '6px',
          cursor: 'pointer',
          color: 'var(--text-muted)'
        }}
      >
        <MoreVertical size={16} />
      </button>

      {isOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 10 }}
            onClick={onClose}
          />
          <div style={{
            position: 'absolute',
            right: 0,
            marginTop: '4px',
            width: '170px',
            background: 'var(--dropdown-bg)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--border-light)',
            borderRadius: '12px',
            zIndex: 20,
            padding: '6px',
            boxShadow: 'var(--dropdown-shadow)'
          }}>
            {children}
          </div>
        </>
      )}
    </div>
  );
}
