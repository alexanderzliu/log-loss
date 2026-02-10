import type { CSSProperties } from 'react';

// Shared table header style used in Dashboard and TradeList
export const tableHeaderStyle: CSSProperties = {
  padding: '18px 20px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
};

// Shared table cell style used in Dashboard and TradeList
export const tableCellStyle: CSSProperties = {
  padding: '20px 24px',
  color: 'var(--text-secondary)',
  fontSize: '14px',
};
