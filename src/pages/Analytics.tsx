import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { fetchPriceHistory } from '../api/prices';
import type { PriceHistory, AssetType } from '../types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { Search, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency, formatPercent } from '../utils/format';
import PageTransition from '../components/PageTransition';

export default function Analytics() {
  const { trades, prices, fetchPrices } = useStore();
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [selectedAssetType, setSelectedAssetType] = useState<AssetType>('crypto');
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [timeRange, setTimeRange] = useState<number>(30);

  // Get unique symbols from trades
  const trackedAssets = Array.from(
    new Map(
      trades
        .filter((t) => t.side === 'buy')
        .map((t) => [`${t.symbol}-${t.assetType}`, { symbol: t.symbol, assetType: t.assetType }])
    ).values()
  );

  useEffect(() => {
    // Fetch prices for all tracked assets
    if (trackedAssets.length > 0) {
      fetchPrices(trackedAssets);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, fetchPrices]);

  useEffect(() => {
    if (selectedSymbol && selectedAssetType) {
      loadPriceHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSymbol, selectedAssetType, timeRange]);

  const loadPriceHistory = async () => {
    if (!selectedSymbol) return;
    setLoading(true);
    try {
      const data = await fetchPriceHistory(selectedSymbol, selectedAssetType, timeRange);
      setPriceHistory(data.history);
    } catch (error) {
      console.error('Failed to load price history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (searchInput.trim()) {
      setSelectedSymbol(searchInput.toUpperCase());
      // Fetch current price
      fetchPrices([{ symbol: searchInput.toUpperCase(), assetType: selectedAssetType }]);
    }
  };

  const handleAssetClick = (symbol: string, assetType: AssetType) => {
    setSelectedSymbol(symbol);
    setSelectedAssetType(assetType);
    setSearchInput(symbol);
  };

  const currentPrice = prices[`${selectedSymbol}-${selectedAssetType}`];

  const chartData = priceHistory.map((p) => ({
    date: format(new Date(p.timestamp), 'MMM d'),
    price: p.price,
  }));

  return (
    <PageTransition>
    <div style={{ maxWidth: '1200px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
          Price Analytics
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
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
          placeholder="Enter symbol (e.g., BTC, AAPL)"
          style={{ flex: 1 }}
        />
        <select
          value={selectedAssetType}
          onChange={(e) => setSelectedAssetType(e.target.value as AssetType)}
        >
          <option value="crypto">Crypto</option>
          <option value="stock">Stock</option>
        </select>
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
            letterSpacing: '0.8px',
            marginBottom: '12px',
          }}>
            Your Assets
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {trackedAssets.map(({ symbol, assetType }) => {
              const price = prices[`${symbol}-${assetType}`];
              const isSelected = selectedSymbol === symbol && selectedAssetType === assetType;
              return (
                <button
                  key={`${symbol}-${assetType}`}
                  onClick={() => handleAssetClick(symbol, assetType)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: isSelected ? 'var(--accent-glow)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
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
                        {formatCurrency(price.price)}
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
                  borderRadius: '6px',
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
                    {formatCurrency(currentPrice.price)}
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
                    borderRadius: '8px',
                    border: timeRange === days ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: timeRange === days ? 'var(--accent-glow)' : 'transparent',
                    color: timeRange === days ? 'var(--accent)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: 500,
                    fontFamily: 'inherit',
                    transition: 'all 0.2s ease',
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
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(value as number), 'Price']}
                  contentStyle={{
                    borderRadius: '10px',
                    border: '1px solid var(--border-light)',
                    background: 'var(--dropdown-bg)',
                    backdropFilter: 'blur(12px)',
                    boxShadow: 'var(--dropdown-shadow)',
                    color: 'var(--text-primary)',
                  }}
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
          {currentPrice && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
              marginTop: '24px',
              paddingTop: '24px',
              borderTop: '1px solid var(--border)',
            }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  24h High
                </div>
                <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'DM Mono', monospace" }}>
                  {formatCurrency(currentPrice.high24h)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  24h Low
                </div>
                <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'DM Mono', monospace" }}>
                  {formatCurrency(currentPrice.low24h)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  24h Change
                </div>
                <div style={{
                  fontWeight: 500,
                  color: currentPrice.change24h >= 0 ? 'var(--profit)' : 'var(--loss)',
                  fontFamily: "'DM Mono', monospace",
                }}>
                  {currentPrice.change24h >= 0 ? '+' : ''}{formatCurrency(currentPrice.change24h)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  24h Volume
                </div>
                <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'DM Mono', monospace" }}>
                  ${currentPrice.volume24h?.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  }) || 'N/A'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!selectedSymbol && trackedAssets.length === 0 && (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <Search style={{ margin: '0 auto 16px', color: 'var(--text-muted)' }} size={48} />
          <h3 style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Search for an asset
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Enter a symbol above to view price data and charts.
          </p>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
