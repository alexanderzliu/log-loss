import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';

// --- FilterDropdown: single-select dropdown ---

interface FilterDropdownProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  formatLabel?: (option: string) => string;
}

export function FilterDropdown({ label, value, options, onChange, formatLabel }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
  }, [isOpen]);

  const display = value ? (formatLabel ? formatLabel(value) : value) : label;
  const isActive = !!value;

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '10px',
          border: isActive ? '1px solid var(--border-accent)' : '1px solid var(--border)',
          background: isActive ? 'var(--accent-soft)' : 'var(--bg-elevated)',
          color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
          fontSize: '13px',
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: 'inherit',
          textTransform: 'capitalize',
          transition: 'all 0.15s ease',
          whiteSpace: 'nowrap',
        }}
      >
        {display}
        {isActive ? (
          <X
            size={12}
            onClick={(e) => { e.stopPropagation(); onChange(''); setIsOpen(false); }}
            style={{ opacity: 0.7 }}
          />
        ) : (
          <ChevronDown size={12} style={{ opacity: 0.5 }} />
        )}
      </button>

      {isOpen && createPortal(
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            onClick={() => setIsOpen(false)}
          />
          <div style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            minWidth: '140px',
            maxHeight: '240px',
            overflowY: 'auto',
            background: 'var(--dropdown-bg)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--border-light)',
            borderRadius: '12px',
            zIndex: 50,
            padding: '4px',
            boxShadow: 'var(--dropdown-shadow)',
          }}>
            {options.map(opt => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setIsOpen(false); }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: opt === value ? 'var(--accent-soft)' : 'transparent',
                  color: opt === value ? 'var(--accent)' : 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textTransform: 'capitalize',
                  transition: 'background 0.1s ease',
                }}
                onMouseEnter={(e) => { if (opt !== value) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { if (opt !== value) e.currentTarget.style.background = 'transparent'; }}
              >
                {formatLabel ? formatLabel(opt) : opt}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

// --- TagFilterSelect: multi-select for tags ---

interface TagFilterSelectProps {
  selected: string[];
  options: string[];
  onChange: (selected: string[]) => void;
}

export function TagFilterSelect({ selected, options, onChange }: TagFilterSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
  }, [isOpen]);

  const available = options.filter(o => !selected.includes(o));
  const isActive = selected.length > 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
      {/* Selected tags as pills */}
      {selected.map(tag => (
        <span
          key={tag}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 500,
            background: 'rgba(139, 92, 246, 0.1)',
            color: 'var(--accent-violet)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
          }}
        >
          {tag}
          <X
            size={11}
            style={{ cursor: 'pointer', opacity: 0.7 }}
            onClick={() => onChange(selected.filter(s => s !== tag))}
          />
        </span>
      ))}

      {/* Add button */}
      {available.length > 0 && (
        <div style={{ position: 'relative' }}>
          <button
            ref={buttonRef}
            onClick={() => setIsOpen(!isOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 10px',
              borderRadius: '10px',
              border: isActive ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s ease',
            }}
          >
            Tags
            <ChevronDown size={11} style={{ opacity: 0.5 }} />
          </button>

          {isOpen && createPortal(
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                onClick={() => setIsOpen(false)}
              />
              <div style={{
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                minWidth: '160px',
                maxHeight: '200px',
                overflowY: 'auto',
                background: 'var(--dropdown-bg)',
                backdropFilter: 'blur(12px)',
                border: '1px solid var(--border-light)',
                borderRadius: '12px',
                zIndex: 50,
                padding: '4px',
                boxShadow: 'var(--dropdown-shadow)',
              }}>
                {available.map(tag => (
                  <button
                    key={tag}
                    onClick={() => { onChange([...selected, tag]); setIsOpen(false); }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'background 0.1s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </>,
            document.body
          )}
        </div>
      )}
    </div>
  );
}
