import type { TokenMetrics } from '../types';

interface PatternFlagsProps {
  metrics: TokenMetrics;
}

interface PatternFlag {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

function detectPatterns(m: TokenMetrics): PatternFlag[] {
  const flags: PatternFlag[] = [];
  const { raw, computed } = m;

  // "Fresh Launch" - pairCreatedAt < 24h, high volume/mcap ratio, buy pressure > 60%
  if (m.pairCreatedAt) {
    const ageHours = (Date.now() - m.pairCreatedAt) / (1000 * 60 * 60);
    if (ageHours < 24 && computed.buyPressure.h1 > 0.6) {
      const volumeMcapRatio = m.marketCap && m.marketCap > 0 ? raw.volume.h24 / m.marketCap : 0;
      if (volumeMcapRatio > 0.5 || ageHours < 6) {
        flags.push({
          label: 'Fresh Launch',
          color: '#f59e0b',
          bgColor: 'rgba(245, 158, 11, 0.1)',
          borderColor: 'rgba(245, 158, 11, 0.25)',
        });
      }
    }
  }

  // "Whale Accumulation" - volumeBuy >> volumeSell AND buyers < sellers
  // Big buys by few wallets while many small sellers
  if (raw.volumeBuy.h1 > raw.volumeSell.h1 * 1.5 && raw.buyers.h1 < raw.sellers.h1) {
    flags.push({
      label: 'Whale Accumulation',
      color: '#818cf8',
      bgColor: 'rgba(129, 140, 248, 0.1)',
      borderColor: 'rgba(129, 140, 248, 0.25)',
    });
  }

  // "Retail FOMO" - buyers >> sellers AND avg buy size decreasing AND volume accelerating
  if (
    raw.buyers.h1 > raw.sellers.h1 * 1.5 &&
    computed.avgBuySize.m5 < computed.avgBuySize.h1 * 0.8 &&
    computed.volumeAcceleration > 1.2
  ) {
    flags.push({
      label: 'Retail FOMO',
      color: '#fb923c',
      bgColor: 'rgba(251, 146, 60, 0.1)',
      borderColor: 'rgba(251, 146, 60, 0.25)',
    });
  }

  // "Distribution" - volumeSell increasing while price stable/rising
  // Sell volume in 1h outpaces 6h proportionally, yet price is flat or up
  if (
    raw.volumeSell.h1 > 0 &&
    raw.volumeSell.h6 > 0 &&
    (raw.volumeSell.h1 * 6) > raw.volumeSell.h6 * 1.3 &&
    raw.priceChange.h1 >= -2
  ) {
    flags.push({
      label: 'Distribution',
      color: '#f87171',
      bgColor: 'rgba(248, 113, 113, 0.1)',
      borderColor: 'rgba(248, 113, 113, 0.25)',
    });
  }

  // "Exhaustion" - volume decelerating across all timeframes
  if (
    computed.volumeAcceleration < 0.6 &&
    raw.volume.m5 * 12 < raw.volume.h1 * 0.7 &&
    raw.volume.h1 * 6 < raw.volume.h6 * 0.7
  ) {
    flags.push({
      label: 'Exhaustion',
      color: '#94a3b8',
      bgColor: 'rgba(148, 163, 184, 0.08)',
      borderColor: 'rgba(148, 163, 184, 0.2)',
    });
  }

  return flags;
}

export default function PatternFlags({ metrics }: PatternFlagsProps) {
  const flags = detectPatterns(metrics);

  if (flags.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
      {flags.map((flag) => (
        <span
          key={flag.label}
          style={{
            fontSize: '10px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '9999px',
            background: flag.bgColor,
            color: flag.color,
            border: `1px solid ${flag.borderColor}`,
            letterSpacing: '0.3px',
            whiteSpace: 'nowrap',
          }}
        >
          {flag.label}
        </span>
      ))}
    </div>
  );
}
