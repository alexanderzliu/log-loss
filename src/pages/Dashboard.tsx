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

  const stagger = (index: number) => ({
    animation: `slideUp 0.4s ease-out ${index * 0.06}s both`,
  });

  return (
    <PageTransition>
      <div style={{ maxWidth: '1200px' }}>
        {/* Portfolio Value Header */}
        <div style={{
          marginBottom: '56px',
          padding: '32px',
          borderRadius: '24px',
          background: 'var(--gradient-card)',
          border: '1px solid var(--border)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Atmospheric glow */}
          <div style={{
            position: 'absolute',
            top: '-40px',
            right: '-40px',
            width: '200px',
            height: '200px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Total Portfolio Value
          </p>
          <h1 style={{
            fontSize: '56px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            fontFamily: "'DM Mono', monospace",
            letterSpacing: '-3px',
            marginBottom: '12px',
            fontVariantNumeric: 'tabular-nums',
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
              background: totalPnl >= 0 ? 'rgba(52, 211, 153, 0.1)' : 'rgba(248, 113, 113, 0.1)',
              border: `1px solid ${totalPnl >= 0 ? 'rgba(52, 211, 153, 0.2)' : 'rgba(248, 113, 113, 0.2)'}`,
            }}>
              {totalPnl >= 0 ? (
                <ArrowUpRight size={18} style={{ color: 'var(--profit)' }} />
              ) : (
                <ArrowDownRight size={18} style={{ color: 'var(--loss)' }} />
              )}
              <span style={{
                color: totalPnl >= 0 ? 'var(--profit)' : 'var(--loss)',
                fontSize: '15px',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {animatedTotalPnl >= 0 ? '+' : ''}{formatCurrency(animatedTotalPnl)} ({formatPercent(totalPnlPercent)})
              </span>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>All time</span>
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
            style={stagger(1)}
          />
          {(() => {
            const realizedPnl = (portfolioSummary?.realizedPnl || 0) + predictionsPnl;
            return (
              <StatCard
                label="Realized P&L"
                numericValue={realizedPnl}
                positive={realizedPnl >= 0}
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
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              Open Positions
              {openPositions.length > 0 && (
                <span style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--profit)',
                  animation: 'pulse-dot 2s ease-in-out infinite',
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
              <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>No open positions</p>
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

                    return (
                      <Fragment key={positionKey}>
                        <tr
                          style={{
                            borderBottom: isExpanded ? 'none' : '1px solid var(--border)',
                            cursor: hasMultipleLots ? 'pointer' : 'default',
                            animation: `slideUp 0.35s ease-out ${idx * 0.04}s both`,
                          }}
                          onClick={() => hasMultipleLots && toggleExpanded(positionKey)}
                        >
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                                <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
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
                            {pnl !== null ? (
                              <div>
                                <div style={{
                                  fontFamily: "'DM Mono', monospace",
                                  fontWeight: 500,
                                  color: pnl >= 0 ? 'var(--profit)' : 'var(--loss)',
                                  fontVariantNumeric: 'tabular-nums',
                                }}>
                                  {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                                </div>
                                <div style={{
                                  fontSize: '12px',
                                  color: pnl >= 0 ? 'var(--profit)' : 'var(--loss)'
                                }}>
                                  {pnlPercent !== null && (pnlPercent >= 0 ? '+' : '')}{pnlPercent?.toFixed(2)}%
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
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
                                {execPnl !== null ? (
                                  <div>
                                    <div style={{
                                      fontFamily: "'DM Mono', monospace",
                                      fontSize: '13px',
                                      color: execPnl >= 0 ? 'var(--profit)' : 'var(--loss)'
                                    }}>
                                      {execPnl >= 0 ? '+' : ''}{formatCurrency(execPnl)}
                                    </div>
                                    <div style={{
                                      fontSize: '11px',
                                      color: execPnl >= 0 ? 'var(--profit)' : 'var(--loss)'
                                    }}>
                                      {execPnlPercent !== null && (execPnlPercent >= 0 ? '+' : '')}{execPnlPercent?.toFixed(2)}%
                                    </div>
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                                )}
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

  return (
    <div className={`card ${gradientClass}`} style={{
      padding: '28px',
      position: 'relative',
      overflow: 'hidden',
      ...style,
    }}>
      {/* Left-side stripe */}
      {positive !== undefined && (
        <div style={{
          position: 'absolute',
          top: '16px',
          left: 0,
          bottom: '16px',
          width: '3px',
          borderRadius: '0 3px 3px 0',
          background: positive
            ? 'var(--profit)'
            : 'var(--loss)',
        }} />
      )}
      <p style={{
        color: 'var(--text-muted)',
        fontSize: '12px',
        marginBottom: '12px',
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
        fontWeight: 500
      }}>{label}</p>
      <p style={{
        fontSize: '28px',
        fontWeight: 600,
        color: valueColor,
        fontFamily: "'DM Mono', monospace",
        letterSpacing: '-1px',
        fontVariantNumeric: 'tabular-nums',
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
