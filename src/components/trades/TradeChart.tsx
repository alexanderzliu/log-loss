import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../../store/useStore';
import CandlestickChart from '../charts/CandlestickChart';
import type { Trade, ChartSnapshot } from '../../types';
import { BarChart3, RefreshCw, Loader2, Maximize2, X } from 'lucide-react';

interface TradeChartProps {
  trade: Trade;
}

const EMPTY_SNAPSHOTS: ChartSnapshot[] = [];

export default function TradeChart({ trade }: TradeChartProps) {
  const snapshots = useStore((s) => s.chartSnapshots[trade.id]) ?? EMPTY_SNAPSHOTS;
  const loading = useStore((s) => s.chartSnapshotsLoading[trade.id]) ?? false;
  const fetchChartSnapshots = useStore((s) => s.fetchChartSnapshots);
  const captureChartSnapshots = useStore((s) => s.captureChartSnapshots);

  const [activeTab, setActiveTab] = useState<string>('underlying');
  const [fullscreen, setFullscreen] = useState(false);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setFullscreen(false);
  }, []);

  useEffect(() => {
    if (fullscreen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = '';
      };
    }
  }, [fullscreen, handleEscape]);

  useEffect(() => {
    fetchChartSnapshots(trade.id);
  }, [trade.id, fetchChartSnapshots]);

  const underlyingSnapshot = snapshots.find((s) => s.symbolType === 'underlying');
  const optionSnapshots = snapshots.filter((s) => s.symbolType === 'option');

  const tabs: { key: string; label: string; snapshot?: ChartSnapshot }[] = [];
  if (underlyingSnapshot) {
    tabs.push({ key: 'underlying', label: trade.underlying, snapshot: underlyingSnapshot });
  }
  for (const snap of optionSnapshots) {
    // Show abbreviated ticker: last part of OCC code
    const label = abbreviateOcc(snap.symbol, trade.underlying);
    tabs.push({ key: snap.id, label, snapshot: snap });
  }

  const activeSnapshot = tabs.find((t) => t.key === activeTab)?.snapshot || tabs[0]?.snapshot;

  // Parse entry/exit timestamps for markers — only if time precision exists (not just a date)
  const entryTime = trade.openDate && trade.openDate.includes('T')
    ? new Date(trade.openDate).getTime() / 1000
    : undefined;
  const exitTime = trade.closeDate && trade.closeDate.includes('T')
    ? new Date(trade.closeDate).getTime() / 1000
    : undefined;

  // Resolve entry/exit prices for price-line markers based on active tab
  let entryPrice: number | undefined;
  let exitPrice: number | undefined;
  if (activeSnapshot) {
    if (activeSnapshot.symbolType === 'underlying') {
      // For the underlying chart, use the underlying price at time of fill
      const leg = trade.legs[0];
      if (leg?.entryUnderlyingPrice) {
        entryPrice = leg.entryUnderlyingPrice;
      } else if (trade.assetType === 'stock' && trade.entryPrice) {
        entryPrice = trade.entryPrice;
      }
      if (leg?.exitUnderlyingPrice) {
        exitPrice = leg.exitUnderlyingPrice;
      } else if (trade.assetType === 'stock' && trade.exitPrice) {
        exitPrice = trade.exitPrice;
      }
    } else {
      // For option chart tabs, match the leg — prefer direct legId FK,
      // fall back to ticker normalization for older snapshots
      const leg = trade.legs.find((l) => l.id === activeSnapshot.legId)
        || trade.legs.find((l) => normalizeOcc(l.ticker) === normalizeOcc(activeSnapshot.symbol));
      if (leg?.entryPrice) entryPrice = leg.entryPrice;
      if (leg?.exitPrice) exitPrice = leg.exitPrice;
    }
  }

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={emptyStyle}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Loading chart data...</span>
        </div>
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={emptyStyle}>
          <BarChart3 size={16} style={{ color: 'var(--text-muted)' }} />
          <span style={{ color: 'var(--text-muted)' }}>No chart data captured yet</span>
          <button
            onClick={() => captureChartSnapshots(trade.id)}
            style={captureButtonStyle}
          >
            <BarChart3 size={13} />
            Capture Chart Data
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Tab bar + capture button */}
      <div style={headerStyle}>
        <div style={tabBarStyle}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                ...tabStyle,
                color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              {tab.label}
              {tab.snapshot?.source === 'theoretical' && (
                <span style={theoreticalBadgeStyle}>Est.</span>
              )}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setFullscreen(true)}
            style={refreshButtonStyle}
            title="Expand chart"
          >
            <Maximize2 size={13} />
          </button>
          <button
            onClick={() => captureChartSnapshots(trade.id)}
            style={refreshButtonStyle}
            title="Recapture chart data"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Chart */}
      {activeSnapshot && (
        <CandlestickChart
          bars={activeSnapshot.bars}
          vwap={activeSnapshot.indicators?.vwap}
          entryTime={entryTime}
          exitTime={exitTime}
          entryPrice={entryPrice}
          exitPrice={exitPrice}
        />
      )}

      {/* Info bar */}
      {activeSnapshot && (
        <div style={infoBarStyle}>
          <span>{activeSnapshot.barCount} bars</span>
          <span>{activeSnapshot.tradeDate}</span>
          <span style={{ textTransform: 'capitalize' }}>
            {activeSnapshot.source === 'theoretical' ? 'Theoretical (Black-Scholes)' : 'Yahoo Finance'}
          </span>
          {activeSnapshot.indicators && (
            <span>POC: ${activeSnapshot.indicators.poc.toFixed(2)}</span>
          )}
        </div>
      )}

      {/* Fullscreen modal — portaled to body to escape backdrop-filter containing block */}
      {fullscreen && activeSnapshot && createPortal(
        <div style={overlayStyle} onClick={() => setFullscreen(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div style={tabBarStyle}>
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      ...tabStyle,
                      color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                      borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setFullscreen(false)}
                style={refreshButtonStyle}
                title="Close (Esc)"
              >
                <X size={15} />
              </button>
            </div>
            <CandlestickChart
              bars={activeSnapshot.bars}
              vwap={activeSnapshot.indicators?.vwap}
              entryTime={entryTime}
              exitTime={exitTime}
              entryPrice={entryPrice}
              exitPrice={exitPrice}
              height={window.innerHeight - 120}
            />
            <div style={infoBarStyle}>
              <span>{activeSnapshot.barCount} bars</span>
              <span>{activeSnapshot.tradeDate}</span>
              <span style={{ textTransform: 'capitalize' }}>
                {activeSnapshot.source === 'theoretical' ? 'Theoretical (Black-Scholes)' : 'Yahoo Finance'}
              </span>
              {activeSnapshot.indicators && (
                <span>POC: ${activeSnapshot.indicators.poc.toFixed(2)}</span>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/** Normalize OCC ticker to short form: SPY260331P00636000 -> SPY260331P636 */
function normalizeOcc(ticker: string): string {
  // Match: underlying letters, 6-digit date, C/P, then strike digits
  const m = ticker.match(/^([A-Z]+\d{6}[CP])0*(\d+?)0*$/);
  if (!m) return ticker;
  return m[1] + m[2];
}

/** Abbreviate OCC ticker for tab label: SPY260331P00650000 -> P 650 3/31 */
function abbreviateOcc(occ: string, underlying: string): string {
  const suffix = occ.slice(underlying.length);
  if (suffix.length < 15) return occ;

  const dateStr = suffix.slice(0, 6); // YYMMDD
  const type = suffix[6]; // C or P
  const strikeStr = suffix.slice(7);
  const strike = parseInt(strikeStr, 10) / 1000;

  const month = parseInt(dateStr.slice(2, 4), 10);
  const day = parseInt(dateStr.slice(4, 6), 10);

  return `${type === 'P' ? 'Put' : 'Call'} $${strike} ${month}/${day}`;
}

const containerStyle: React.CSSProperties = {
  borderRadius: '10px',
  background: 'rgba(255, 255, 255, 0.02)',
  border: '1px solid var(--border)',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 12px',
  borderBottom: '1px solid var(--border)',
};

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: '4px',
  overflow: 'auto',
};

const tabStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: '12px',
  fontWeight: 500,
  fontFamily: 'inherit',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  whiteSpace: 'nowrap',
  transition: 'color 0.15s',
};

const theoreticalBadgeStyle: React.CSSProperties = {
  fontSize: '9px',
  fontWeight: 600,
  padding: '1px 4px',
  borderRadius: '4px',
  background: 'rgba(245, 158, 11, 0.15)',
  color: '#f59e0b',
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
};

const refreshButtonStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  padding: '6px',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  display: 'flex',
  alignItems: 'center',
  transition: 'color 0.15s',
};

const captureButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 16px',
  borderRadius: '8px',
  border: '1px solid var(--accent)',
  background: 'rgba(16, 185, 129, 0.08)',
  color: 'var(--accent)',
  fontSize: '12px',
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
  marginTop: '4px',
};

const emptyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '24px',
  fontSize: '13px',
};

const infoBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: '16px',
  padding: '8px 12px',
  fontSize: '11px',
  color: 'var(--text-muted)',
  borderTop: '1px solid var(--border)',
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.8)',
  backdropFilter: 'blur(4px)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const modalStyle: React.CSSProperties = {
  width: 'calc(100vw - 48px)',
  maxHeight: 'calc(100vh - 48px)',
  background: 'var(--bg-base)',
  borderRadius: '12px',
  border: '1px solid var(--border)',
  overflow: 'hidden',
};

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 12px',
  borderBottom: '1px solid var(--border)',
};
