import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { TrendingUp, TrendingDown, DollarSign, Target, PieChart, Activity } from 'lucide-react';
import { formatCurrency, formatPercent } from '../utils/format';
import PositionCard from '../components/portfolio/PositionCard';

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

    // Refresh prices every 60 seconds
    const interval = setInterval(refreshPrices, 60000);
    return () => clearInterval(interval);
  }, [fetchTrades, fetchPortfolioSummary, refreshPrices]);

  const openPositions = trades.filter((t) => t.status === 'open' && t.side === 'buy');

  // Calculate unrealized P&L for open positions
  const unrealizedPnl = openPositions.reduce((total, trade) => {
    const priceKey = `${trade.symbol}-${trade.assetType}`;
    const currentPrice = prices[priceKey]?.price;
    if (currentPrice) {
      return total + (currentPrice - trade.entryPrice) * trade.quantity;
    }
    return total;
  }, 0);

  const totalInvested = openPositions.reduce(
    (total, trade) => total + trade.entryPrice * trade.quantity,
    0
  );

  const unrealizedPnlPercent = totalInvested > 0 ? (unrealizedPnl / totalInvested) * 100 : 0;

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Invested"
          value={formatCurrency(totalInvested)}
          icon={<DollarSign className="text-blue-600" />}
          subtitle={`${openPositions.length} open positions`}
        />
        <StatCard
          title="Unrealized P&L"
          value={formatCurrency(unrealizedPnl)}
          icon={
            unrealizedPnl >= 0 ? (
              <TrendingUp className="text-green-600" />
            ) : (
              <TrendingDown className="text-red-600" />
            )
          }
          subtitle={formatPercent(unrealizedPnlPercent)}
          positive={unrealizedPnl >= 0}
        />
        <StatCard
          title="Realized P&L"
          value={formatCurrency(portfolioSummary?.totalPnl || 0)}
          icon={
            (portfolioSummary?.totalPnl || 0) >= 0 ? (
              <TrendingUp className="text-green-600" />
            ) : (
              <TrendingDown className="text-red-600" />
            )
          }
          subtitle={`${portfolioSummary?.closedPositions || 0} closed trades`}
          positive={(portfolioSummary?.totalPnl || 0) >= 0}
        />
        <StatCard
          title="Win Rate"
          value={`${(portfolioSummary?.winRate || 0).toFixed(1)}%`}
          icon={<Target className="text-purple-600" />}
          subtitle={`${portfolioSummary?.totalTrades || 0} total trades`}
        />
      </div>

      {/* Open Positions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Open Positions</h2>
          <button
            onClick={refreshPrices}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Activity size={14} />
            Refresh Prices
          </button>
        </div>

        {tradesLoading ? (
          <div className="text-center py-12 text-gray-500">Loading positions...</div>
        ) : openPositions.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <PieChart className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No open positions</h3>
            <p className="text-gray-500">
              Add your first trade in the Journal to start tracking your portfolio.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {openPositions.map((trade) => (
              <PositionCard
                key={trade.id}
                trade={trade}
                currentPrice={prices[`${trade.symbol}-${trade.assetType}`]?.price}
                priceChange={prices[`${trade.symbol}-${trade.assetType}`]?.changePercent24h}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  subtitle,
  positive,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  subtitle: string;
  positive?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500">{title}</span>
        {icon}
      </div>
      <div
        className={`text-2xl font-bold ${
          positive !== undefined ? (positive ? 'text-green-600' : 'text-red-600') : 'text-gray-900'
        }`}
      >
        {value}
      </div>
      <div className="text-sm text-gray-500 mt-1">{subtitle}</div>
    </div>
  );
}
