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
  }, [trades]);

  useEffect(() => {
    if (selectedSymbol && selectedAssetType) {
      loadPriceHistory();
    }
  }, [selectedSymbol, selectedAssetType, timeRange]);

  const loadPriceHistory = async () => {
    if (!selectedSymbol) return;
    setLoading(true);
    try {
      const data = await fetchPriceHistory(selectedSymbol, selectedAssetType, timeRange);
      setPriceHistory(data.history);
    } catch (error) {
      console.error('Failed to load price history:', error);
      setPriceHistory([]);
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Price Analytics</h1>
        <p className="text-gray-500 mt-1">Track asset performance and price history</p>
      </div>

      {/* Search Bar */}
      <div className="flex gap-4">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Enter symbol (e.g., BTC, AAPL)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={selectedAssetType}
            onChange={(e) => setSelectedAssetType(e.target.value as AssetType)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="crypto">Crypto</option>
            <option value="stock">Stock</option>
          </select>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Search size={18} />
            Search
          </button>
        </div>
      </div>

      {/* Tracked Assets */}
      {trackedAssets.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-2">Your Assets</h3>
          <div className="flex flex-wrap gap-2">
            {trackedAssets.map(({ symbol, assetType }) => {
              const price = prices[`${symbol}-${assetType}`];
              return (
                <button
                  key={`${symbol}-${assetType}`}
                  onClick={() => handleAssetClick(symbol, assetType)}
                  className={`px-3 py-2 rounded-lg border transition-colors ${
                    selectedSymbol === symbol && selectedAssetType === assetType
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{symbol}</span>
                    <span className="text-xs text-gray-400 uppercase">{assetType}</span>
                  </div>
                  {price && (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-sm">{formatCurrency(price.price)}</span>
                      <span
                        className={`text-xs ${
                          price.changePercent24h >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
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
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">{selectedSymbol}</h2>
                <span className="text-xs px-2 py-1 bg-gray-100 rounded uppercase">
                  {selectedAssetType}
                </span>
              </div>
              {currentPrice && (
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-2xl font-bold">{formatCurrency(currentPrice.price)}</span>
                  <span
                    className={`flex items-center gap-1 ${
                      currentPrice.changePercent24h >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
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
            <div className="flex gap-2">
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => setTimeRange(days)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    timeRange === days
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {days}D
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="h-80 flex items-center justify-center text-gray-500">
              Loading chart...
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(value as number), 'Price']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-500">
              No price data available
            </div>
          )}

          {/* Price Stats */}
          {currentPrice && (
            <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200">
              <div>
                <div className="text-sm text-gray-500">24h High</div>
                <div className="font-medium">{formatCurrency(currentPrice.high24h)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">24h Low</div>
                <div className="font-medium">{formatCurrency(currentPrice.low24h)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">24h Change</div>
                <div
                  className={`font-medium ${
                    currentPrice.change24h >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {formatCurrency(currentPrice.change24h)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">24h Volume</div>
                <div className="font-medium">
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
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Search className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Search for an asset</h3>
          <p className="text-gray-500">
            Enter a symbol above to view price data and charts.
          </p>
        </div>
      )}
    </div>
  );
}
