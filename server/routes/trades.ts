import { Router } from 'express';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';
import type { Trade } from '../../src/types';

const router = Router();

// Helper to convert DB row to Trade object
function rowToTrade(row: Record<string, unknown>): Trade {
  return {
    id: row.id as string,
    assetType: row.asset_type as Trade['assetType'],
    symbol: row.symbol as string,
    side: row.side as Trade['side'],
    entryDate: row.entry_date as string,
    entryPrice: row.entry_price as number,
    quantity: row.quantity as number,
    remainingQuantity: row.remaining_quantity as number | null,
    stopLoss: row.stop_loss as number | null,
    takeProfit: row.take_profit as number | null,
    hypothesis: row.hypothesis as string,
    status: row.status as Trade['status'],
    exitDate: row.exit_date as string | null,
    exitPrice: row.exit_price as number | null,
    pnl: row.pnl as number | null,
    pnlPercent: row.pnl_percent as number | null,
    notes: row.notes as string,
    linkedTradeId: row.linked_trade_id as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// Get all trades
router.get('/', (req, res) => {
  try {
    const { status, assetType, symbol } = req.query;

    let query = 'SELECT * FROM trades WHERE 1=1';
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

    query += ' ORDER BY entry_date DESC, created_at DESC';

    const rows = db.prepare(query).all(...params) as Record<string, unknown>[];
    const trades = rows.map(rowToTrade);
    res.json(trades);
  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

// Get portfolio summary (must be before /:id to avoid matching "stats" as an id)
router.get('/stats/summary', (req, res) => {
  try {
    const openPositions = db.prepare("SELECT COUNT(*) as count FROM trades WHERE status = 'open' AND side = 'buy'").get() as { count: number };
    const closedPositions = db.prepare("SELECT COUNT(*) as count FROM trades WHERE status = 'closed' AND side = 'buy'").get() as { count: number };
    const totalTrades = db.prepare('SELECT COUNT(*) as count FROM trades').get() as { count: number };

    const pnlStats = db.prepare(`
      SELECT
        COALESCE(SUM(pnl), 0) as total_pnl,
        COUNT(CASE WHEN pnl > 0 THEN 1 END) as wins,
        COUNT(CASE WHEN pnl < 0 THEN 1 END) as losses
      FROM trades
      WHERE status = 'closed' AND pnl IS NOT NULL
    `).get() as { total_pnl: number; wins: number; losses: number };

    // Cost basis of currently open positions (using remaining_quantity for partial exits)
    const openPositionsCost = db.prepare(`
      SELECT COALESCE(SUM(entry_price * COALESCE(remaining_quantity, quantity)), 0) as total
      FROM trades
      WHERE side = 'buy' AND status = 'open'
    `).get() as { total: number };

    // Cost basis of closed positions (for accurate P&L percentage)
    const closedPositionsCost = db.prepare(`
      SELECT COALESCE(SUM(entry_price * quantity), 0) as total
      FROM trades
      WHERE side = 'buy' AND status = 'closed'
    `).get() as { total: number };

    const winRate = pnlStats.wins + pnlStats.losses > 0
      ? (pnlStats.wins / (pnlStats.wins + pnlStats.losses)) * 100
      : 0;

    // Calculate realized P&L percentage based on closed positions cost basis
    const realizedPnlPercent = closedPositionsCost.total > 0
      ? (pnlStats.total_pnl / closedPositionsCost.total) * 100
      : 0;

    res.json({
      openPositionsCost: openPositionsCost.total,
      realizedPnl: pnlStats.total_pnl,
      realizedPnlPercent,
      openPositions: openPositions.count,
      closedPositions: closedPositions.count,
      winRate,
      totalTrades: totalTrades.count,
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// Get single trade
router.get('/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM trades WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!row) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    res.json(rowToTrade(row));
  } catch (error) {
    console.error('Error fetching trade:', error);
    res.status(500).json({ error: 'Failed to fetch trade' });
  }
});

// Create trade
router.post('/', (req, res) => {
  try {
    const {
      assetType,
      symbol,
      side,
      entryDate,
      entryPrice,
      quantity,
      stopLoss,
      takeProfit,
      hypothesis,
      notes,
      linkedTradeId,
    } = req.body;

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
    if (typeof entryPrice !== 'number' || entryPrice <= 0) {
      return res.status(400).json({ error: 'Entry price must be a positive number' });
    }
    if (typeof quantity !== 'number' || quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number' });
    }
    if (!entryDate) {
      return res.status(400).json({ error: 'Entry date is required' });
    }

    const id = uuidv4();

    // Calculate P&L if this is a sell linked to a buy
    let pnl = null;
    let pnlPercent = null;
    let status = 'open';

    if (side === 'sell' && linkedTradeId) {
      const linkedTrade = db.prepare('SELECT * FROM trades WHERE id = ?').get(linkedTradeId) as Record<string, unknown> | undefined;
      if (linkedTrade) {
        const buyPrice = linkedTrade.entry_price as number;
        const buyRemainingQty = (linkedTrade.remaining_quantity as number) ?? (linkedTrade.quantity as number);
        const sellQuantity = Math.min(quantity, buyRemainingQty);

        pnl = (entryPrice - buyPrice) * sellQuantity;
        pnlPercent = buyPrice > 0 ? ((entryPrice - buyPrice) / buyPrice) * 100 : 0;
        status = 'closed';

        // Calculate new remaining quantity
        const newRemainingQty = buyRemainingQty - sellQuantity;

        // If full position closed, mark the buy as closed
        if (newRemainingQty <= 0) {
          db.prepare(`
            UPDATE trades
            SET status = 'closed', remaining_quantity = 0, exit_date = ?, exit_price = ?, pnl = ?, pnl_percent = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(entryDate, entryPrice, pnl, pnlPercent, linkedTradeId);
        } else {
          // Partial exit: update remaining quantity but keep open
          db.prepare(`
            UPDATE trades
            SET remaining_quantity = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(newRemainingQty, linkedTradeId);
        }
      }
    }

    // For buy trades, set remaining_quantity equal to quantity
    const remainingQuantity = side === 'buy' ? quantity : null;

    const stmt = db.prepare(`
      INSERT INTO trades (
        id, asset_type, symbol, side, entry_date, entry_price, quantity, remaining_quantity,
        stop_loss, take_profit, hypothesis, status, pnl, pnl_percent, notes, linked_trade_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      assetType,
      symbol.toUpperCase(),
      side,
      entryDate,
      entryPrice,
      quantity,
      remainingQuantity,
      stopLoss || null,
      takeProfit || null,
      hypothesis || '',
      status,
      pnl,
      pnlPercent,
      notes || '',
      linkedTradeId || null
    );

    const newTrade = db.prepare('SELECT * FROM trades WHERE id = ?').get(id) as Record<string, unknown>;

    // If we closed a position, also return the updated linked trade
    if (side === 'sell' && linkedTradeId) {
      const updatedLinkedTrade = db.prepare('SELECT * FROM trades WHERE id = ?').get(linkedTradeId) as Record<string, unknown>;
      return res.status(201).json({
        trade: rowToTrade(newTrade),
        linkedTrade: updatedLinkedTrade ? rowToTrade(updatedLinkedTrade) : null,
      });
    }

    res.status(201).json({ trade: rowToTrade(newTrade), linkedTrade: null });
  } catch (error) {
    console.error('Error creating trade:', error);
    res.status(500).json({ error: 'Failed to create trade' });
  }
});

// Update trade
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const {
      assetType,
      symbol,
      side,
      entryDate,
      entryPrice,
      quantity,
      stopLoss,
      takeProfit,
      hypothesis,
      status,
      exitDate,
      exitPrice,
      notes,
    } = req.body;

    // Recalculate P&L if closing
    let pnl = req.body.pnl;
    let pnlPercent = req.body.pnlPercent;

    if (status === 'closed' && exitPrice && side === 'buy') {
      pnl = (exitPrice - entryPrice) * quantity;
      pnlPercent = entryPrice > 0 ? ((exitPrice - entryPrice) / entryPrice) * 100 : 0;
    }

    const stmt = db.prepare(`
      UPDATE trades SET
        asset_type = ?, symbol = ?, side = ?, entry_date = ?, entry_price = ?,
        quantity = ?, stop_loss = ?, take_profit = ?, hypothesis = ?, status = ?,
        exit_date = ?, exit_price = ?, pnl = ?, pnl_percent = ?, notes = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `);

    const result = stmt.run(
      assetType,
      symbol.toUpperCase(),
      side,
      entryDate,
      entryPrice,
      quantity,
      stopLoss || null,
      takeProfit || null,
      hypothesis || '',
      status,
      exitDate || null,
      exitPrice || null,
      pnl,
      pnlPercent,
      notes || '',
      id
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    const updated = db.prepare('SELECT * FROM trades WHERE id = ?').get(id) as Record<string, unknown>;
    res.json(rowToTrade(updated));
  } catch (error) {
    console.error('Error updating trade:', error);
    res.status(500).json({ error: 'Failed to update trade' });
  }
});

// Delete trade
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    // First delete any trades that link to this one (e.g., sell trades linked to a buy)
    db.prepare('DELETE FROM trades WHERE linked_trade_id = ?').run(id);

    // Then delete the trade itself
    const result = db.prepare('DELETE FROM trades WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting trade:', error);
    res.status(500).json({ error: 'Failed to delete trade' });
  }
});

export default router;
