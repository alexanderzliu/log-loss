import { formatCurrency } from '../utils/format';

interface PnlDisplayProps {
  pnl: number | null;
  pnlPercent?: number | null;
  /** 'sm' for expanded/sub-rows (13px/11px, no bold) */
  size?: 'sm' | 'default';
  /** Fallback text when pnl is null. Defaults to '—' */
  fallback?: string;
}

export default function PnlDisplay({ pnl, pnlPercent, size = 'default', fallback = '—' }: PnlDisplayProps) {
  if (pnl === null) {
    return <span style={{ color: 'var(--text-muted)' }}>{fallback}</span>;
  }

  const color = pnl >= 0 ? 'var(--profit)' : 'var(--loss)';
  const isSm = size === 'sm';

  const glowShadow = pnl >= 0
    ? '0 0 20px rgba(52, 211, 153, 0.25)'
    : '0 0 20px rgba(248, 113, 113, 0.25)';

  return (
    <div>
      <div style={{
        fontFamily: "'DM Mono', monospace",
        fontWeight: isSm ? undefined : 600,
        fontSize: isSm ? '13px' : undefined,
        color,
        textShadow: isSm ? 'none' : glowShadow,
      }}>
        {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
      </div>
      {pnlPercent != null && (
        <div style={{
          fontSize: isSm ? '11px' : '12px',
          color: pnlPercent >= 0 ? 'var(--profit)' : 'var(--loss)',
        }}>
          {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
        </div>
      )}
    </div>
  );
}
