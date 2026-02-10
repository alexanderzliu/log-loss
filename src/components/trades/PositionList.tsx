import { Fragment, useState } from 'react';
import type { Position } from '../../types';
import { useStore } from '../../store/useStore';
import { formatCurrency, formatPrice, formatQuantity, formatDate } from '../../utils/format';
import PnlDisplay from '../PnlDisplay';
import { priceKey as getPriceKey } from '../../utils/priceKey';
import { calculateUnrealizedPnl } from '../../utils/aggregatePositions';
import { tableHeaderStyle, tableCellStyle } from '../../utils/styles';
import { useSetToggle } from '../../hooks/useSetToggle';
import ConfirmDialog from '../ConfirmDialog';
import DropdownMenu from '../DropdownMenu';
import { menuItemStyle } from '../../utils/menuStyles';
import {
  Edit2,
  Trash2,
  X,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface PositionListProps {
  positions: Position[];
  onEdit: (position: Position) => void;
  onClosePosition: (position: Position) => void;
}

export default function PositionList({ positions, onEdit, onClosePosition }: PositionListProps) {
  const { deletePosition, prices } = useStore();
  const [expandedPositions, toggleExpanded] = useSetToggle();
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    await deletePosition(id);
    setDeleteConfirm(null);
    setMenuOpen(null);
  };

  if (positions.length === 0) {
    return (
      <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>No positions yet</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Click "New Trade" to open your first position
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={thStyle}>Asset</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Avg Entry</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Quantity</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Cost Basis</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>P&L</th>
            <th style={{ ...thStyle, width: '40px' }}></th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position, posIdx) => {
            const isExpanded = expandedPositions.has(position.id);
            const isOpen = position.status === 'open';
            const pk = getPriceKey(position);
            const currentPrice = prices[pk]?.price;

            let displayPnl: number | null = position.realizedPnl;
            let displayPnlPercent: number | null = position.realizedPnlPercent;

            if (isOpen) {
              const { pnl, pnlPercent } = calculateUnrealizedPnl(position, currentPrice);
              if (pnl !== null) {
                displayPnl = pnl;
                displayPnlPercent = pnlPercent;
              }
            }

            const costBasis = position.avgEntryPrice * (isOpen ? position.remainingQuantity : position.totalQuantity);

            return (
              <Fragment key={position.id}>
                {/* Position row */}
                <tr
                  style={{
                    borderBottom: isExpanded ? 'none' : '1px solid var(--border)',
                    cursor: 'pointer',
                    animation: `slideUp 0.35s ease-out ${posIdx * 0.04}s both`,
                  }}
                  onClick={() => toggleExpanded(position.id)}
                >
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ color: 'var(--text-muted)', width: '16px' }}>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </div>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                            {position.symbol}
                          </span>
                          {position.chain && (
                            <span style={{
                              fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
                              background: 'var(--bg-elevated)', color: 'var(--text-muted)',
                              border: '1px solid var(--border)', textTransform: 'capitalize',
                            }}>
                              {position.chain}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          {position.contractAddress
                            ? `${position.contractAddress.slice(0, 6)}...${position.contractAddress.slice(-4)}`
                            : position.assetType
                          } · {position.executions.length} execution{position.executions.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span className={`badge ${isOpen ? 'badge-profit' : 'badge-neutral'}`}>
                      {position.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                    {formatPrice(position.avgEntryPrice)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>
                    {isOpen
                      ? formatQuantity(position.remainingQuantity)
                      : formatQuantity(position.totalQuantity)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>
                    {formatCurrency(costBasis)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <PnlDisplay
                      pnl={displayPnl !== null && displayPnl !== 0 ? displayPnl : null}
                      pnlPercent={displayPnlPercent}
                    />
                  </td>
                  <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu
                      isOpen={menuOpen === position.id}
                      onToggle={() => setMenuOpen(menuOpen === position.id ? null : position.id)}
                      onClose={() => setMenuOpen(null)}
                    >
                      <button
                        onClick={() => { onEdit(position); setMenuOpen(null); }}
                        style={menuItemStyle}
                      >
                        <Edit2 size={14} /> Edit
                      </button>
                      {isOpen && (
                        <button
                          onClick={() => { onClosePosition(position); setMenuOpen(null); }}
                          style={menuItemStyle}
                        >
                          <X size={14} /> Close Position
                        </button>
                      )}
                      <button
                        onClick={() => { setDeleteConfirm(position.id); setMenuOpen(null); }}
                        style={{ ...menuItemStyle, color: 'var(--loss)' }}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </DropdownMenu>
                  </td>
                </tr>

                {/* Expanded executions */}
                {isExpanded && position.executions.map((exec, execIdx) => {
                  const isLast = execIdx === position.executions.length - 1;
                  const value = exec.price * exec.quantity;

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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span className={`badge ${exec.side === 'buy' ? 'badge-profit' : 'badge-loss'}`}>
                            {exec.side === 'buy' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                            {exec.side.toUpperCase()}
                          </span>
                          <div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                              {formatPrice(exec.price)} × {formatQuantity(exec.quantity)}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {formatDate(exec.executedAt)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span className={`badge ${exec.side === 'buy' ? 'badge-profit' : 'badge-loss'}`} style={{ fontSize: '11px' }}>
                          {exec.side.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {formatPrice(exec.price)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {formatQuantity(exec.quantity)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {formatCurrency(value)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <PnlDisplay pnl={exec.pnl} pnlPercent={exec.pnlPercent} size="sm" />
                      </td>
                      <td style={tdStyle}></td>
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {deleteConfirm && (
        <ConfirmDialog
          title="Delete Position?"
          message="This will delete the position and all its executions. This action cannot be undone."
          onConfirm={() => handleDelete(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}

const thStyle = { ...tableHeaderStyle, padding: '18px 24px' };
const tdStyle = { ...tableCellStyle, padding: '16px 24px' };
