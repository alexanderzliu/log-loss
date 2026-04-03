import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { ArrowUpRight, ArrowDownRight, AlertTriangle, BarChart3 } from 'lucide-react';
import { formatCurrency, formatQuantity, formatPrice, formatDate } from '../utils/format';
import { tableHeaderStyle, tableCellStyle } from '../utils/styles';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import PageTransition from '../components/PageTransition';
import DteBadge from '../components/DteBadge';
import PnlCalendar from '../components/PnlCalendar';
import { getDTE, getEarliestExpiration } from '../utils/dte';
import { fetchEquityCurve, fetchTradingAnalytics } from '../api/trades';
import type { EquityCurvePoint, TradingAnalytics } from '../types';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { format } from 'date-fns';

const tooltipStyle = {
  borderRadius: '12px',
  border: '1px solid var(--border-light)',
  background: 'var(--dropdown-bg)',
  backdropFilter: 'blur(12px)',
  boxShadow: 'var(--dropdown-shadow)',
  color: 'var(--text-primary)',
};

export default function Dashboard() {
  const navigate = useNavigate();
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

  // Analytics state
  const [equityCurve, setEquityCurve] = useState<EquityCurvePoint[]>([]);
  const [analytics, setAnalytics] = useState<TradingAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [tradeTypeFilter, setTradeTypeFilter] = useState<'all' | 'intraday' | 'swing'>('all');

  useEffect(() => {
    fetchTrades();
    fetchPortfolioSummary();
    fetchPredictionsSummary();
  }, [fetchTrades, fetchPortfolioSummary, fetchPredictionsSummary]);

  // Fetch analytics when filter changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setAnalyticsLoading(true);
      const tt = tradeTypeFilter === 'all' ? undefined : tradeTypeFilter;
      try {
        const [curve, stats] = await Promise.all([
          fetchEquityCurve(tt),
          fetchTradingAnalytics(tt),
        ]);
        if (!cancelled) {
          setEquityCurve(curve);
          setAnalytics(stats);
        }
      } catch (error) {
        console.error('Failed to load trading analytics:', error);
      } finally {
        if (!cancelled) setAnalyticsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [tradeTypeFilter]);

  const openTrades = useMemo(() => {
    return trades
      .filter((t) => t.status === 'open')
      .sort((a, b) => {
        const aDte = getDTE(getEarliestExpiration(a.legs));
        const bDte = getDTE(getEarliestExpiration(b.legs));
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

  // Prepare equity curve chart data
  const equityChartData = equityCurve.map((p) => ({
    date: format(new Date(p.date), 'MMM d'),
    dailyPnl: p.dailyPnl,
    cumulativePnl: p.cumulativePnl,
    tradeCount: p.tradeCount,
  }));

  // Prepare monthly P&L chart data
  const monthlyChartData = (analytics?.monthlyPnl ?? []).map((m) => ({
    month: format(new Date(m.month + '-01'), 'MMM yyyy'),
    pnl: m.pnl,
    wins: m.wins,
    losses: m.losses,
  }));

  const pnlByUnderlying = [...(analytics?.pnlByUnderlying ?? [])].sort(
    (a, b) => Math.abs(b.pnl) - Math.abs(a.pnl)
  );

  const pnlByStrategy = [...(analytics?.pnlByStrategy ?? [])].sort(
    (a, b) => Math.abs(b.pnl) - Math.abs(a.pnl)
  );

  const pnlByEntryQuality = [...(analytics?.pnlByEntryQuality ?? [])].sort(
    (a, b) => Math.abs(b.pnl) - Math.abs(a.pnl)
  );

  const hasAnalyticsData = analytics && (
    analytics.profitFactor > 0 ||
    analytics.avgWin !== null ||
    analytics.avgLoss !== null ||
    analytics.avgHoldDays !== null
  );

  return (
    <PageTransition>
      <div className="page-container">
        {/* ===== Hero P&L + Equity Curve ===== */}
        <div style={{ position: 'relative', marginBottom: '32px' }}>
          {/* Ambient glow halo */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: equityChartData.length > 0 ? '24px' : 0 }}>
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

            {/* Equity Curve inside hero */}
            {equityChartData.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={equityChartData}>
                    <defs>
                      <linearGradient id="heroPnlGradientPos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--profit)" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="var(--profit)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="heroPnlGradientNeg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--loss)" stopOpacity={0} />
                        <stop offset="100%" stopColor="var(--loss)" stopOpacity={0.25} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => formatCurrency(value)}
                      width={70}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div style={{ ...tooltipStyle, padding: '12px 16px' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '8px' }}>{label}</p>
                            <p style={{
                              color: data.cumulativePnl >= 0 ? 'var(--profit)' : 'var(--loss)',
                              fontFamily: "'DM Mono', monospace",
                              fontWeight: 600,
                            }}>
                              Cumulative: {formatCurrency(data.cumulativePnl)}
                            </p>
                            <p style={{
                              color: data.dailyPnl >= 0 ? 'var(--profit)' : 'var(--loss)',
                              fontFamily: "'DM Mono', monospace",
                              fontSize: '13px',
                              marginTop: '4px',
                            }}>
                              Daily: {formatCurrency(data.dailyPnl)}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="cumulativePnl"
                      stroke={equityChartData[equityChartData.length - 1]?.cumulativePnl >= 0 ? 'var(--profit)' : 'var(--loss)'}
                      strokeWidth={2}
                      fill={equityChartData[equityChartData.length - 1]?.cumulativePnl >= 0 ? 'url(#heroPnlGradientPos)' : 'url(#heroPnlGradientNeg)'}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* ===== Trade Type Filter + Stats Row ===== */}
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

        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
          {(['all', 'intraday', 'swing'] as const).map((type) => {
            const isActive = tradeTypeFilter === type;
            const label = type === 'all' ? 'All Trades' : type === 'intraday' ? 'Intraday' : 'Swing';
            return (
              <button
                key={type}
                onClick={() => setTradeTypeFilter(type)}
                style={{
                  padding: '5px 14px',
                  borderRadius: '8px',
                  border: isActive ? '1px solid var(--border-accent)' : '1px solid var(--border)',
                  background: isActive ? 'var(--accent-soft)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s ease',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '16px',
          marginBottom: '40px',
        }}>
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
                style={stagger(0)}
              />
            );
          })()}
          <StatCard
            label="Profit Factor"
            numericValue={analytics?.profitFactor ?? 0}
            formatter={(v) => v.toFixed(2)}
            style={stagger(1)}
          />
          <StatCard
            label="Discipline"
            numericValue={portfolioSummary?.followedPlanRate ?? 0}
            formatter={(v) => `${v.toFixed(0)}%`}
            subtext="followed plan"
            style={stagger(2)}
          />
          <StatCard
            label="Avg Win"
            numericValue={analytics?.avgWin ?? 0}
            positive={true}
            style={stagger(3)}
          />
          <StatCard
            label="Avg Loss"
            numericValue={analytics?.avgLoss ?? 0}
            positive={false}
            style={stagger(4)}
          />
        </div>

        {/* ===== P&L Calendar ===== */}
        {analyticsLoading ? (
          <div className="card" style={{ padding: '48px', textAlign: 'center', marginBottom: '40px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading analytics...</p>
          </div>
        ) : !hasAnalyticsData ? (
          <div className="card empty-state" style={{ marginBottom: '40px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'var(--accent-soft)',
              border: '1px solid var(--border-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <BarChart3 style={{ color: 'var(--accent)' }} size={28} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>
              No trading data yet
            </h3>
            <p className="empty-state-text" style={{ maxWidth: '320px', margin: '0 auto' }}>
              Close some trades to see performance analytics here.
            </p>
          </div>
        ) : (
          <div style={{ marginBottom: '40px' }}>
            <PnlCalendar data={equityCurve} onDayClick={(date) => navigate(`/trades?date=${date}`)} />
          </div>
        )}

        {/* ===== Open Trades ===== */}
        {/* Expiring Soon Banner */}
        {expiringTrades.length > 0 && (
          <div className="card" style={{
            padding: '16px 20px',
            marginBottom: '20px',
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

        <div style={{ marginBottom: '40px' }}>
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

        {/* ===== Analytics Breakdowns ===== */}
        {hasAnalyticsData && (
          <>
            {/* Monthly Returns + P&L by Underlying */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div className="card" style={{ padding: '28px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '24px' }}>
                  Monthly Returns
                </h2>
                {monthlyChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={monthlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                        tickLine={false}
                        axisLine={{ stroke: 'var(--border)' }}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                        tickLine={false}
                        axisLine={{ stroke: 'var(--border)' }}
                        tickFormatter={(value) => formatCurrency(value)}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div style={{ ...tooltipStyle, padding: '12px 16px' }}>
                              <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '8px' }}>{label}</p>
                              <p style={{
                                color: data.pnl >= 0 ? 'var(--profit)' : 'var(--loss)',
                                fontFamily: "'DM Mono', monospace",
                                fontWeight: 600,
                              }}>
                                {formatCurrency(data.pnl)}
                              </p>
                              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
                                {data.wins}W / {data.losses}L
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                        {monthlyChartData.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={entry.pnl >= 0 ? 'var(--profit)' : 'var(--loss)'}
                            fillOpacity={0.8}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    No monthly data available
                  </div>
                )}
              </div>

              <div className="card" style={{ padding: '28px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '24px' }}>
                  P&L by Underlying
                </h2>
                {pnlByUnderlying.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '280px', overflowY: 'auto' }}>
                    {pnlByUnderlying.map((item) => {
                      const maxAbsPnl = Math.abs(pnlByUnderlying[0].pnl);
                      const barWidth = maxAbsPnl > 0 ? (Math.abs(item.pnl) / maxAbsPnl) * 100 : 0;
                      const isPositive = item.pnl >= 0;
                      return (
                        <div key={item.underlying} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '60px', flexShrink: 0, fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                            {item.underlying}
                          </div>
                          <div style={{ flex: 1, position: 'relative', height: '28px', background: 'var(--bg-elevated)', borderRadius: '6px', overflow: 'hidden' }}>
                            <div style={{
                              position: 'absolute', top: 0, left: 0, height: '100%',
                              width: `${Math.max(barWidth, 2)}%`,
                              background: isPositive
                                ? 'linear-gradient(90deg, rgba(52, 211, 153, 0.3), rgba(52, 211, 153, 0.15))'
                                : 'linear-gradient(90deg, rgba(248, 113, 113, 0.3), rgba(248, 113, 113, 0.15))',
                              borderRadius: '6px', transition: 'width 0.3s ease',
                            }} />
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%', padding: '0 10px' }}>
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', fontWeight: 600, color: isPositive ? 'var(--profit)' : 'var(--loss)' }}>
                                {formatCurrency(item.pnl)}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {item.tradeCount} trade{item.tradeCount !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    No underlying data available
                  </div>
                )}
              </div>
            </div>

            {/* Strategy Performance + Entry Quality */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="card" style={{ padding: '28px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '24px' }}>
                  Strategy Performance
                </h2>
                {pnlByStrategy.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '320px', overflowY: 'auto' }}>
                    {pnlByStrategy.map((item) => {
                      const maxAbsPnl = Math.max(...pnlByStrategy.map(s => Math.abs(s.pnl)));
                      const barWidth = maxAbsPnl > 0 ? (Math.abs(item.pnl) / maxAbsPnl) * 100 : 0;
                      const isPositive = item.pnl >= 0;
                      return (
                        <div key={item.strategy} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '90px', flexShrink: 0, fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                            {item.strategy.replace(/_/g, ' ')}
                          </div>
                          <div style={{ flex: 1, position: 'relative', height: '28px', background: 'var(--bg-elevated)', borderRadius: '6px', overflow: 'hidden' }}>
                            <div style={{
                              position: 'absolute', top: 0, left: 0, height: '100%',
                              width: `${Math.max(barWidth, 2)}%`,
                              background: isPositive
                                ? 'linear-gradient(90deg, rgba(52, 211, 153, 0.3), rgba(52, 211, 153, 0.15))'
                                : 'linear-gradient(90deg, rgba(248, 113, 113, 0.3), rgba(248, 113, 113, 0.15))',
                              borderRadius: '6px', transition: 'width 0.3s ease',
                            }} />
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%', padding: '0 10px' }}>
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', fontWeight: 600, color: isPositive ? 'var(--profit)' : 'var(--loss)' }}>
                                {formatCurrency(item.pnl)}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
                                <span style={{ color: item.winRate >= 50 ? 'var(--profit)' : 'var(--loss)' }}>
                                  {item.winRate.toFixed(0)}% win
                                </span>
                                <span>{item.tradeCount} trade{item.tradeCount !== 1 ? 's' : ''}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    No strategy data available
                  </div>
                )}
              </div>

              <div className="card" style={{ padding: '28px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '24px' }}>
                  Entry Quality
                </h2>
                {pnlByEntryQuality.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '320px', overflowY: 'auto' }}>
                    {pnlByEntryQuality.map((item) => {
                      const maxAbsPnl = Math.max(...pnlByEntryQuality.map(s => Math.abs(s.pnl)));
                      const barWidth = maxAbsPnl > 0 ? (Math.abs(item.pnl) / maxAbsPnl) * 100 : 0;
                      const isPositive = item.pnl >= 0;
                      return (
                        <div key={item.entryQuality} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '90px', flexShrink: 0, fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                            {item.entryQuality}
                          </div>
                          <div style={{ flex: 1, position: 'relative', height: '28px', background: 'var(--bg-elevated)', borderRadius: '6px', overflow: 'hidden' }}>
                            <div style={{
                              position: 'absolute', top: 0, left: 0, height: '100%',
                              width: `${Math.max(barWidth, 2)}%`,
                              background: isPositive
                                ? 'linear-gradient(90deg, rgba(52, 211, 153, 0.3), rgba(52, 211, 153, 0.15))'
                                : 'linear-gradient(90deg, rgba(248, 113, 113, 0.3), rgba(248, 113, 113, 0.15))',
                              borderRadius: '6px', transition: 'width 0.3s ease',
                            }} />
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%', padding: '0 10px' }}>
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', fontWeight: 600, color: isPositive ? 'var(--profit)' : 'var(--loss)' }}>
                                {formatCurrency(item.pnl)}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
                                <span style={{ color: item.winRate >= 50 ? 'var(--profit)' : 'var(--loss)' }}>
                                  {item.winRate.toFixed(0)}% win
                                </span>
                                <span>{item.tradeCount} trade{item.tradeCount !== 1 ? 's' : ''}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    No entry quality data available
                  </div>
                )}
              </div>
            </div>
          </>
        )}
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
  style,
}: {
  label: string;
  numericValue: number;
  formatter?: (v: number) => string;
  subtext?: string;
  positive?: boolean;
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

  const sgc = positive ? '52, 211, 153' : '248, 113, 113';

  return (
    <div className={`card ${gradientClass}`} style={{
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
      ...style,
    }}>
      {positive !== undefined && (
        <div style={{
          position: 'absolute',
          top: '16px',
          left: 0,
          bottom: '16px',
          width: '3px',
          borderRadius: '0 3px 3px 0',
          background: positive ? 'var(--profit)' : 'var(--loss)',
          boxShadow: `0 0 8px rgba(${sgc}, 0.5)`,
        }} />
      )}
      <p className="stat-label" style={{ marginBottom: '10px' }}>{label}</p>
      <p style={{
        fontSize: '26px',
        fontWeight: 700,
        color: valueColor,
        fontFamily: "'DM Mono', monospace",
        letterSpacing: '-1.5px',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {displayValue}
      </p>
      {subtext && (
        <p style={{
          fontSize: '12px',
          color: positive !== undefined ? valueColor : 'var(--text-muted)',
          marginTop: '6px',
          opacity: 0.9,
        }}>
          {subtext}
        </p>
      )}
    </div>
  );
}
