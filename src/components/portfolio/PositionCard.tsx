import { Bitcoin, ArrowUp, ArrowDown, LineChart, TrendingUp, TrendingDown } from 'lucide-react';
import type { Trade } from '../../types';
import { formatCurrency, formatPercent, formatQuantity, calculatePnl } from '../../utils/format';

interface PositionCardProps {
  trade: Trade;
  currentPrice?: number;
  priceChange?: number;
}

export default function PositionCard({ trade, currentPrice, priceChange }: PositionCardProps) {
  const invested = trade.entryPrice * trade.quantity;
  const { pnl: unrealizedPnl, pnlPercent: unrealizedPnlPercent } = calculatePnl(
    trade.entryPrice,
    currentPrice,
    trade.quantity
  );
  const currentValue = currentPrice ? currentPrice * trade.quantity : null;
  const isProfit = unrealizedPnl !== null && unrealizedPnl >= 0;

  const distanceToStop = trade.stopLoss
    ? ((trade.entryPrice - trade.stopLoss) / trade.entryPrice) * 100
    : null;
  const distanceToTarget = trade.takeProfit
    ? ((trade.takeProfit - trade.entryPrice) / trade.entryPrice) * 100
    : null;

  return (
    <div className="card card-hover p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-xl flex items-center justify-center ${
              trade.assetType === 'crypto'
                ? 'bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30'
                : 'bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/30'
            }`}
          >
            {trade.assetType === 'crypto' ? (
              <Bitcoin size={26} className="text-amber-400" />
            ) : (
              <LineChart size={26} className="text-blue-400" />
            )}
          </div>
          <div>
            <h3 className="text-xl font-semibold text-[hsl(var(--text-primary))]">{trade.symbol}</h3>
            <p className="text-sm text-[hsl(var(--text-muted))] font-mono uppercase tracking-wider">{trade.assetType}</p>
          </div>
        </div>
        {priceChange !== undefined && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
            priceChange >= 0
              ? 'bg-[hsla(150,85%,45%,0.1)] text-[hsl(var(--profit))]'
              : 'bg-[hsla(0,85%,55%,0.1)] text-[hsl(var(--loss))]'
          }`}>
            {priceChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span className="font-mono text-sm font-medium">
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
            </span>
            <span className="text-xs opacity-70">24h</span>
          </div>
        )}
      </div>

      {/* Price Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-[hsl(var(--bg-tertiary))]">
          <p className="text-xs text-[hsl(var(--text-muted))] mb-1">Entry Price</p>
          <p className="text-lg font-mono font-medium text-[hsl(var(--text-primary))]">
            {formatCurrency(trade.entryPrice)}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-[hsl(var(--bg-tertiary))]">
          <p className="text-xs text-[hsl(var(--text-muted))] mb-1">Current Price</p>
          {currentPrice ? (
            <p className={`text-lg font-mono font-medium ${isProfit ? 'text-[hsl(var(--profit))]' : 'text-[hsl(var(--loss))]'}`}>
              {formatCurrency(currentPrice)}
            </p>
          ) : (
            <div className="shimmer h-6 w-24 rounded mt-1"></div>
          )}
        </div>
        <div className="p-4 rounded-xl bg-[hsl(var(--bg-tertiary))]">
          <p className="text-xs text-[hsl(var(--text-muted))] mb-1">Quantity</p>
          <p className="text-lg font-mono font-medium text-[hsl(var(--text-primary))]">
            {formatQuantity(trade.quantity)}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-[hsl(var(--bg-tertiary))]">
          <p className="text-xs text-[hsl(var(--text-muted))] mb-1">Position Value</p>
          <p className="text-lg font-mono font-medium text-[hsl(var(--text-primary))]">
            {currentValue ? formatCurrency(currentValue) : formatCurrency(invested)}
          </p>
        </div>
      </div>

      {/* P&L Section */}
      <div className={`p-5 rounded-xl border ${
        isProfit
          ? 'bg-[hsla(150,85%,45%,0.05)] border-[hsla(150,85%,45%,0.2)]'
          : unrealizedPnl === null
            ? 'bg-[hsl(var(--bg-tertiary))] border-[hsl(var(--border-subtle))]'
            : 'bg-[hsla(0,85%,55%,0.05)] border-[hsla(0,85%,55%,0.2)]'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[hsl(var(--text-muted))] mb-1">Unrealized P&L</p>
            {unrealizedPnl !== null ? (
              <div className="flex items-baseline gap-3">
                <span className={`text-2xl font-semibold font-mono ${isProfit ? 'text-[hsl(var(--profit))]' : 'text-[hsl(var(--loss))]'}`}>
                  {isProfit ? '+' : ''}{formatCurrency(unrealizedPnl)}
                </span>
                <span className={`text-sm font-mono ${isProfit ? 'text-[hsl(var(--profit))]' : 'text-[hsl(var(--loss))]'}`}>
                  {formatPercent(unrealizedPnlPercent!)}
                </span>
              </div>
            ) : (
              <div className="shimmer h-8 w-32 rounded"></div>
            )}
          </div>
          {unrealizedPnl !== null && (
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              isProfit ? 'bg-[hsla(150,85%,45%,0.15)]' : 'bg-[hsla(0,85%,55%,0.15)]'
            }`}>
              {isProfit ? (
                <TrendingUp size={24} className="text-[hsl(var(--profit))]" />
              ) : (
                <TrendingDown size={24} className="text-[hsl(var(--loss))]" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stop Loss / Take Profit */}
      {(trade.stopLoss || trade.takeProfit) && (
        <div className="grid grid-cols-2 gap-4 mt-4">
          {trade.stopLoss && (
            <div className="p-3 rounded-xl bg-[hsla(0,85%,55%,0.05)] border border-[hsla(0,85%,55%,0.15)]">
              <div className="flex items-center gap-2 mb-2">
                <ArrowDown size={14} className="text-[hsl(var(--loss))]" />
                <span className="text-xs text-[hsl(var(--text-muted))]">Stop Loss</span>
              </div>
              <p className="font-mono text-sm text-[hsl(var(--text-secondary))]">{formatCurrency(trade.stopLoss)}</p>
              <p className="text-xs font-mono text-[hsl(var(--loss))]">-{distanceToStop?.toFixed(1)}%</p>
            </div>
          )}
          {trade.takeProfit && (
            <div className="p-3 rounded-xl bg-[hsla(150,85%,45%,0.05)] border border-[hsla(150,85%,45%,0.15)]">
              <div className="flex items-center gap-2 mb-2">
                <ArrowUp size={14} className="text-[hsl(var(--profit))]" />
                <span className="text-xs text-[hsl(var(--text-muted))]">Take Profit</span>
              </div>
              <p className="font-mono text-sm text-[hsl(var(--text-secondary))]">{formatCurrency(trade.takeProfit)}</p>
              <p className="text-xs font-mono text-[hsl(var(--profit))]">+{distanceToTarget?.toFixed(1)}%</p>
            </div>
          )}
        </div>
      )}

      {/* Thesis */}
      {trade.hypothesis && (
        <div className="mt-4 pt-4 border-t border-[hsl(var(--border-subtle))]">
          <p className="text-xs text-[hsl(var(--text-muted))] uppercase tracking-wider mb-2">Trade Thesis</p>
          <p className="text-sm text-[hsl(var(--text-secondary))] leading-relaxed">{trade.hypothesis}</p>
        </div>
      )}
    </div>
  );
}
