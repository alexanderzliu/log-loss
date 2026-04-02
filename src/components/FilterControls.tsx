import { useState, useRef, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, SlidersHorizontal, Calendar } from 'lucide-react';

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

// --- DateRangeFilter: date range with preset buttons ---

interface DateRangeFilterProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function startOfWeekStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay()); // Sunday
  return d.toISOString().slice(0, 10);
}

function startOfMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

const PRESETS = [
  { label: 'Today', getRange: () => ({ from: todayStr(), to: todayStr() }) },
  { label: 'Yesterday', getRange: () => ({ from: yesterdayStr(), to: yesterdayStr() }) },
  { label: 'This Week', getRange: () => ({ from: startOfWeekStr(), to: todayStr() }) },
  { label: 'This Month', getRange: () => ({ from: startOfMonthStr(), to: todayStr() }) },
] as const;

export function DateRangeFilter({ from, to, onChange }: DateRangeFilterProps) {
  const isActive = !!from || !!to;

  const activePreset = PRESETS.findIndex((p) => {
    const r = p.getRange();
    return r.from === from && r.to === to;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Preset pills */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {PRESETS.map((preset, i) => {
          const isPresetActive = activePreset === i;
          return (
            <button
              key={preset.label}
              onClick={() => {
                const range = preset.getRange();
                onChange(range.from, range.to);
              }}
              style={{
                padding: '4px 10px',
                borderRadius: '8px',
                border: isPresetActive ? '1px solid var(--border-accent)' : '1px solid var(--border)',
                background: isPresetActive ? 'var(--accent-soft)' : 'transparent',
                color: isPresetActive ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Custom date inputs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 10px',
        borderRadius: '10px',
        border: isActive ? '1px solid var(--border-accent)' : '1px solid var(--border)',
        background: isActive ? 'var(--accent-soft)' : 'var(--bg-elevated)',
        transition: 'all 0.15s ease',
      }}>
        <Calendar size={13} style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }} />
        <input
          type="date"
          value={from}
          onChange={(e) => onChange(e.target.value, to)}
          style={{
            background: 'transparent',
            border: 'none',
            color: from ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: '12px',
            fontFamily: 'inherit',
            outline: 'none',
            width: '120px',
            colorScheme: 'dark',
          }}
        />
        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>–</span>
        <input
          type="date"
          value={to}
          onChange={(e) => onChange(from, e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            color: to ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: '12px',
            fontFamily: 'inherit',
            outline: 'none',
            width: '120px',
            colorScheme: 'dark',
          }}
        />
        {isActive && (
          <X
            size={12}
            onClick={() => onChange('', '')}
            style={{ cursor: 'pointer', color: 'var(--text-muted)', opacity: 0.7, flexShrink: 0 }}
          />
        )}
      </div>
    </div>
  );
}

// --- CollapsibleFilterBar: shared filter toggle + collapsible row ---

interface CollapsibleFilterBarProps {
  activeCount: number;
  children: ReactNode;
  trailing?: ReactNode;
  defaultOpen?: boolean;
}

export function CollapsibleFilterBar({ activeCount, children, trailing, defaultOpen }: CollapsibleFilterBarProps) {
  const [showFilters, setShowFilters] = useState(defaultOpen ?? false);

  // Auto-expand when filters become active
  useEffect(() => {
    if (activeCount > 0) setShowFilters(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={() => setShowFilters((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: showFilters ? 'var(--accent-soft)' : 'transparent',
            border: showFilters ? '1px solid var(--border-accent)' : '1px solid var(--border)',
            borderRadius: '10px',
            padding: '7px 12px',
            color: showFilters ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.2s ease',
          }}
        >
          <SlidersHorizontal size={14} />
          Filters
          {activeCount > 0 && (
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '0 5px',
              borderRadius: '9999px',
              background: 'var(--accent)',
              color: '#000',
              lineHeight: '16px',
            }}>
              {activeCount}
            </span>
          )}
        </button>
        {trailing}
      </div>

      {showFilters && (
        <div style={{
          background: 'var(--gradient-card)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-card)',
          padding: '14px 20px',
          marginTop: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          position: 'relative',
          zIndex: 1,
          animation: 'slideUp 0.2s ease-out both',
        }}>
          {children}
        </div>
      )}
    </>
  );
}
