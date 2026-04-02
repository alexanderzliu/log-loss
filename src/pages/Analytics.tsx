import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { fetchPriceHistory } from '../api/prices';
import { fetchEquityCurve, fetchTradingAnalytics } from '../api/trades';
import type { PriceHistory, TradeAssetType, EquityCurvePoint, TradingAnalytics } from '../types';
import {
  LineChart,
  Line,
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
import { Search, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { formatPrice, formatPercent, formatCurrency, formatCompactNumber } from '../utils/format';
import { priceKey as getPriceKey } from '../utils/priceKey';
import PageTransition from '../components/PageTransition';
import PnlCalendar from '../components/PnlCalendar';

const tooltipStyle = {
  borderRadius: '12px',
  border: '1px solid var(--border-light)',
  background: 'var(--dropdown-bg)',
  backdropFilter: 'blur(12px)',
  boxShadow: 'var(--dropdown-shadow)',
  color: 'var(--text-primary)',
};

export default function Analytics() {
  const navigate = useNavigate();
  const { trades, prices, fetchPrices, fetchTrades } = useStore(useShallow((s) => ({
    trades: s.trades,
    prices: s.prices,
    fetchPrices: s.fetchPrices,
    fetchTrades: s.fetchTrades,
  })));

  // Price analytics state (existing)
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [selectedAssetType, setSelectedAssetType] = useState<TradeAssetType>('stock');
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [timeRange, setTimeRange] = useState<number>(30);
  const requestIdRef = useRef(0);

  // Trading analytics state (new)
  const [equityCurve, setEquityCurve] = useState<EquityCurvePoint[]>([]);
  const [analytics, setAnalytics] = useState<TradingAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // Fetch trading analytics and trades on mount
  useEffect(() => {
    fetchTrades();
    let cancelled = false;
    async function load() {
      setAnalyticsLoading(true);
      try {
        const [curve, stats] = await Promise.all([
          fetchEquityCurve(),
          fetchTradingAnalytics(),
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
  }, [fetchTrades]);

  // Get unique symbols from trades - memoized to avoid new array refs each render
  const trackedAssets = useMemo(() => Array.from(
    new Map(
      trades.map((t) => [getPriceKey({ symbol: t.underlying, assetType: t.assetType }), { symbol: t.underlying, assetType: t.assetType }])
    ).values()
  ), [trades]);

  useEffect(() => {
    if (trackedAssets.length > 0) {
      fetchPrices(trackedAssets);
    }
  }, [trackedAssets, fetchPrices]);

  const loadPriceHistory = useCallback(async (symbol: string, assetType: TradeAssetType, days: number) => {
    if (!symbol) return;
    const currentRequestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const data = await fetchPriceHistory(symbol, assetType, days);
      if (currentRequestId === requestIdRef.current) {
        setPriceHistory(data.history);
      }
    } catch (error) {
      if (currentRequestId === requestIdRef.current) {
        console.error('Failed to load price history:', error);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (selectedSymbol && selectedAssetType) {
      loadPriceHistory(selectedSymbol, selectedAssetType, timeRange);
    }
  }, [selectedSymbol, selectedAssetType, timeRange, loadPriceHistory]);

  const handleSearch = () => {
    if (searchInput.trim()) {
      setSelectedSymbol(searchInput.toUpperCase());
      fetchPrices([{ symbol: searchInput.toUpperCase(), assetType: selectedAssetType }]);
    }
  };

  const handleAssetClick = (symbol: string, assetType: TradeAssetType) => {
    setSelectedSymbol(symbol);
    setSelectedAssetType(assetType);
    setSearchInput(symbol);
  };

  const selectedAsset = trackedAssets.find((a) => a.symbol === selectedSymbol && a.assetType === selectedAssetType);
  const currentPrice = selectedAsset
    ? prices[getPriceKey(selectedAsset)]
    : prices[`${selectedSymbol}-${selectedAssetType}`];

  const chartData = priceHistory.map((p) => ({
    date: format(new Date(p.timestamp), 'MMM d'),
    price: p.price,
  }));

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

  // Sort P&L by underlying by absolute value descending
  const pnlByUnderlying = [...(analytics?.pnlByUnderlying ?? [])].sort(
    (a, b) => Math.abs(b.pnl) - Math.abs(a.pnl)
  );

  // Sort P&L by strategy by absolute value descending
  const pnlByStrategy = [...(analytics?.pnlByStrategy ?? [])].sort(
    (a, b) => Math.abs(b.pnl) - Math.abs(a.pnl)
  );

  // Sort P&L by entry quality by absolute value descending
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
    <div className="page-container flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="page-header">Analytics</h1>
        <p className="page-subtitle">Trading performance and price analysis</p>
      </div>

      {/* ========== SECTION 1: Trading Performance ========== */}
      {analyticsLoading ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading trading analytics...</p>
        </div>
      ) : !hasAnalyticsData ? (
        <div className="card empty-state">
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
        <>
          {/* Key Stats Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '20px',
          }}>
            <div className="card stat-gradient-neutral" style={{ padding: '28px', position: 'relative', overflow: 'hidden' }}>
              <p className="stat-label" style={{ marginBottom: '12px' }}>Profit Factor</p>
              <p style={{
                fontSize: '30px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                fontFamily: "'DM Mono', monospace",
                letterSpacing: '-1.5px',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {analytics!.profitFactor.toFixed(2)}
              </p>
            </div>

            <div className="card stat-gradient-profit" style={{ padding: '28px', position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute',
                top: '16px',
                left: 0,
                bottom: '16px',
                width: '3px',
                borderRadius: '0 3px 3px 0',
                background: 'var(--profit)',
                boxShadow: '0 0 8px rgba(52, 211, 153, 0.5)',
              }} />
              <p className="stat-label" style={{ marginBottom: '12px' }}>Avg Win</p>
              <p style={{
                fontSize: '30px',
                fontWeight: 700,
                color: 'var(--profit)',
                fontFamily: "'DM Mono', monospace",
                letterSpacing: '-1.5px',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {analytics!.avgWin !== null ? formatCurrency(analytics!.avgWin) : '--'}
              </p>
            </div>

            <div className="card stat-gradient-loss" style={{ padding: '28px', position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute',
                top: '16px',
                left: 0,
                bottom: '16px',
                width: '3px',
                borderRadius: '0 3px 3px 0',
                background: 'var(--loss)',
                boxShadow: '0 0 8px rgba(248, 113, 113, 0.5)',
              }} />
              <p className="stat-label" style={{ marginBottom: '12px' }}>Avg Loss</p>
              <p style={{
                fontSize: '30px',
                fontWeight: 700,
                color: 'var(--loss)',
                fontFamily: "'DM Mono', monospace",
                letterSpacing: '-1.5px',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {analytics!.avgLoss !== null ? formatCurrency(analytics!.avgLoss) : '--'}
              </p>
            </div>

            <div className="card stat-gradient-neutral" style={{ padding: '28px', position: 'relative', overflow: 'hidden' }}>
              <p className="stat-label" style={{ marginBottom: '12px' }}>Avg Hold Time</p>
              <p style={{
                fontSize: '30px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                fontFamily: "'DM Mono', monospace",
                letterSpacing: '-1.5px',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {analytics!.avgHoldDays !== null ? `${analytics!.avgHoldDays.toFixed(0)} days` : '--'}
              </p>
            </div>
          </div>

          {/* Cumulative P&L Chart */}
          <div className="card" style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '24px' }}>
              Cumulative P&L
            </h2>
            {equityChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={equityChartData}>
                  <defs>
                    <linearGradient id="pnlGradientPos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--profit)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--profit)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="pnlGradientNeg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--loss)" stopOpacity={0} />
                      <stop offset="100%" stopColor="var(--loss)" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
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
                    fill={equityChartData[equityChartData.length - 1]?.cumulativePnl >= 0 ? 'url(#pnlGradientPos)' : 'url(#pnlGradientNeg)'}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                No equity curve data available
              </div>
            )}
          </div>

          {/* P&L Calendar */}
          <PnlCalendar data={equityCurve} onDayClick={(date) => navigate(`/trades?date=${date}`)} />

          {/* Monthly Returns + P&L by Symbol side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Monthly Returns Bar Chart */}
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

            {/* P&L by Underlying */}
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
                        <div style={{
                          width: '60px',
                          flexShrink: 0,
                          fontWeight: 600,
                          fontSize: '13px',
                          color: 'var(--text-primary)',
                        }}>
                          {item.underlying}
                        </div>
                        <div style={{ flex: 1, position: 'relative', height: '28px', background: 'var(--bg-elevated)', borderRadius: '6px', overflow: 'hidden' }}>
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            height: '100%',
                            width: `${Math.max(barWidth, 2)}%`,
                            background: isPositive
                              ? 'linear-gradient(90deg, rgba(52, 211, 153, 0.3), rgba(52, 211, 153, 0.15))'
                              : 'linear-gradient(90deg, rgba(248, 113, 113, 0.3), rgba(248, 113, 113, 0.15))',
                            borderRadius: '6px',
                            transition: 'width 0.3s ease',
                          }} />
                          <div style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            height: '100%',
                            padding: '0 10px',
                          }}>
                            <span style={{
                              fontFamily: "'DM Mono', monospace",
                              fontSize: '13px',
                              fontWeight: 600,
                              color: isPositive ? 'var(--profit)' : 'var(--loss)',
                            }}>
                              {formatCurrency(item.pnl)}
                            </span>
                            <span style={{
                              fontSize: '11px',
                              color: 'var(--text-muted)',
                            }}>
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

          {/* Strategy Performance & Entry Quality */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* P&L by Strategy */}
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
                        <div style={{
                          width: '90px',
                          flexShrink: 0,
                          fontWeight: 600,
                          fontSize: '12px',
                          color: 'var(--text-primary)',
                          textTransform: 'capitalize',
                        }}>
                          {item.strategy.replace(/_/g, ' ')}
                        </div>
                        <div style={{ flex: 1, position: 'relative', height: '28px', background: 'var(--bg-elevated)', borderRadius: '6px', overflow: 'hidden' }}>
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            height: '100%',
                            width: `${Math.max(barWidth, 2)}%`,
                            background: isPositive
                              ? 'linear-gradient(90deg, rgba(52, 211, 153, 0.3), rgba(52, 211, 153, 0.15))'
                              : 'linear-gradient(90deg, rgba(248, 113, 113, 0.3), rgba(248, 113, 113, 0.15))',
                            borderRadius: '6px',
                            transition: 'width 0.3s ease',
                          }} />
                          <div style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            height: '100%',
                            padding: '0 10px',
                          }}>
                            <span style={{
                              fontFamily: "'DM Mono', monospace",
                              fontSize: '13px',
                              fontWeight: 600,
                              color: isPositive ? 'var(--profit)' : 'var(--loss)',
                            }}>
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

            {/* P&L by Entry Quality */}
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
                        <div style={{
                          width: '90px',
                          flexShrink: 0,
                          fontWeight: 600,
                          fontSize: '12px',
                          color: 'var(--text-primary)',
                          textTransform: 'capitalize',
                        }}>
                          {item.entryQuality}
                        </div>
                        <div style={{ flex: 1, position: 'relative', height: '28px', background: 'var(--bg-elevated)', borderRadius: '6px', overflow: 'hidden' }}>
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            height: '100%',
                            width: `${Math.max(barWidth, 2)}%`,
                            background: isPositive
                              ? 'linear-gradient(90deg, rgba(52, 211, 153, 0.3), rgba(52, 211, 153, 0.15))'
                              : 'linear-gradient(90deg, rgba(248, 113, 113, 0.3), rgba(248, 113, 113, 0.15))',
                            borderRadius: '6px',
                            transition: 'width 0.3s ease',
                          }} />
                          <div style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            height: '100%',
                            padding: '0 10px',
                          }}>
                            <span style={{
                              fontFamily: "'DM Mono', monospace",
                              fontSize: '13px',
                              fontWeight: 600,
                              color: isPositive ? 'var(--profit)' : 'var(--loss)',
                            }}>
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

          {/* Best / Worst Trades */}
          {(analytics!.bestTrade || analytics!.worstTrade) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {analytics!.bestTrade && (
                <div className="card stat-gradient-profit" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute',
                    top: '16px',
                    left: 0,
                    bottom: '16px',
                    width: '3px',
                    borderRadius: '0 3px 3px 0',
                    background: 'var(--profit)',
                    boxShadow: '0 0 8px rgba(52, 211, 153, 0.5)',
                  }} />
                  <p className="stat-label" style={{ marginBottom: '8px' }}>Best Trade</p>
                  <p style={{
                    fontSize: '24px',
                    fontWeight: 700,
                    color: 'var(--profit)',
                    fontFamily: "'DM Mono', monospace",
                    letterSpacing: '-1.5px',
                  }}>
                    {formatCurrency(analytics!.bestTrade.pnl)}
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    {analytics!.bestTrade.underlying} &middot; {analytics!.bestTrade.name} &middot; {format(new Date(analytics!.bestTrade.date), 'MMM d, yyyy')}
                  </p>
                </div>
              )}
              {analytics!.worstTrade && (
                <div className="card stat-gradient-loss" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute',
                    top: '16px',
                    left: 0,
                    bottom: '16px',
                    width: '3px',
                    borderRadius: '0 3px 3px 0',
                    background: 'var(--loss)',
                    boxShadow: '0 0 8px rgba(248, 113, 113, 0.5)',
                  }} />
                  <p className="stat-label" style={{ marginBottom: '8px' }}>Worst Trade</p>
                  <p style={{
                    fontSize: '24px',
                    fontWeight: 700,
                    color: 'var(--loss)',
                    fontFamily: "'DM Mono', monospace",
                    letterSpacing: '-1.5px',
                  }}>
                    {formatCurrency(analytics!.worstTrade.pnl)}
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    {analytics!.worstTrade.underlying} &middot; {analytics!.worstTrade.name} &middot; {format(new Date(analytics!.worstTrade.date), 'MMM d, yyyy')}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ========== SECTION 2: Price Analytics (existing) ========== */}
      <div style={{
        borderTop: '1px solid var(--border)',
        paddingTop: '32px',
        marginTop: '16px',
      }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '4px',
        }}>
          Price Analytics
        </h2>
        <p style={{
          color: 'var(--text-muted)',
          fontSize: '14px',
          marginBottom: '24px',
        }}>
          Track asset performance and price history
        </p>
      </div>

      {/* Search Bar */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Enter symbol (e.g., SPY, AAPL)"
          style={{ flex: 1 }}
        />
        <button
          onClick={handleSearch}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Search size={18} />
          Search
        </button>
      </div>

      {/* Tracked Assets */}
      {trackedAssets.length > 0 && (
        <div>
          <h3 style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '12px',
          }}>
            Your Assets
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {trackedAssets.map((asset) => {
              const { symbol, assetType } = asset;
              const price = prices[getPriceKey(asset)];
              const isSelected = selectedSymbol === symbol && selectedAssetType === assetType;
              return (
                <button
                  key={`${symbol}-${assetType}`}
                  onClick={() => handleAssetClick(symbol, assetType)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '16px',
                    border: isSelected ? '1px solid var(--border-accent)' : '1px solid var(--border)',
                    background: isSelected ? 'var(--gradient-card)' : 'transparent',
                    boxShadow: isSelected ? 'var(--shadow-glow)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{symbol}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {assetType}
                    </span>
                  </div>
                  {price && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>
                        {formatPrice(price.price)}
                      </span>
                      <span style={{
                        fontSize: '12px',
                        color: price.changePercent24h >= 0 ? 'var(--profit)' : 'var(--loss)',
                      }}>
                        {formatPercent(price.changePercent24h)}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Price Chart */}
      {selectedSymbol && (
        <div className="card" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {selectedSymbol}
                </h2>
                <span style={{
                  fontSize: '11px',
                  padding: '4px 10px',
                  background: 'var(--bg-elevated)',
                  borderRadius: '9999px',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  fontWeight: 500,
                }}>
                  {selectedAssetType}
                </span>
              </div>
              {currentPrice && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                  <span style={{
                    fontSize: '28px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    fontFamily: "'DM Mono', monospace",
                    letterSpacing: '-1px',
                  }}>
                    {formatPrice(currentPrice.price)}
                  </span>
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: currentPrice.changePercent24h >= 0 ? 'var(--profit)' : 'var(--loss)',
                    fontSize: '14px',
                    fontWeight: 500,
                  }}>
                    {currentPrice.changePercent24h >= 0 ? (
                      <TrendingUp size={16} />
                    ) : (
                      <TrendingDown size={16} />
                    )}
                    {formatPercent(currentPrice.changePercent24h)} (24h)
                  </span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => setTimeRange(days)}
                  style={{
                    padding: '8px 14px',
                    fontSize: '13px',
                    borderRadius: '9999px',
                    border: timeRange === days ? '1px solid var(--border-accent)' : '1px solid var(--border)',
                    background: timeRange === days ? 'var(--accent-soft)' : 'transparent',
                    color: timeRange === days ? 'var(--accent)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: 500,
                    fontFamily: 'inherit',
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  {days}D
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Loading chart...
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickFormatter={(value) => formatPrice(value)}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  formatter={(value) => [formatPrice(value as number), 'Price']}
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: 'var(--text-muted)' }}
                  itemStyle={{ color: 'var(--accent)' }}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              No price data available
            </div>
          )}

          {/* Price Stats */}
          {currentPrice && (() => {
            const labelStyle = { fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '6px' };
            const valueStyle = { fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'DM Mono', monospace" };
            return (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '16px',
                marginTop: '24px',
                paddingTop: '24px',
                borderTop: '1px solid var(--border)',
              }}>
                <div>
                  <div style={labelStyle}>24h High</div>
                  <div style={valueStyle}>{formatPrice(currentPrice.high24h)}</div>
                </div>
                <div>
                  <div style={labelStyle}>24h Low</div>
                  <div style={valueStyle}>{formatPrice(currentPrice.low24h)}</div>
                </div>
                <div>
                  <div style={labelStyle}>24h Change</div>
                  <div style={{
                    ...valueStyle,
                    color: currentPrice.change24h >= 0 ? 'var(--profit)' : 'var(--loss)',
                  }}>
                    {currentPrice.change24h >= 0 ? '+' : ''}{formatPrice(currentPrice.change24h)}
                  </div>
                </div>
                <div>
                  <div style={labelStyle}>24h Volume</div>
                  <div style={valueStyle}>
                    {currentPrice.volume24h ? formatCompactNumber(currentPrice.volume24h) : 'N/A'}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Empty State */}
      {!selectedSymbol && trackedAssets.length === 0 && (
        <div className="card empty-state">
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
            <Search style={{ color: 'var(--accent)' }} size={28} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Search for an asset
          </h3>
          <p className="empty-state-text" style={{ maxWidth: '320px', margin: '0 auto' }}>
            Enter a symbol above to view price data and charts.
          </p>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
