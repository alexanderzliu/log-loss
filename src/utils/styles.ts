import type { CSSProperties } from 'react';

// Shared table header style used in Dashboard and TradeList
export const tableHeaderStyle: CSSProperties = {
  padding: '18px 20px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
};

// Shared table cell style used in Dashboard and TradeList
export const tableCellStyle: CSSProperties = {
  padding: '18px 20px',
  color: 'var(--text-secondary)',
  fontSize: '14px',
};
