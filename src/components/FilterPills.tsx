interface FilterOption {
  key: string;
  label: string;
  count: number;
}

interface FilterPillsProps {
  options: FilterOption[];
  active: string;
  onChange: (key: string) => void;
}

export default function FilterPills({ options, active, onChange }: FilterPillsProps) {
  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      {options.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          style={{
            padding: '10px 18px',
            borderRadius: '9999px',
            border: active === f.key ? '1px solid var(--border-accent)' : '1px solid transparent',
            background: active === f.key ? 'var(--accent-soft)' : 'transparent',
            color: active === f.key ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {f.label} <span style={{ opacity: 0.6, marginLeft: '4px' }}>{f.count}</span>
        </button>
      ))}
    </div>
  );
}
