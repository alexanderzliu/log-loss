import { Bitcoin, TrendingUp, TrendingDown, ArrowUp } from 'lucide-react';
import type { Trade } from '../../types';
import { formatCurrency, formatPercent, formatQuantity } from '../../utils/format';

interface PositionCardProps {
  trade: Trade;
  currentPrice?: number;
  priceChange?: number;
}

export default function PositionCard({ trade, currentPrice, priceChange }: PositionCardProps) {
  const invested = trade.entryPrice * trade.quantity;

  // Calculate unrealized P&L
  const unrealizedPnl = currentPrice
    ? (currentPrice - trade.entryPrice) * trade.quantity
    : null;
  const unrealizedPnlPercent = currentPrice
    ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100
    : null;

  const currentValue = currentPrice ? currentPrice * trade.quantity : null;

  // Calculate distance to stop loss and take profit
  const distanceToStop = trade.stopLoss
    ? ((trade.entryPrice - trade.stopLoss) / trade.entryPrice) * 100
    : null;
  const distanceToTarget = trade.takeProfit
    ? ((trade.takeProfit - trade.entryPrice) / trade.entryPrice) * 100
    : null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              trade.assetType === 'crypto' ? 'bg-orange-100' : 'bg-blue-100'
            }`}
          >
            {trade.assetType === 'crypto' ? (
              <Bitcoin size={20} className="text-orange-600" />
            ) : (
              <TrendingUp size={20} className="text-blue-600" />
            )}
          </div>
          <div>
            <div className="font-semibold text-gray-900">{trade.symbol}</div>
            <div className="text-xs text-gray-500 capitalize">{trade.assetType}</div>
          </div>
        </div>
        {priceChange !== undefined && (
          <span
            className={`text-xs px-2 py-1 rounded ${
              priceChange >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {formatPercent(priceChange)} 24h
          </span>
        )}
      </div>

      {/* Price Info */}
      <div className="space-y-2 mb-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Entry Price</span>
          <span className="font-mono">{formatCurrency(trade.entryPrice)}</span>
        </div>
        {currentPrice && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Current Price</span>
            <span className="font-mono">{formatCurrency(currentPrice)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Quantity</span>
          <span className="font-mono">{formatQuantity(trade.quantity)}</span>
        </div>
      </div>

      {/* P&L */}
      <div className="pt-3 border-t border-gray-100">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-500">Unrealized P&L</span>
          {unrealizedPnl !== null ? (
            <div className="text-right">
              <div
                className={`font-semibold ${
                  unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {unrealizedPnl >= 0 ? '+' : ''}{formatCurrency(unrealizedPnl)}
              </div>
              <div
                className={`text-xs ${
                  unrealizedPnlPercent! >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatPercent(unrealizedPnlPercent!)}
              </div>
            </div>
          ) : (
            <span className="text-gray-400 text-sm">Loading...</span>
          )}
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Position Value</span>
          <span className="font-medium">
            {currentValue ? formatCurrency(currentValue) : formatCurrency(invested)}
          </span>
        </div>
      </div>

      {/* Stop Loss / Take Profit Indicators */}
      {(trade.stopLoss || trade.takeProfit) && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex gap-3">
          {trade.stopLoss && (
            <div className="flex-1 text-xs">
              <div className="text-gray-500 mb-1">Stop Loss</div>
              <div className="flex items-center gap-1">
                <TrendingDown size={12} className="text-red-500" />
                <span className="font-mono">{formatCurrency(trade.stopLoss)}</span>
                <span className="text-red-500">(-{distanceToStop?.toFixed(1)}%)</span>
              </div>
            </div>
          )}
          {trade.takeProfit && (
            <div className="flex-1 text-xs">
              <div className="text-gray-500 mb-1">Take Profit</div>
              <div className="flex items-center gap-1">
                <ArrowUp size={12} className="text-green-500" />
                <span className="font-mono">{formatCurrency(trade.takeProfit)}</span>
                <span className="text-green-500">(+{distanceToTarget?.toFixed(1)}%)</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hypothesis Preview */}
      {trade.hypothesis && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-500 mb-1">Thesis</div>
          <p className="text-sm text-gray-700 line-clamp-2">{trade.hypothesis}</p>
        </div>
      )}
    </div>
  );
}
