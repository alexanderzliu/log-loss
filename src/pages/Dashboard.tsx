import { Fragment, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { RefreshCw, ArrowUpRight, ArrowDownRight, ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrency, formatPercent, formatQuantity, formatPrice } from '../utils/format';
import { tableHeaderStyle, tableCellStyle } from '../utils/styles';
import { calculateUnrealizedPnl } from '../utils/aggregatePositions';
import { priceKey as getPriceKey } from '../utils/priceKey';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { useSetToggle } from '../hooks/useSetToggle';
import PageTransition from '../components/PageTransition';
import PnlDisplay from '../components/PnlDisplay';

export default function Dashboard() {
  const {
    positions,
    positionsLoading,
    positionsError,
    prices,
    portfolioSummary,
    portfolioError,
    predictionsSummary,
    predictionsSummaryError,
    fetchPositions,
    fetchPortfolioSummary,
    fetchPredictionsSummary,
    refreshPrices,
  } = useStore();

  const [expandedPositions, toggleExpanded] = useSetToggle();

  useEffect(() => {
    fetchPositions();
    fetchPortfolioSummary();
    fetchPredictionsSummary();
    const interval = setInterval(refreshPrices, 60000);
    return () => clearInterval(interval);
  }, [fetchPositions, fetchPortfolioSummary, fetchPredictionsSummary, refreshPrices]);

  const openPositions = positions.filter((p) => p.status === 'open');

  const unrealizedPnl = openPositions.reduce((total, pos) => {
    const currentPrice = prices[getPriceKey(pos)]?.price;
    const { pnl } = calculateUnrealizedPnl(pos, currentPrice);
    return total + (pnl ?? 0);
  }, 0);

  const positionsInvested = openPositions.reduce(
    (total, pos) => total + pos.avgEntryPrice * pos.remainingQuantity,
    0
  );
  const predictionsInvested = predictionsSummary?.openPredictionsCost || 0;
  const totalInvested = positionsInvested + predictionsInvested;

  const unrealizedPnlPercent = positionsInvested > 0 ? (unrealizedPnl / positionsInvested) * 100 : 0;
  const predictionsPnl = predictionsSummary?.predictionsPnl || 0;
  const totalPnl = (portfolioSummary?.realizedPnl || 0) + unrealizedPnl + predictionsPnl;
  const totalCostBasis = (portfolioSummary?.totalCostBasis || 0) + (predictionsSummary?.predictionsCostBasis || 0);
  const totalPnlPercent = totalCostBasis > 0 ? (totalPnl / totalCostBasis) * 100 : 0;

  const animatedPortfolioValue = useAnimatedNumber(totalInvested + unrealizedPnl);
  const animatedTotalPnl = useAnimatedNumber(totalPnl);

  const isUp = totalPnl >= 0;

  // Glow intensity scales with P&L magnitude (saturates at ±50%)
  const intensity = Math.min(1, Math.sqrt(Math.abs(totalPnlPercent) / 50));
  const ga = (base: number) => +(base * (0.2 + 0.8 * intensity)).toFixed(3);
  const gc = isUp ? '52, 211, 153' : '248, 113, 113';

  const stagger = (index: number) => ({
    animation: `slideUp 0.4s ease-out ${index * 0.06}s both`,
  });

  return (
    <PageTransition>
      <div style={{ maxWidth: '1200px' }}>
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
              Total Portfolio Value
            </p>
            <h1 style={{
              fontSize: '72px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              fontFamily: "'DM Mono', monospace",
              letterSpacing: '-4px',
              marginBottom: '16px',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}>
              {formatCurrency(animatedPortfolioValue)}
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
                  {animatedTotalPnl >= 0 ? '+' : ''}{formatCurrency(animatedTotalPnl)} ({formatPercent(totalPnlPercent)})
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
          <StatCard label="Invested" numericValue={totalInvested} style={stagger(0)} />
          <StatCard
            label="Unrealized P&L"
            numericValue={unrealizedPnl}
            subtext={formatPercent(unrealizedPnlPercent)}
            positive={unrealizedPnl >= 0}
            glowIntensity={intensity}
            style={stagger(1)}
          />
          {(() => {
            const realizedPnl = (portfolioSummary?.realizedPnl || 0) + predictionsPnl;
            return (
              <StatCard
                label="Realized P&L"
                numericValue={realizedPnl}
                positive={realizedPnl >= 0}
                glowIntensity={intensity}
                style={stagger(2)}
              />
            );
          })()}
          {(() => {
            const tradesWins = portfolioSummary ? (portfolioSummary.winRate / 100) * portfolioSummary.closedPositions : 0;
            const tradesTotal = portfolioSummary?.closedPositions || 0;
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
                style={stagger(3)}
              />
            );
          })()}
        </div>

        {/* Open Positions Table */}
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
              Open Positions
              {openPositions.length > 0 && (
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
            <button onClick={refreshPrices} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>

          {positionsError ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
              <p style={{ color: 'var(--loss)', marginBottom: '8px' }}>Failed to load positions</p>
              <button onClick={() => fetchPositions()} className="btn-ghost" style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Retry</button>
            </div>
          ) : positionsLoading ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
            </div>
          ) : openPositions.length === 0 ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '16px', fontWeight: 600 }}>No open positions</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                Add a trade in the Journal to get started
              </p>
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={thStyle}>Asset</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Avg Entry</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Current</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Quantity</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Value</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {openPositions.map((position, idx) => {
                    const pk = getPriceKey(position);
                    const currentPrice = prices[pk]?.price;
                    const priceChange = prices[pk]?.changePercent24h;
                    const { pnl, pnlPercent } = calculateUnrealizedPnl(position, currentPrice);
                    const value = currentPrice
                      ? currentPrice * position.remainingQuantity
                      : position.avgEntryPrice * position.remainingQuantity;
                    const positionKey = position.id;
                    const isExpanded = expandedPositions.has(positionKey);
                    const buyExecutions = position.executions.filter(e => e.side === 'buy');
                    const hasMultipleLots = buyExecutions.length > 1;

                    // P&L-based row color bar
                    const rowPnlPositive = pnl !== null ? pnl >= 0 : true;

                    return (
                      <Fragment key={positionKey}>
                        <tr
                          style={{
                            borderBottom: isExpanded ? 'none' : '1px solid var(--border)',
                            cursor: hasMultipleLots ? 'pointer' : 'default',
                            animation: `slideUp 0.35s ease-out ${idx * 0.04}s both`,
                            position: 'relative',
                          }}
                          onClick={() => hasMultipleLots && toggleExpanded(positionKey)}
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
                                background: rowPnlPositive ? 'var(--profit)' : 'var(--loss)',
                                boxShadow: rowPnlPositive
                                  ? '0 0 8px rgba(52, 211, 153, 0.4)'
                                  : '0 0 8px rgba(248, 113, 113, 0.4)',
                              }} />
                              {hasMultipleLots && (
                                <div style={{ color: 'var(--text-muted)', width: '16px' }}>
                                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </div>
                              )}
                              <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '12px',
                                background: 'linear-gradient(135deg, var(--bg-elevated), var(--bg-hover))',
                                border: '1px solid var(--border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 600,
                                fontSize: '14px',
                                color: 'var(--text-primary)'
                              }}>
                                {position.symbol.slice(0, 2)}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {position.symbol}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {position.chain ? (
                                    <>
                                      <span style={{
                                        fontSize: '10px', padding: '1px 5px', borderRadius: '4px',
                                        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                                        textTransform: 'capitalize',
                                      }}>
                                        {position.chain}
                                      </span>
                                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px' }}>
                                        {position.contractAddress?.slice(0, 6)}...{position.contractAddress?.slice(-4)}
                                      </span>
                                    </>
                                  ) : hasMultipleLots
                                    ? `${buyExecutions.length} entries`
                                    : position.assetType}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>
                            {formatPrice(position.avgEntryPrice)}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            <div style={{ fontFamily: "'DM Mono', monospace", color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                              {currentPrice ? formatPrice(currentPrice) : '—'}
                            </div>
                            {priceChange !== undefined && (
                              <div style={{
                                fontSize: '12px',
                                color: priceChange >= 0 ? 'var(--profit)' : 'var(--loss)'
                              }}>
                                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                              </div>
                            )}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>
                            {formatQuantity(position.remainingQuantity)}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace", fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(value)}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            <PnlDisplay pnl={pnl} pnlPercent={pnlPercent} />
                          </td>
                        </tr>
                        {/* Expanded execution details */}
                        {isExpanded && buyExecutions.map((exec, execIdx) => {
                          const execPnl = currentPrice
                            ? (currentPrice - exec.price) * exec.quantity
                            : null;
                          const execPnlPercent = currentPrice
                            ? ((currentPrice - exec.price) / exec.price) * 100
                            : null;
                          const execValue = currentPrice
                            ? currentPrice * exec.quantity
                            : exec.price * exec.quantity;
                          const isLast = execIdx === buyExecutions.length - 1;

                          return (
                            <tr
                              key={exec.id}
                              style={{
                                borderBottom: isLast ? '1px solid var(--border)' : 'none',
                                background: 'var(--bg-tertiary)',
                                animation: `slideUp 0.25s ease-out ${execIdx * 0.03}s both`,
                              }}
                            >
                              <td style={{ ...tdStyle, paddingLeft: '72px' }}>
                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                  Entry {execIdx + 1}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  {new Date(exec.executedAt).toLocaleDateString()}
                                </div>
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: '13px', color: 'var(--text-secondary)' }}>
                                {formatPrice(exec.price)}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'right' }}>
                                {/* Empty for entries */}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: '13px', color: 'var(--text-secondary)' }}>
                                {formatQuantity(exec.quantity)}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: '13px', color: 'var(--text-secondary)' }}>
                                {formatCurrency(execValue)}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'right' }}>
                                <PnlDisplay pnl={execPnl} pnlPercent={execPnlPercent} size="sm" />
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
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
      <p style={{
        color: 'var(--text-muted)',
        fontSize: '12px',
        marginBottom: '12px',
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
        fontWeight: 600,
      }}>{label}</p>
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
