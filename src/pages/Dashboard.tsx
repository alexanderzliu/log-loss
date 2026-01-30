import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatCurrency, formatPercent, formatQuantity, calculatePnl } from '../utils/format';

export default function Dashboard() {
  const {
    trades,
    tradesLoading,
    prices,
    portfolioSummary,
    fetchTrades,
    fetchPortfolioSummary,
    refreshPrices,
  } = useStore();

  useEffect(() => {
    fetchTrades();
    fetchPortfolioSummary();
    const interval = setInterval(refreshPrices, 60000);
    return () => clearInterval(interval);
  }, [fetchTrades, fetchPortfolioSummary, refreshPrices]);

  const openPositions = trades.filter((t) => t.status === 'open' && t.side === 'buy');

  const unrealizedPnl = openPositions.reduce((total, trade) => {
    const priceKey = `${trade.symbol}-${trade.assetType}`;
    const currentPrice = prices[priceKey]?.price;
    const { pnl } = calculatePnl(trade.entryPrice, currentPrice, trade.quantity);
    return total + (pnl ?? 0);
  }, 0);

  const totalInvested = openPositions.reduce(
    (total, trade) => total + trade.entryPrice * trade.quantity,
    0
  );

  const unrealizedPnlPercent = totalInvested > 0 ? (unrealizedPnl / totalInvested) * 100 : 0;
  const totalPnl = (portfolioSummary?.realizedPnl || 0) + unrealizedPnl;

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Portfolio Value Header */}
      <div style={{ marginBottom: '56px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Total Portfolio Value
        </p>
        <h1 style={{
          fontSize: '56px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          fontFamily: "'DM Mono', monospace",
          letterSpacing: '-3px',
          marginBottom: '12px'
        }}>
          {formatCurrency(totalInvested + unrealizedPnl)}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            background: totalPnl >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          }}>
            {totalPnl >= 0 ? (
              <ArrowUpRight size={18} style={{ color: 'var(--profit)' }} />
            ) : (
              <ArrowDownRight size={18} style={{ color: 'var(--loss)' }} />
            )}
            <span style={{
              color: totalPnl >= 0 ? 'var(--profit)' : 'var(--loss)',
              fontSize: '15px',
              fontWeight: 600
            }}>
              {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)} ({formatPercent(unrealizedPnlPercent)})
            </span>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>All time</span>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '20px',
        marginBottom: '56px'
      }}>
        <StatCard label="Invested" value={formatCurrency(totalInvested)} />
        <StatCard
          label="Unrealized P&L"
          value={formatCurrency(unrealizedPnl)}
          subtext={formatPercent(unrealizedPnlPercent)}
          positive={unrealizedPnl >= 0}
        />
        <StatCard
          label="Realized P&L"
          value={formatCurrency(portfolioSummary?.realizedPnl || 0)}
          positive={(portfolioSummary?.realizedPnl || 0) >= 0}
        />
        <StatCard
          label="Win Rate"
          value={`${(portfolioSummary?.winRate || 0).toFixed(0)}%`}
          subtext={`${portfolioSummary?.totalTrades || 0} trades`}
        />
      </div>

      {/* Open Positions Table */}
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Open Positions
          </h2>
          <button onClick={refreshPrices} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        {tradesLoading ? (
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
                  <th style={{ ...thStyle, textAlign: 'right' }}>Price</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Quantity</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Value</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>P&L</th>
                </tr>
              </thead>
              <tbody>
                {openPositions.map((trade) => {
                  const priceKey = `${trade.symbol}-${trade.assetType}`;
                  const currentPrice = prices[priceKey]?.price;
                  const priceChange = prices[priceKey]?.changePercent24h;
                  const pnl = currentPrice ? (currentPrice - trade.entryPrice) * trade.quantity : null;
                  const pnlPercent = currentPrice ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100 : null;
                  const value = currentPrice ? currentPrice * trade.quantity : trade.entryPrice * trade.quantity;

                  return (
                    <tr key={trade.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: 'var(--bg-elevated)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 600,
                            fontSize: '14px',
                            color: 'var(--text-primary)'
                          }}>
                            {trade.symbol.slice(0, 2)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{trade.symbol}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                              {trade.assetType}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <div style={{ fontFamily: "'DM Mono', monospace", color: 'var(--text-primary)' }}>
                          {currentPrice ? formatCurrency(currentPrice) : '—'}
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
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                        {formatQuantity(trade.quantity)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>
                        {formatCurrency(value)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {pnl !== null ? (
                          <div>
                            <div style={{
                              fontFamily: "'DM Mono', monospace",
                              fontWeight: 500,
                              color: pnl >= 0 ? 'var(--profit)' : 'var(--loss)'
                            }}>
                              {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: pnl >= 0 ? 'var(--profit)' : 'var(--loss)'
                            }}>
                              {pnlPercent! >= 0 ? '+' : ''}{pnlPercent!.toFixed(2)}%
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
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
  );
}

const thStyle: React.CSSProperties = {
  padding: '18px 24px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
};

const tdStyle: React.CSSProperties = {
  padding: '20px 24px',
  color: 'var(--text-secondary)',
  fontSize: '14px',
};

function StatCard({
  label,
  value,
  subtext,
  positive
}: {
  label: string;
  value: string;
  subtext?: string;
  positive?: boolean;
}) {
  const valueColor = positive !== undefined
    ? (positive ? 'var(--profit)' : 'var(--loss)')
    : 'var(--text-primary)';

  return (
    <div className="card" style={{
      padding: '28px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle gradient accent for positive/negative */}
      {positive !== undefined && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: positive
            ? 'linear-gradient(90deg, var(--profit), transparent)'
            : 'linear-gradient(90deg, var(--loss), transparent)',
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
        letterSpacing: '-1px'
      }}>
        {value}
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
