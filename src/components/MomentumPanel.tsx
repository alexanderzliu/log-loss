import { useEffect } from 'react';
import { useMetricsStore } from '../store/useMetricsStore';
import { useShallow } from 'zustand/react/shallow';
import { formatCompactNumber, formatCompactCount } from '../utils/format';
import type { TimeframeData, TokenMetrics, DerivativesResult } from '../types';
import PatternFlags from './PatternFlags';
import MetricTrends, { DerivativeArrow } from './MetricTrends';

interface MomentumPanelProps {
  chain: string;
  contractAddress: string;
}

const TIMEFRAME_LABELS = ['5m', '1h', '6h', '24h'] as const;
const TIMEFRAME_KEYS: (keyof TimeframeData)[] = ['m5', 'h1', 'h6', 'h24'];

function formatVolume(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${value.toFixed(0)}`;
}

function formatPct(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function pressureColor(pressure: number): string {
  if (pressure >= 0.6) return 'var(--profit)';
  if (pressure <= 0.4) return 'var(--loss)';
  return 'var(--text-secondary)';
}

function priceChangeColor(change: number): string {
  if (change > 0) return 'var(--profit)';
  if (change < 0) return 'var(--loss)';
  return 'var(--text-secondary)';
}

const LIFECYCLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  launch: { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.25)' },
  discovery: { bg: 'rgba(139, 92, 246, 0.1)', text: '#a78bfa', border: 'rgba(139, 92, 246, 0.25)' },
  momentum: { bg: 'rgba(52, 211, 153, 0.1)', text: '#34d399', border: 'rgba(52, 211, 153, 0.25)' },
  established: { bg: 'rgba(168, 163, 181, 0.08)', text: '#a8a3b5', border: 'rgba(168, 163, 181, 0.2)' },
};

export default function MomentumPanel({ chain, contractAddress }: MomentumPanelProps) {
  const key = `${chain}:${contractAddress}`;
  const derivKey = `${chain}:${contractAddress}:1h`;
  const { metrics, loading, error, fetchMetrics, derivatives, fetchDerivatives } = useMetricsStore(useShallow((s) => ({
    metrics: s.metrics[key],
    loading: s.loading[key] ?? false,
    error: s.errors[key] ?? null,
    fetchMetrics: s.fetchMetrics,
    derivatives: s.derivatives[derivKey]?.data ?? null,
    fetchDerivatives: s.fetchDerivatives,
  })));

  useEffect(() => {
    fetchMetrics(chain, contractAddress);
    fetchDerivatives(chain, contractAddress, '1h');
  }, [chain, contractAddress, fetchMetrics, fetchDerivatives]);

  if (loading) {
    return (
      <div style={panelStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0' }}>
          <div className="spinner" />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading momentum data...</span>
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div style={panelStyle}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {error ? 'Failed to load metrics' : 'No metrics available'}
        </span>
      </div>
    );
  }

  const lifecycle = LIFECYCLE_COLORS[metrics.lifecycleStage] ?? LIFECYCLE_COLORS.established;

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={sectionLabelStyle}>Momentum</span>
          <span style={{
            fontSize: '10px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '9999px',
            background: lifecycle.bg,
            color: lifecycle.text,
            border: `1px solid ${lifecycle.border}`,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {metrics.lifecycleStage}
          </span>
          <VolumeAccelerationBadge value={metrics.computed.volumeAcceleration} />
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>
          Liq {formatCompactNumber(metrics.liquidityUsd)}
          {derivatives && <DerivativeArrow change={derivatives.changes.liquidityUsd} />}
        </span>
      </div>

      {/* Pattern Flags */}
      <PatternFlags metrics={metrics} />

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr>
              <th style={thLeftStyle}></th>
              {TIMEFRAME_LABELS.map((label) => (
                <th key={label} style={thCenterStyle}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <MetricRow label="Buy Vol" metrics={metrics} accessor={(m, tf) => formatVolume(m.raw.volumeBuy[tf])} colorFn={() => 'var(--profit)'} />
            <MetricRow label="Sell Vol" metrics={metrics} accessor={(m, tf) => formatVolume(m.raw.volumeSell[tf])} colorFn={() => 'var(--loss)'} />
            <MetricRow label="Buyers" metrics={metrics} accessor={(m, tf) => formatCompactCount(m.raw.buyers[tf])} colorFn={() => 'var(--profit)'} />
            <MetricRow label="Sellers" metrics={metrics} accessor={(m, tf) => formatCompactCount(m.raw.sellers[tf])} colorFn={() => 'var(--loss)'} />
            <MetricRow
              label="Price"
              metrics={metrics}
              accessor={(m, tf) => formatPct(m.raw.priceChange[tf])}
              colorFn={(m, tf) => priceChangeColor(m.raw.priceChange[tf])}
              derivative={derivatives?.changes.price}
            />
            <MetricRow
              label="Buy %"
              metrics={metrics}
              accessor={(m, tf) => `${(m.computed.buyPressure[tf] * 100).toFixed(0)}%`}
              colorFn={(m, tf) => pressureColor(m.computed.buyPressure[tf])}
              derivative={derivatives?.changes.buyPressure}
            />
          </tbody>
        </table>
      </div>

      {/* Trend Sparklines */}
      <MetricTrends chain={chain} contractAddress={contractAddress} />
    </div>
  );
}

function MetricRow({ label, metrics, accessor, colorFn, derivative }: {
  label: string;
  metrics: TokenMetrics;
  accessor: (m: TokenMetrics, tf: keyof TimeframeData) => string;
  colorFn: (m: TokenMetrics, tf: keyof TimeframeData) => string;
  derivative?: DerivativesResult['changes'][keyof DerivativesResult['changes']];
}) {
  return (
    <tr>
      <td style={tdLabelStyle}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          {label}
          {derivative && <DerivativeArrow change={derivative} />}
        </span>
      </td>
      {TIMEFRAME_KEYS.map((tf) => (
        <td key={tf} style={{ ...tdValueStyle, color: colorFn(metrics, tf) }}>
          {accessor(metrics, tf)}
        </td>
      ))}
    </tr>
  );
}

function VolumeAccelerationBadge({ value }: { value: number }) {
  if (value <= 0) return null;
  const isAccelerating = value > 1.2;
  const isDecelerating = value < 0.8;
  if (!isAccelerating && !isDecelerating) return null;

  return (
    <span style={{
      fontSize: '10px',
      fontWeight: 600,
      padding: '2px 6px',
      borderRadius: '9999px',
      background: isAccelerating ? 'rgba(52, 211, 153, 0.08)' : 'rgba(248, 113, 113, 0.08)',
      color: isAccelerating ? 'var(--profit)' : 'var(--loss)',
      border: `1px solid ${isAccelerating ? 'rgba(52, 211, 153, 0.15)' : 'rgba(248, 113, 113, 0.15)'}`,
    }}>
      {isAccelerating ? 'Accelerating' : 'Decelerating'}
    </span>
  );
}

// Styles
const panelStyle: React.CSSProperties = {
  padding: '12px 0 8px',
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '1px',
};

const thLeftStyle: React.CSSProperties = {
  padding: '4px 8px 4px 0',
  textAlign: 'left',
  fontSize: '10px',
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  borderBottom: '1px solid var(--border)',
};

const thCenterStyle: React.CSSProperties = {
  ...thLeftStyle,
  textAlign: 'center',
  padding: '4px 6px',
};

const tdLabelStyle: React.CSSProperties = {
  padding: '5px 8px 5px 0',
  fontSize: '11px',
  fontWeight: 500,
  color: 'var(--text-muted)',
  whiteSpace: 'nowrap',
};

const tdValueStyle: React.CSSProperties = {
  padding: '5px 6px',
  textAlign: 'center',
  fontFamily: "'DM Mono', monospace",
  fontSize: '11px',
  fontVariantNumeric: 'tabular-nums',
};
