import type React from 'react';

export function FieldGroup({ label, optional, children }: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="block mb-1.5"
        style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}
      >
        {label}
        {optional && (
          <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '4px' }}>
            (opt)
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
