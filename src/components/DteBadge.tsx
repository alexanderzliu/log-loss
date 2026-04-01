interface DteBadgeProps {
  dte: number;
  size?: 'sm' | 'md';
}

function getDTEColor(dte: number): string {
  if (dte <= 1) return 'var(--loss)';
  if (dte <= 3) return '#f59e0b';
  return 'var(--profit)';
}

function getDTEBgColor(dte: number): string {
  if (dte <= 1) return 'rgba(248, 113, 113, 0.12)';
  if (dte <= 3) return 'rgba(245, 158, 11, 0.12)';
  return 'rgba(52, 211, 153, 0.08)';
}

export default function DteBadge({ dte, size = 'sm' }: DteBadgeProps) {
  const isMd = size === 'md';
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: isMd ? '12px' : '10px',
      fontWeight: 600,
      fontFamily: "'DM Mono', monospace",
      padding: isMd ? '2px 8px' : '1px 6px',
      borderRadius: '9999px',
      background: getDTEBgColor(dte),
      color: getDTEColor(dte),
      whiteSpace: 'nowrap',
    }}>
      {dte <= 0 ? 'EXP' : `${dte}d`}
    </span>
  );
}
