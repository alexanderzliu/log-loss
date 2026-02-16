import { useEffect, useState, useMemo } from 'react';
import { useMetricsStore } from '../store/useMetricsStore';
import { useShallow } from 'zustand/react/shallow';
import Sparkline from './Sparkline';
import type { SparklinePoint } from './Sparkline';
import type { SnapshotHistoryPoint, DerivativeChange, DerivativeWindow } from '../types';
import { formatCompactNumber, formatCompactCount } from '../utils/format';

interface MetricTrendsProps {
  chain: string;
  contractAddress: string;
}

const TIME_RANGES = [
  { label: '6h', hours: 6, derivativeWindow: '6h' as DerivativeWindow },
  { label: '24h', hours: 24, derivativeWindow: '24h' as DerivativeWindow },
  { label: '7d', hours: 168, derivativeWindow: '24h' as DerivativeWindow },
] as const;

interface MetricConfig {
  key: keyof SnapshotHistoryPoint;
  label: string;
  derivativeKey: 'price' | 'volume24h' | 'liquidityUsd' | 'buyPressure' | 'holderCount';
  format: (v: number) => string;
  colorPositive?: boolean; // default true
}

const METRICS: MetricConfig[] = [
  { key: 'price', label: 'Price', derivativeKey: 'price', format: formatSmartPrice },
  { key: 'volume24h', label: 'Volume', derivativeKey: 'volume24h', format: (v) => formatCompactNumber(v) },
  { key: 'liquidityUsd', label: 'Liquidity', derivativeKey: 'liquidityUsd', format: (v) => formatCompactNumber(v) },
  { key: 'buyPressure', label: 'Buy Pressure', derivativeKey: 'buyPressure', format: (v) => `${(v * 100).toFixed(0)}%` },
  { key: 'holderCount', label: 'Holders', derivativeKey: 'holderCount', format: (v) => formatCompactCount(v) },
];

