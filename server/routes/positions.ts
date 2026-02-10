import { Router } from 'express';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';
import type { Position, Execution } from '../../src/types';

const router = Router();

// Helper to convert DB row to Position object (without executions)
function rowToPosition(row: Record<string, unknown>): Position {
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
    notes: row.notes as string,
    openedAt: row.opened_at as string,
    closedAt: row.closed_at as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    executions: [],
  };
}

function rowToExecution(row: Record<string, unknown>): Execution {
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

function getPositionWithExecutions(id: string): Position | null {
  const row = db.prepare('SELECT * FROM positions WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;

  const position = rowToPosition(row);
  const execRows = db.prepare(
    'SELECT * FROM executions WHERE position_id = ? ORDER BY executed_at ASC, created_at ASC'
  ).all(id) as Record<string, unknown>[];
  position.executions = execRows.map(rowToExecution);
  return position;
}

// Recompute all derived fields on a position from its executions
function recomputePositionAggregates(positionId: string): void {
  const buyAgg = db.prepare(`
    SELECT
      COALESCE(SUM(quantity), 0) as total_buy_qty,
      COALESCE(SUM(price * quantity), 0) as total_cost_basis
    FROM executions
    WHERE position_id = ? AND side = 'buy'
  `).get(positionId) as { total_buy_qty: number; total_cost_basis: number };

  const sellAgg = db.prepare(`
    SELECT
      COALESCE(SUM(quantity), 0) as total_sell_qty,
      COALESCE(SUM(pnl), 0) as realized_pnl
    FROM executions
    WHERE position_id = ? AND side = 'sell'
  `).get(positionId) as { total_sell_qty: number; realized_pnl: number };

  const totalQuantity = buyAgg.total_buy_qty;
  const totalCostBasis = buyAgg.total_cost_basis;
  const avgEntryPrice = totalQuantity > 0 ? totalCostBasis / totalQuantity : 0;
  const remainingQuantity = totalQuantity - sellAgg.total_sell_qty;
  const realizedPnl = sellAgg.realized_pnl;
  const realizedPnlPercent = totalCostBasis > 0 ? (realizedPnl / totalCostBasis) * 100 : null;

  const status = remainingQuantity <= 0 ? 'closed' : 'open';
  const closedAt = status === 'closed'
    ? (db.prepare(`
        SELECT executed_at FROM executions
        WHERE position_id = ? AND side = 'sell'
        ORDER BY executed_at DESC LIMIT 1
      `).get(positionId) as { executed_at: string } | undefined)?.executed_at ?? null
    : null;

  db.prepare(`
    UPDATE positions SET
      total_quantity = ?, remaining_quantity = ?, avg_entry_price = ?,
      total_cost_basis = ?, realized_pnl = ?, realized_pnl_percent = ?,
      status = ?, closed_at = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    totalQuantity, remainingQuantity, avgEntryPrice,
    totalCostBasis, realizedPnl, realizedPnlPercent,
    status, closedAt, positionId
  );
}

// GET / - List all positions with executions
router.get('/', (req, res) => {
  try {
    const { status, assetType, symbol } = req.query;

    let query = 'SELECT * FROM positions WHERE 1=1';
    const params: unknown[] = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (assetType) {
      query += ' AND asset_type = ?';
      params.push(assetType);
    }
    if (symbol) {
      query += ' AND symbol = ?';
      params.push(symbol);
    }

    query += ' ORDER BY opened_at DESC, created_at DESC';

    const rows = db.prepare(query).all(...params) as Record<string, unknown>[];
    const positions = rows.map(rowToPosition);

    // Fetch executions for all positions
    const allExecRows = db.prepare(
      'SELECT * FROM executions ORDER BY executed_at ASC, created_at ASC'
    ).all() as Record<string, unknown>[];

    const execsByPosition = new Map<string, Execution[]>();
    for (const row of allExecRows) {
      const posId = row.position_id as string;
      if (!execsByPosition.has(posId)) execsByPosition.set(posId, []);
      execsByPosition.get(posId)!.push(rowToExecution(row));
    }

    for (const pos of positions) {
      pos.executions = execsByPosition.get(pos.id) ?? [];
    }

    res.json(positions);
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

// GET /stats/summary - Portfolio summary
router.get('/stats/summary', (_req, res) => {
  try {
    const openCount = db.prepare(
      "SELECT COUNT(*) as count FROM positions WHERE status = 'open'"
    ).get() as { count: number };

    const closedCount = db.prepare(
      "SELECT COUNT(*) as count FROM positions WHERE status = 'closed'"
    ).get() as { count: number };

    const totalExecutions = db.prepare(
      'SELECT COUNT(*) as count FROM executions'
    ).get() as { count: number };

    // Realized P&L from closed positions only (no double-counting)
    const pnlStats = db.prepare(`
      SELECT
        COALESCE(SUM(realized_pnl), 0) as total_pnl,
        COUNT(CASE WHEN realized_pnl > 0 THEN 1 END) as wins,
        COUNT(CASE WHEN realized_pnl < 0 THEN 1 END) as losses
      FROM positions
      WHERE status = 'closed'
    `).get() as { total_pnl: number; wins: number; losses: number };

    // Cost basis of open positions
    const openPositionsCost = db.prepare(`
      SELECT COALESCE(SUM(avg_entry_price * remaining_quantity), 0) as total
      FROM positions
      WHERE status = 'open'
    `).get() as { total: number };

    // Cost basis of closed positions for P&L percentage
    const closedPositionsCost = db.prepare(`
      SELECT COALESCE(SUM(total_cost_basis), 0) as total
      FROM positions
      WHERE status = 'closed'
    `).get() as { total: number };

    const winRate = pnlStats.wins + pnlStats.losses > 0
      ? (pnlStats.wins / (pnlStats.wins + pnlStats.losses)) * 100
      : 0;

    const realizedPnlPercent = closedPositionsCost.total > 0
      ? (pnlStats.total_pnl / closedPositionsCost.total) * 100
      : 0;

    const totalCostBasis = openPositionsCost.total + closedPositionsCost.total;

    res.json({
      openPositionsCost: openPositionsCost.total,
      realizedPnl: pnlStats.total_pnl,
      realizedPnlPercent,
      totalCostBasis,
      openPositions: openCount.count,
      closedPositions: closedCount.count,
      winRate,
      totalExecutions: totalExecutions.count,
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// GET /:id - Get single position with executions
router.get('/:id', (req, res) => {
  try {
    const position = getPositionWithExecutions(req.params.id);
    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }
    res.json(position);
  } catch (error) {
    console.error('Error fetching position:', error);
    res.status(500).json({ error: 'Failed to fetch position' });
  }
});

// POST / - Create trade (auto-joins existing position or creates new one)
router.post('/', (req, res) => {
  try {
    const { assetType, symbol, side, date, price, quantity, stopLoss, takeProfit, hypothesis, notes, positionId } = req.body;

    // Validate required fields
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    if (!assetType || !['crypto', 'stock'].includes(assetType)) {
      return res.status(400).json({ error: 'Asset type must be "crypto" or "stock"' });
    }
    if (!side || !['buy', 'sell'].includes(side)) {
      return res.status(400).json({ error: 'Side must be "buy" or "sell"' });
    }
    if (typeof price !== 'number' || price <= 0) {
      return res.status(400).json({ error: 'Price must be a positive number' });
    }
    if (typeof quantity !== 'number' || quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number' });
    }
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const upperSymbol = symbol.toUpperCase();
    const execId = uuidv4();

    const createTrade = db.transaction(() => {
      if (side === 'buy') {
        // Check for existing open position for this symbol
        const existingPosition = db.prepare(`
          SELECT id FROM positions
          WHERE symbol = ? AND asset_type = ? AND status = 'open'
        `).get(upperSymbol, assetType) as { id: string } | undefined;

        let posId: string;

        if (existingPosition) {
          // Scale into existing position
          posId = existingPosition.id;

          // Insert the buy execution
          db.prepare(`
            INSERT INTO executions (id, position_id, side, price, quantity, executed_at, notes)
            VALUES (?, ?, 'buy', ?, ?, ?, ?)
          `).run(execId, posId, price, quantity, date, notes || '');

          // Update position metadata if provided
          if (stopLoss !== undefined || takeProfit !== undefined || hypothesis !== undefined) {
            const updates: string[] = [];
            const updateParams: unknown[] = [];
            if (stopLoss !== undefined) { updates.push('stop_loss = ?'); updateParams.push(stopLoss || null); }
            if (takeProfit !== undefined) { updates.push('take_profit = ?'); updateParams.push(takeProfit || null); }
            if (hypothesis !== undefined) { updates.push('hypothesis = ?'); updateParams.push(hypothesis || ''); }
            if (updates.length > 0) {
              updates.push("updated_at = datetime('now')");
              db.prepare(`UPDATE positions SET ${updates.join(', ')} WHERE id = ?`).run(...updateParams, posId);
            }
          }

          // Recompute aggregates
          recomputePositionAggregates(posId);
        } else {
          // Create new position
          posId = uuidv4();

          db.prepare(`
            INSERT INTO positions (
              id, asset_type, symbol, direction, status,
              total_quantity, remaining_quantity, avg_entry_price, total_cost_basis,
              realized_pnl, realized_pnl_percent,
              stop_loss, take_profit, hypothesis, notes,
              opened_at
            ) VALUES (?, ?, ?, 'long', 'open', ?, ?, ?, ?, 0, NULL, ?, ?, ?, ?, ?)
          `).run(
            posId, assetType, upperSymbol,
            quantity, quantity, price, price * quantity,
            stopLoss || null, takeProfit || null,
            hypothesis || '', notes || '',
            date
          );

          // Insert the buy execution
          db.prepare(`
            INSERT INTO executions (id, position_id, side, price, quantity, executed_at, notes)
            VALUES (?, ?, 'buy', ?, ?, ?, ?)
          `).run(execId, posId, price, quantity, date, notes || '');
        }

        return posId;
      } else {
        // side === 'sell'
        if (!positionId) {
          throw new Error('positionId is required for sell orders');
        }

        const position = db.prepare('SELECT * FROM positions WHERE id = ?').get(positionId) as Record<string, unknown> | undefined;
        if (!position) {
          throw new Error('Position not found');
        }

        const remainingQty = position.remaining_quantity as number;
        if (remainingQty <= 0) {
          throw new Error('No remaining quantity to sell');
        }
        if (quantity > remainingQty) {
          throw new Error(`Sell quantity (${quantity}) exceeds remaining position quantity (${remainingQty})`);
        }

        const avgEntry = position.avg_entry_price as number;
        const pnl = (price - avgEntry) * quantity;
        const pnlPercent = avgEntry > 0 ? ((price - avgEntry) / avgEntry) * 100 : 0;

        // Insert sell execution
        db.prepare(`
          INSERT INTO executions (id, position_id, side, price, quantity, executed_at, pnl, pnl_percent, notes)
          VALUES (?, ?, 'sell', ?, ?, ?, ?, ?, ?)
        `).run(execId, positionId, price, quantity, date, pnl, pnlPercent, notes || '');

        // Recompute position aggregates (handles status change, P&L accumulation)
        recomputePositionAggregates(positionId);

        return positionId;
      }
    });

    const resultPositionId = createTrade();
    const position = getPositionWithExecutions(resultPositionId);

    res.status(201).json({ position });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create trade';
    console.error('Error creating trade:', error);
    if (message.includes('required') || message.includes('not found') || message.includes('No remaining') || message.includes('exceeds')) {
      return res.status(400).json({ error: message });
    }
    res.status(500).json({ error: 'Failed to create trade' });
  }
});

// POST /:id/executions - Add execution to existing position
router.post('/:id/executions', (req, res) => {
  try {
    const positionId = req.params.id;
    const { side, price, quantity, date, notes } = req.body;

    if (!side || !['buy', 'sell'].includes(side)) {
      return res.status(400).json({ error: 'Side must be "buy" or "sell"' });
    }
    if (typeof price !== 'number' || price <= 0) {
      return res.status(400).json({ error: 'Price must be a positive number' });
    }
    if (typeof quantity !== 'number' || quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number' });
    }
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const execId = uuidv4();

    const addExec = db.transaction(() => {
      const position = db.prepare('SELECT * FROM positions WHERE id = ?').get(positionId) as Record<string, unknown> | undefined;
      if (!position) {
        throw new Error('Position not found');
      }

      if (side === 'sell') {
        const remainingQty = position.remaining_quantity as number;
        if (remainingQty <= 0) {
          throw new Error('No remaining quantity to sell');
        }
        if (quantity > remainingQty) {
          throw new Error(`Sell quantity (${quantity}) exceeds remaining position quantity (${remainingQty})`);
        }

        const avgEntry = position.avg_entry_price as number;
        const pnl = (price - avgEntry) * quantity;
        const pnlPercent = avgEntry > 0 ? ((price - avgEntry) / avgEntry) * 100 : 0;

        db.prepare(`
          INSERT INTO executions (id, position_id, side, price, quantity, executed_at, pnl, pnl_percent, notes)
          VALUES (?, ?, 'sell', ?, ?, ?, ?, ?, ?)
        `).run(execId, positionId, price, quantity, date, pnl, pnlPercent, notes || '');
      } else {
        db.prepare(`
          INSERT INTO executions (id, position_id, side, price, quantity, executed_at, notes)
          VALUES (?, ?, 'buy', ?, ?, ?, ?)
        `).run(execId, positionId, price, quantity, date, notes || '');
      }

      recomputePositionAggregates(positionId);
    });

    addExec();

    const position = getPositionWithExecutions(positionId);
    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }

    const execution = position.executions.find(e => e.id === execId)!;
    res.status(201).json({ position, execution });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add execution';
    console.error('Error adding execution:', error);
    if (message.includes('not found') || message.includes('No remaining') || message.includes('exceeds')) {
      return res.status(400).json({ error: message });
    }
    res.status(500).json({ error: 'Failed to add execution' });
  }
});

// PUT /:id - Update position metadata
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { stopLoss, takeProfit, hypothesis, notes } = req.body;

    const result = db.prepare(`
      UPDATE positions SET
        stop_loss = ?, take_profit = ?, hypothesis = ?, notes = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      stopLoss ?? null,
      takeProfit ?? null,
      hypothesis ?? '',
      notes ?? '',
      id
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Position not found' });
    }

    const position = getPositionWithExecutions(id);
    res.json(position);
  } catch (error) {
    console.error('Error updating position:', error);
    res.status(500).json({ error: 'Failed to update position' });
  }
});

