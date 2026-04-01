import { useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { ArrowUpRight, ArrowDownRight, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatQuantity, formatPrice, formatDate } from '../utils/format';
import { tableHeaderStyle, tableCellStyle } from '../utils/styles';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import PageTransition from '../components/PageTransition';
import PnlDisplay from '../components/PnlDisplay';
import DteBadge from '../components/DteBadge';
import { getDTE, getEarliestExpiration } from '../utils/dte';

export default function Dashboard() {
  const {
    trades,
    tradesLoading,
    tradesError,
    portfolioSummary,
    portfolioError,
    predictionsSummary,
    predictionsSummaryError,
    fetchTrades,
    fetchPortfolioSummary,
    fetchPredictionsSummary,
  } = useStore(useShallow((s) => ({
    trades: s.trades,
    tradesLoading: s.tradesLoading,
    tradesError: s.tradesError,
    portfolioSummary: s.portfolioSummary,
    portfolioError: s.portfolioError,
    predictionsSummary: s.predictionsSummary,
    predictionsSummaryError: s.predictionsSummaryError,
    fetchTrades: s.fetchTrades,
    fetchPortfolioSummary: s.fetchPortfolioSummary,
    fetchPredictionsSummary: s.fetchPredictionsSummary,
  })));

  useEffect(() => {
    fetchTrades();
    fetchPortfolioSummary();
    fetchPredictionsSummary();
  }, [fetchTrades, fetchPortfolioSummary, fetchPredictionsSummary]);

  const openTrades = useMemo(() => {
    return trades
      .filter((t) => t.status === 'open')
      .sort((a, b) => {
        const aDte = getDTE(getEarliestExpiration(a.legs));
        const bDte = getDTE(getEarliestExpiration(b.legs));
        // Trades with DTE come first, sorted ascending; no-DTE trades go to end
        if (aDte === null && bDte === null) return 0;
        if (aDte === null) return 1;
        if (bDte === null) return -1;
        return aDte - bDte;
      });
  }, [trades]);

  const expiringTrades = useMemo(() => {
    return openTrades
      .map(t => {
        const earliest = getEarliestExpiration(t.legs);
        const dte = getDTE(earliest);
        return { trade: t, dte };
      })
      .filter(({ dte }) => dte !== null && dte >= 0 && dte <= 3);
  }, [openTrades]);

  const recentClosedTrades = useMemo(() => {
    return trades
      .filter((t) => t.status === 'closed')
      .sort((a, b) => {
        const aDate = a.closeDate ? new Date(a.closeDate).getTime() : 0;
        const bDate = b.closeDate ? new Date(b.closeDate).getTime() : 0;
        return bDate - aDate;
      })
      .slice(0, 10);
  }, [trades]);

  const predictionsPnl = predictionsSummary?.predictionsPnl ?? 0;
  const realizedPnl = (portfolioSummary?.realizedPnl ?? 0) + predictionsPnl;
  const totalPnl = realizedPnl;

  const animatedTotalPnl = useAnimatedNumber(totalPnl);

  const isUp = totalPnl >= 0;

  // Glow intensity scales with P&L magnitude
  const intensity = Math.min(1, Math.sqrt(Math.abs(totalPnl) / 5000));
  const ga = (base: number) => +(base * (0.2 + 0.8 * intensity)).toFixed(3);
  const gc = isUp ? '52, 211, 153' : '248, 113, 113';

  const stagger = (index: number) => ({
    animation: `slideUp 0.4s ease-out ${index * 0.06}s both`,
  });

  return (
    <PageTransition>
      <div className="page-container">
        {/* Portfolio Value Header with Ambient Glow */}
        <div style={{ position: 'relative', marginBottom: '56px' }}>
          {/* Ambient glow halo behind the card */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '110%',
            height: '200%',
            borderRadius: '50%',
            background: `radial-gradient(ellipse, rgba(${gc}, ${ga(0.12)}) 0%, rgba(${gc}, ${ga(0.04)}) 40%, transparent 70%)`,
            pointerEvents: 'none',
            transition: 'background 0.8s ease',
          }} />

          {/* Hero Card */}
          <div style={{
            padding: '36px 40px',
            borderRadius: '24px',
            background: 'var(--gradient-card)',
            border: `1px solid rgba(${gc}, ${ga(0.15)})`,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: `var(--shadow-card), 0 0 60px rgba(${gc}, ${ga(0.08)}), 0 0 0 1px rgba(${gc}, ${ga(0.06)})`,
            transition: 'border-color 0.5s ease, box-shadow 0.5s ease',
          }}>
            {/* Inner atmospheric glow */}
            <div style={{
              position: 'absolute',
              top: '-80px',
              right: '-80px',
              width: '300px',
              height: '300px',
              borderRadius: '50%',
              background: `radial-gradient(circle, rgba(${gc}, ${ga(0.12)}) 0%, transparent 70%)`,
              pointerEvents: 'none',
              transition: 'background 0.8s ease',
            }} />
            <p style={{
              color: 'var(--text-muted)',
              fontSize: '13px',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
              fontWeight: 600,
            }}>
              Realized P&L
            </p>
            <h1 style={{
              fontSize: '72px',
              fontWeight: 700,
              color: isUp ? 'var(--profit)' : 'var(--loss)',
              fontFamily: "'DM Mono', monospace",
              letterSpacing: '-4px',
              marginBottom: '16px',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
              textShadow: `0 0 40px rgba(${gc}, ${ga(0.3)})`,
            }}>
              {animatedTotalPnl >= 0 ? '+' : ''}{formatCurrency(animatedTotalPnl)}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '9999px',
                background: `rgba(${gc}, ${ga(0.12)})`,
                border: `1px solid rgba(${gc}, ${ga(0.25)})`,
              }}>
                {isUp ? (
                  <ArrowUpRight size={18} style={{ color: 'var(--profit)' }} />
                ) : (
                  <ArrowDownRight size={18} style={{ color: 'var(--loss)' }} />
                )}
                <span style={{
                  color: isUp ? 'var(--profit)' : 'var(--loss)',
                  fontSize: '15px',
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  textShadow: `0 0 20px rgba(${gc}, ${ga(0.5)})`,
                }}>
                  {portfolioSummary?.openTrades ?? 0} open &middot; {portfolioSummary?.closedTrades ?? 0} closed
                </span>
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>All time</span>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        {(portfolioError || predictionsSummaryError) && (
          <div className="card" style={{
            padding: '16px 24px',
            marginBottom: '20px',
            background: 'rgba(248, 113, 113, 0.06)',
            border: '1px solid rgba(248, 113, 113, 0.15)',
            color: 'var(--loss)',
            fontSize: '14px',
          }}>
            {portfolioError && <>Failed to load portfolio summary. <button onClick={fetchPortfolioSummary} className="btn-ghost" style={{ color: 'var(--loss)', textDecoration: 'underline', padding: '0 4px' }}>Retry</button></>}
            {portfolioError && predictionsSummaryError && <br />}
            {predictionsSummaryError && <>Failed to load predictions summary. <button onClick={fetchPredictionsSummary} className="btn-ghost" style={{ color: 'var(--loss)', textDecoration: 'underline', padding: '0 4px' }}>Retry</button></>}
          </div>
        )}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '20px',
          marginBottom: '56px'
        }}>
          {(() => {
            const rPnl = (portfolioSummary?.realizedPnl ?? 0) + predictionsPnl;
            return (
              <StatCard
                label="Realized P&L"
                numericValue={rPnl}
                positive={rPnl >= 0}
                glowIntensity={intensity}
                style={stagger(0)}
              />
            );
          })()}
          {(() => {
            const tradesWins = portfolioSummary ? (portfolioSummary.winRate / 100) * portfolioSummary.closedTrades : 0;
            const tradesTotal = portfolioSummary?.closedTrades || 0;
            const predictionsWins = predictionsSummary ? (predictionsSummary.predictionsWinRate / 100) * predictionsSummary.closedPredictions : 0;
            const predictionsTotal = predictionsSummary?.closedPredictions || 0;
            const combinedTotal = tradesTotal + predictionsTotal;
            const combinedWinRate = combinedTotal > 0 ? ((tradesWins + predictionsWins) / combinedTotal) * 100 : 0;
            return (
              <StatCard
                label="Win Rate"
                numericValue={combinedWinRate}
                formatter={(v) => `${v.toFixed(0)}%`}
                subtext={`${combinedTotal} closed`}
                style={stagger(1)}
              />
            );
          })()}
          <StatCard
            label="Discipline Rate"
            numericValue={portfolioSummary?.followedPlanRate ?? 0}
            formatter={(v) => `${v.toFixed(0)}%`}
            subtext="followed plan"
            style={stagger(2)}
          />
          <StatCard
            label="Total Fees"
            numericValue={portfolioSummary?.totalFees ?? 0}
            style={stagger(3)}
          />
        </div>

        {/* Expiring Soon Banner */}
        {expiringTrades.length > 0 && (
          <div className="card" style={{
            padding: '16px 20px',
            marginBottom: '28px',
            position: 'relative',
            overflow: 'hidden',
            borderLeft: `3px solid ${expiringTrades.some(t => t.dte !== null && t.dte <= 1) ? 'var(--loss)' : '#f59e0b'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <AlertTriangle size={16} style={{ color: expiringTrades.some(t => t.dte !== null && t.dte <= 1) ? 'var(--loss)' : '#f59e0b', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Expiring Soon</span>
              {expiringTrades.slice(0, 5).map(({ trade, dte }) => (
                <span key={trade.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span style={{ fontWeight: 500 }}>{trade.name || trade.underlying}</span>
                  {dte !== null && <DteBadge dte={dte} size="sm" />}
                </span>
              ))}
              {expiringTrades.length > 5 && (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>+{expiringTrades.length - 5} more</span>
              )}
            </div>
          </div>
        )}

        {/* Open Trades Table */}
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              Open Trades
              {openTrades.length > 0 && (
                <span style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--profit)',
                  animation: 'pulse-dot 2s ease-in-out infinite',
                  boxShadow: '0 0 8px rgba(52, 211, 153, 0.5)',
                }} />
              )}
            </h2>
          </div>

          {tradesError ? (
            <div className="card empty-state">
              <p style={{ color: 'var(--loss)', marginBottom: '8px' }}>Failed to load trades</p>
              <button onClick={() => fetchTrades()} className="btn-ghost" style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Retry</button>
            </div>
          ) : tradesLoading ? (
            <div className="card empty-state">
              <p className="empty-state-text">Loading...</p>
            </div>
          ) : openTrades.length === 0 ? (
            <div className="card empty-state">
              <p className="empty-state-title" style={{ fontSize: '16px', fontWeight: 600 }}>No open trades</p>
              <p className="empty-state-text">Add a trade in the Journal to get started</p>
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Underlying</th>
                    <th style={thStyle}>Strategy</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Qty</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Entry</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Opened</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>DTE</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {openTrades.map((trade, idx) => (
                    <tr
                      key={trade.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        animation: `slideUp 0.35s ease-out ${idx * 0.04}s both`,
                        position: 'relative',
                      }}
                    >
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {/* Left color bar */}
                          <div style={{
                            position: 'absolute',
                            left: 0,
                            top: '8px',
                            bottom: '8px',
                            width: '3px',
                            borderRadius: '0 3px 3px 0',
                            background: 'var(--profit)',
                            boxShadow: '0 0 8px rgba(52, 211, 153, 0.4)',
                          }} />
                          <div className="asset-icon">
                            {trade.underlying.slice(0, 2)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {trade.name || trade.underlying}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              {trade.assetType}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                          {trade.underlying}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 10px',
                          borderRadius: '9999px',
                          fontSize: '12px',
                          fontWeight: 600,
                          background: 'rgba(139, 92, 246, 0.1)',
                          color: 'var(--accent-violet)',
                        }}>
                          {trade.strategy || '—'}
                        </span>
                      </td>
                      <td className="font-mono text-right" style={tdStyle}>
                        {formatQuantity(trade.quantity)}
                      </td>
                      <td className="font-mono text-right" style={tdStyle}>
                        {trade.entryPrice != null ? formatPrice(trade.entryPrice) : '—'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-muted)', fontSize: '13px' }}>
                        {trade.openDate ? formatDate(trade.openDate) : '—'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {(() => {
                          const dte = getDTE(getEarliestExpiration(trade.legs));
                          if (dte === null) return <span style={{ color: 'var(--text-muted)' }}>&mdash;</span>;
                          return <DteBadge dte={dte} size="md" />;
                        })()}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <span style={{ color: 'var(--text-muted)' }}>&mdash;</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Activity - Closed Trades */}
        <div style={{ marginTop: '56px' }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '20px',
          }}>
            Recent Activity
          </h2>

          {tradesLoading ? (
            <div className="card empty-state">
              <p className="empty-state-text">Loading...</p>
            </div>
          ) : recentClosedTrades.length === 0 ? (
            <div className="card empty-state">
              <p className="empty-state-title" style={{ fontSize: '16px', fontWeight: 600 }}>No closed trades yet</p>
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={thStyle}>Closed</th>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Underlying</th>
                    <th style={thStyle}>Strategy</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {recentClosedTrades.map((trade, idx) => {
                    const pnl = trade.realizedPnl ?? null;
                    const pnlPositive = pnl !== null ? pnl >= 0 : true;

                    return (
                      <tr
                        key={trade.id}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          animation: `slideUp 0.35s ease-out ${idx * 0.04}s both`,
                          position: 'relative',
                        }}
                      >
                        <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: '13px' }}>
                          {trade.closeDate ? formatDate(trade.closeDate) : '—'}
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {/* Left color bar */}
                            <div style={{
                              position: 'absolute',
                              left: 0,
                              top: '8px',
                              bottom: '8px',
                              width: '3px',
                              borderRadius: '0 3px 3px 0',
                              background: pnlPositive ? 'var(--profit)' : 'var(--loss)',
                              boxShadow: pnlPositive
                                ? '0 0 8px rgba(52, 211, 153, 0.4)'
                                : '0 0 8px rgba(248, 113, 113, 0.4)',
                            }} />
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {trade.name || trade.underlying}
                            </span>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {trade.underlying}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 10px',
                            borderRadius: '9999px',
                            fontSize: '12px',
                            fontWeight: 600,
                            background: 'rgba(139, 92, 246, 0.1)',
                            color: 'var(--accent-violet)',
                          }}>
                            {trade.strategy || '—'}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          {pnl !== null ? (
                            <PnlDisplay pnl={pnl} pnlPercent={null} />
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>&mdash;</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

const thStyle = { ...tableHeaderStyle, padding: '18px 24px' };
const tdStyle = { ...tableCellStyle, padding: '20px 24px' };

function StatCard({
  label,
  numericValue,
  formatter,
  subtext,
  positive,
  glowIntensity: t = 1,
  style,
}: {
  label: string;
  numericValue: number;
  formatter?: (v: number) => string;
  subtext?: string;
  positive?: boolean;
  glowIntensity?: number;
  style?: React.CSSProperties;
}) {
  const animated = useAnimatedNumber(numericValue);
  const displayValue = formatter ? formatter(animated) : formatCurrency(animated);

  const valueColor = positive !== undefined
    ? (positive ? 'var(--profit)' : 'var(--loss)')
    : 'var(--text-primary)';

  const gradientClass = positive !== undefined
    ? (positive ? 'stat-gradient-profit' : 'stat-gradient-loss')
    : 'stat-gradient-neutral';

  // Dynamic glow on the card border scaled by intensity
  const sga = (base: number) => +(base * (0.2 + 0.8 * t)).toFixed(3);
  const sgc = positive ? '52, 211, 153' : '248, 113, 113';
  const glowBorder = positive !== undefined
    ? {
        borderColor: `rgba(${sgc}, ${sga(0.12)})`,
        boxShadow: `var(--shadow-card), 0 0 20px rgba(${sgc}, ${sga(0.05)})`,
      }
    : {};

  return (
    <div className={`card ${gradientClass}`} style={{
      padding: '28px',
      position: 'relative',
      overflow: 'hidden',
      ...glowBorder,
      ...style,
    }}>
      {/* Left-side stripe with glow */}
      {positive !== undefined && (
        <div style={{
          position: 'absolute',
          top: '16px',
          left: 0,
          bottom: '16px',
          width: '3px',
          borderRadius: '0 3px 3px 0',
          background: positive ? 'var(--profit)' : 'var(--loss)',
          boxShadow: `0 0 8px rgba(${sgc}, ${sga(0.5)})`,
        }} />
      )}
      <p className="stat-label" style={{ marginBottom: '12px' }}>{label}</p>
      <p style={{
        fontSize: '30px',
        fontWeight: 700,
        color: valueColor,
        fontFamily: "'DM Mono', monospace",
        letterSpacing: '-1.5px',
        fontVariantNumeric: 'tabular-nums',
        textShadow: positive !== undefined
          ? `0 0 30px rgba(${sgc}, ${sga(0.25)})`
          : 'none',
      }}>
        {displayValue}
      </p>
      {subtext && (
        <p style={{
          fontSize: '13px',
          color: positive !== undefined ? valueColor : 'var(--text-muted)',
          marginTop: '8px',
          opacity: 0.9
        }}>
          {subtext}
        </p>
      )}
    </div>
  );
}