function formatSmartPrice(v: number): string {
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v >= 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toPrecision(3)}`;
}

export default function MetricTrends({ chain, contractAddress }: MetricTrendsProps) {
  const [rangeIndex, setRangeIndex] = useState(1); // default 24h
  const range = TIME_RANGES[rangeIndex];

  const historyKey = `${chain}:${contractAddress}:${range.hours}`;
  const derivKey = `${chain}:${contractAddress}:${range.derivativeWindow}`;

  const { history, historyLoading, derivatives, derivativesLoading, fetchHistory, fetchDerivatives } = useMetricsStore(
    useShallow((s) => ({
      history: s.history[historyKey]?.data,
      historyLoading: s.historyLoading[historyKey] ?? false,
      derivatives: s.derivatives[derivKey]?.data,
      derivativesLoading: s.derivativesLoading[derivKey] ?? false,
      fetchHistory: s.fetchHistory,
      fetchDerivatives: s.fetchDerivatives,
    }))
  );

  useEffect(() => {
    fetchHistory(chain, contractAddress, range.hours);
    fetchDerivatives(chain, contractAddress, range.derivativeWindow);
  }, [chain, contractAddress, range.hours, range.derivativeWindow, fetchHistory, fetchDerivatives]);

  const isLoading = historyLoading || derivativesLoading;
  const hasData = history && history.length >= 2;

  return (
    <div style={{ marginTop: '12px' }}>
      {/* Section header with range selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={sectionLabelStyle}>Trends</span>
        <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-elevated)', borderRadius: '6px', padding: '2px' }}>
          {TIME_RANGES.map((r, i) => (
            <button
              key={r.label}
              onClick={() => setRangeIndex(i)}
              style={{
                fontSize: '10px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                background: i === rangeIndex ? 'var(--bg-hover)' : 'transparent',
                color: i === rangeIndex ? 'var(--text-primary)' : 'var(--text-muted)',
                transition: 'all 0.15s ease',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && !hasData && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' }}>
          <div className="spinner" />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Loading trends...</span>
        </div>
      )}

      {!isLoading && !hasData && (
        <div style={{ padding: '8px 0', fontSize: '11px', color: 'var(--text-muted)' }}>
          No snapshot history yet. Trends will appear as data accumulates.
        </div>
      )}

      {hasData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {METRICS.map((metric) => (
            <MetricTrendRow
              key={metric.key}
              config={metric}
              history={history}
              derivativeChange={derivatives?.changes[metric.derivativeKey] ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MetricTrendRow({
  config,
  history,
  derivativeChange,
}: {
  config: MetricConfig;
  history: SnapshotHistoryPoint[];
  derivativeChange: DerivativeChange | null;
}) {
  const sparklineData = useMemo<SparklinePoint[]>(() => {
    return history
      .map((p) => {
        const val = p[config.key] as number | null;
        if (val === null) return null;
        return { time: new Date(p.capturedAt).getTime(), value: val };
      })
      .filter((p): p is SparklinePoint => p !== null);
  }, [history, config.key]);

  const currentValue = sparklineData.length > 0 ? sparklineData[sparklineData.length - 1].value : null;
  const trend = derivativeChange?.percent ?? null;
  const sparklineColor = trend !== null && trend !== 0 ? (trend > 0 ? 'var(--profit)' : 'var(--loss)') : 'var(--text-muted)';

  return (
    <div style={rowStyle}>
      <div style={{ width: '72px', flexShrink: 0 }}>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>{config.label}</span>
      </div>
      <div style={{ width: '64px', flexShrink: 0, textAlign: 'right' }}>
        <span style={{ fontSize: '11px', fontFamily: "'DM Mono', monospace", color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
          {currentValue !== null ? config.format(currentValue) : '--'}
        </span>
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}>
        {sparklineData.length >= 2 ? (
          <Sparkline data={sparklineData} width={90} height={24} color={sparklineColor} strokeWidth={1.2} showEndDot showArea />
        ) : (
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>--</span>
        )}
      </div>
      <div style={{ width: '56px', flexShrink: 0, textAlign: 'right' }}>
        <DerivativeArrow change={derivativeChange} />
      </div>
    </div>
  );
}

function DerivativeArrow({ change }: { change: DerivativeChange | null }) {
  if (!change || change.percent === null) {
    return <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>--</span>;
  }

  const pct = change.percent;
  const absPct = Math.abs(pct);

  // Flat if under 0.5%
  if (absPct < 0.5) {
    return (
      <span
        style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'var(--text-muted)' }}
        title={`${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`}
      >
        <svg width={10} height={10} viewBox="0 0 10 10">
          <line x1={2} y1={5} x2={8} y2={5} stroke="var(--text-muted)" strokeWidth={1.5} strokeLinecap="round" />
        </svg>
        <span style={{ fontFamily: "'DM Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>
          {formatPctShort(pct)}
        </span>
      </span>
    );
  }

  const isUp = pct > 0;
  const color = isUp ? 'var(--profit)' : 'var(--loss)';
  // Intensity: stronger color for bigger changes
  const opacity = Math.min(1, 0.6 + absPct / 50);

  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color, opacity }}
      title={`${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`}
    >
      <svg width={10} height={10} viewBox="0 0 10 10">
        {isUp ? (
          <path d="M5 2 L8 6 L2 6 Z" fill={color} />
        ) : (
          <path d="M5 8 L8 4 L2 4 Z" fill={color} />
        )}
      </svg>
      <span style={{ fontFamily: "'DM Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>
        {formatPctShort(pct)}
      </span>
    </span>
  );
}

function formatPctShort(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  const abs = Math.abs(pct);
  if (abs >= 100) return `${sign}${pct.toFixed(0)}%`;
  if (abs >= 10) return `${sign}${pct.toFixed(1)}%`;
  return `${sign}${pct.toFixed(1)}%`;
}

// Also export DerivativeArrow for use in MomentumPanel table rows
export { DerivativeArrow };

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '1px',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '3px 0',
  borderBottom: '1px solid var(--border)',
};
