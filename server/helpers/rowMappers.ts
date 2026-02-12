import type { Position, Execution, Reflection } from '../../shared/types.ts';

export function rowToPosition(row: Record<string, unknown>): Position {
  return {
    id: row.id as string,
    assetType: row.asset_type as Position['assetType'],
    symbol: row.symbol as string,
    direction: row.direction as Position['direction'],
    status: row.status as Position['status'],
    totalQuantity: row.total_quantity as number,
    remainingQuantity: row.remaining_quantity as number,
    avgEntryPrice: row.avg_entry_price as number,
    totalCostBasis: row.total_cost_basis as number,
    realizedPnl: row.realized_pnl as number,
    realizedPnlPercent: row.realized_pnl_percent as number | null,
    stopLoss: row.stop_loss as number | null,
    takeProfit: row.take_profit as number | null,
    hypothesis: row.hypothesis as string,
    chain: (row.chain as string) || null,
    contractAddress: (row.contract_address as string) || null,
    openedAt: row.opened_at as string,
    closedAt: row.closed_at as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    executions: [],
  };
}

export function rowToExecution(row: Record<string, unknown>): Execution {
  return {
    id: row.id as string,
    positionId: row.position_id as string,
    side: row.side as Execution['side'],
    price: row.price as number,
    quantity: row.quantity as number,
    executedAt: row.executed_at as string,
    pnl: row.pnl as number | null,
    pnlPercent: row.pnl_percent as number | null,
    notes: row.notes as string,
    createdAt: row.created_at as string,
  };
}

export function rowToReflection(row: Record<string, unknown>): Reflection {
  return {
    id: row.id as string,
    positionId: row.position_id as string,
    type: row.type as Reflection['type'],
    content: row.content as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    symbol: row.symbol as string | undefined,
    assetType: row.asset_type as string | undefined,
  };
}
