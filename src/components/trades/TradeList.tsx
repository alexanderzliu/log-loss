import { useState } from 'react';
import type { Trade } from '../../types';
import { useStore } from '../../store/useStore';
import { formatCurrency, formatPercent, formatQuantity, formatDate } from '../../utils/format';
import {
  ArrowUpRight,
  ArrowDownRight,
  MoreVertical,
  Edit2,
  Trash2,
  X,
  Bitcoin,
  TrendingUp,
} from 'lucide-react';

interface TradeListProps {
  trades: Trade[];
  onEdit: (trade: Trade) => void;
  onClosePosition: (trade: Trade) => void;
}

export default function TradeList({ trades, onEdit, onClosePosition }: TradeListProps) {
  const { deleteTrade, prices } = useStore();
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    await deleteTrade(id);
    setDeleteConfirm(null);
    setMenuOpen(null);
  };

  if (trades.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <TrendingUp className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No trades yet</h3>
        <p className="text-gray-500">Click "New Trade" to record your first trade.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Asset</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Side</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Date</th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Entry Price</th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Quantity</th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Value</th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">P&L</th>
            <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">Status</th>
            <th className="px-4 py-3 text-sm font-medium text-gray-500"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {trades.map((trade) => {
            const priceKey = `${trade.symbol}-${trade.assetType}`;
            const currentPrice = prices[priceKey]?.price;
            const isOpen = trade.status === 'open' && trade.side === 'buy';

            // Calculate unrealized P&L for open positions
            let displayPnl = trade.pnl;
            let displayPnlPercent = trade.pnlPercent;

            if (isOpen && currentPrice) {
              displayPnl = (currentPrice - trade.entryPrice) * trade.quantity;
              displayPnlPercent = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
            }

            const value = trade.entryPrice * trade.quantity;

            return (
              <tr key={trade.id} className="hover:bg-gray-50">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        trade.assetType === 'crypto' ? 'bg-orange-100' : 'bg-blue-100'
                      }`}
                    >
                      {trade.assetType === 'crypto' ? (
                        <Bitcoin size={16} className="text-orange-600" />
                      ) : (
                        <TrendingUp size={16} className="text-blue-600" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{trade.symbol}</div>
                      <div className="text-xs text-gray-500 capitalize">{trade.assetType}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${
                      trade.side === 'buy'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {trade.side === 'buy' ? (
                      <ArrowUpRight size={14} />
                    ) : (
                      <ArrowDownRight size={14} />
                    )}
                    {trade.side.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-4 text-sm text-gray-600">{formatDate(trade.entryDate)}</td>
                <td className="px-4 py-4 text-sm text-gray-900 text-right font-mono">
                  {formatCurrency(trade.entryPrice)}
                </td>
                <td className="px-4 py-4 text-sm text-gray-900 text-right font-mono">
                  {formatQuantity(trade.quantity)}
                </td>
                <td className="px-4 py-4 text-sm text-gray-900 text-right font-mono">
                  {formatCurrency(value)}
                </td>
                <td className="px-4 py-4 text-right">
                  {displayPnl !== null ? (
                    <div>
                      <div
                        className={`font-medium font-mono ${
                          displayPnl >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(displayPnl)}
                      </div>
                      {displayPnlPercent !== null && (
                        <div
                          className={`text-xs ${
                            displayPnlPercent >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {formatPercent(displayPnlPercent)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-center">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      trade.status === 'open'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {trade.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === trade.id ? null : trade.id)}
                      className="p-1 rounded hover:bg-gray-100"
                    >
                      <MoreVertical size={16} className="text-gray-400" />
                    </button>

                    {menuOpen === trade.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setMenuOpen(null)}
                        />
                        <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20 py-1">
                          <button
                            onClick={() => {
                              onEdit(trade);
                              setMenuOpen(null);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Edit2 size={14} />
                            Edit Trade
                          </button>
                          {isOpen && (
                            <button
                              onClick={() => {
                                onClosePosition(trade);
                                setMenuOpen(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <X size={14} />
                              Close Position
                            </button>
                          )}
                          <hr className="my-1" />
                          <button
                            onClick={() => {
                              setDeleteConfirm(trade.id);
                              setMenuOpen(null);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={14} />
                            Delete Trade
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Trade?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this trade? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
