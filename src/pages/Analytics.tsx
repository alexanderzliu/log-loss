import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { useShallow } from 'zustand/react/shallow';
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
import { formatPrice, formatPercent, formatCompactNumber, formatCompactCount } from '../utils/format';
import { priceKey as getPriceKey } from '../utils/priceKey';
import PageTransition from '../components/PageTransition';

export default function Analytics() {
  const { positions, prices, fetchPrices } = useStore(useShallow((s) => ({
    positions: s.positions,
    prices: s.prices,
    fetchPrices: s.fetchPrices,
  })));
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [selectedAssetType, setSelectedAssetType] = useState<AssetType>('crypto');
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [timeRange, setTimeRange] = useState<number>(30);

  // Get unique symbols from positions
  const trackedAssets = Array.from(
    new Map(
      positions.map((p) => [getPriceKey(p), { symbol: p.symbol, assetType: p.assetType, chain: p.chain, contractAddress: p.contractAddress }])
    ).values()
  );

  useEffect(() => {
    if (trackedAssets.length > 0) {
      fetchPrices(trackedAssets);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, fetchPrices]);

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
      fetchPrices([{ symbol: searchInput.toUpperCase(), assetType: selectedAssetType }]);
    }
  };

  const handleAssetClick = (symbol: string, assetType: AssetType) => {
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

  return (
    <PageTransition>
    <div style={{ maxWidth: '1200px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px', letterSpacing: '-0.5px' }}>
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
                  contentStyle={{
                    borderRadius: '12px',
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
                {currentPrice.marketCap ? (
                  <div>
                    <div style={labelStyle}>Market Cap</div>
                    <div style={valueStyle}>{formatCompactNumber(currentPrice.marketCap)}</div>
                  </div>
                ) : null}
                {currentPrice.fdv ? (
                  <div>
                    <div style={labelStyle}>FDV</div>
                    <div style={valueStyle}>{formatCompactNumber(currentPrice.fdv)}</div>
                  </div>
                ) : null}
                {currentPrice.liquidityUsd ? (
                  <div>
                    <div style={labelStyle}>Liquidity</div>
                    <div style={valueStyle}>{formatCompactNumber(currentPrice.liquidityUsd)}</div>
                  </div>
                ) : null}
                {currentPrice.txnCount24h ? (
                  <div>
                    <div style={labelStyle}>24h Txns</div>
                    <div style={valueStyle}>{formatCompactCount(currentPrice.txnCount24h)}</div>
                  </div>
                ) : null}
                {currentPrice.holderCount ? (
                  <div>
                    <div style={labelStyle}>Holders</div>
                    <div style={valueStyle}>{formatCompactCount(currentPrice.holderCount)}</div>
                  </div>
                ) : null}
              </div>
            );
          })()}
        </div>
      )}

      {/* Empty State */}
      {!selectedSymbol && trackedAssets.length === 0 && (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
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
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '320px', margin: '0 auto' }}>
            Enter a symbol above to view price data and charts.
          </p>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