// DELETE /:id - Delete position (cascades to executions)
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM positions WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Position not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting position:', error);
    res.status(500).json({ error: 'Failed to delete position' });
  }
});

// DELETE /:posId/executions/:execId - Delete single execution
router.delete('/:posId/executions/:execId', (req, res) => {
  try {
    const { posId, execId } = req.params;

    const deleteExec = db.transaction(() => {
      const result = db.prepare('DELETE FROM executions WHERE id = ? AND position_id = ?').run(execId, posId);
      if (result.changes === 0) {
        throw new Error('Execution not found');
      }

      // Check if the position has any remaining executions
      const remainingExecs = db.prepare(
        'SELECT COUNT(*) as count FROM executions WHERE position_id = ?'
      ).get(posId) as { count: number };

      if (remainingExecs.count === 0) {
        // No more executions, delete the position
        db.prepare('DELETE FROM positions WHERE id = ?').run(posId);
        return null;
      }

      // Recompute aggregates
      recomputePositionAggregates(posId);
      return posId;
    });

    const resultPosId = deleteExec();

    if (resultPosId === null) {
      return res.json({ position: null });
    }

    const position = getPositionWithExecutions(resultPosId);
    res.json({ position });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete execution';
    console.error('Error deleting execution:', error);
    if (message.includes('not found')) {
      return res.status(404).json({ error: message });
    }
    res.status(500).json({ error: 'Failed to delete execution' });
  }
});

export default router;
