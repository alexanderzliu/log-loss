import type React from 'react';

export function FieldSection({ label, icon, children }: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      padding: '14px',
      borderRadius: '16px',
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        color: 'var(--text-muted)',
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
      }}>
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}
