import { Router } from 'express';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';
import type { Prediction, PredictionsSummary } from '../../src/types';

const router = Router();

function rowToPrediction(row: Record<string, unknown>): Prediction {
  return {
    id: row.id as string,
    market: row.market as string,
    category: row.category as string,
    side: row.side as Prediction['side'],
    status: row.status as Prediction['status'],
    resolution: (row.resolution as 'yes' | 'no') || null,
    entryPrice: row.entry_price as number,
    exitPrice: row.exit_price as number | null,
    quantity: row.quantity as number,
    costBasis: row.cost_basis as number,
    pnl: row.pnl as number | null,
    pnlPercent: row.pnl_percent as number | null,
    hypothesis: row.hypothesis as string,
    notes: row.notes as string,
    expiresAt: (row.expires_at as string) || null,
    openedAt: row.opened_at as string,
    closedAt: row.closed_at as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function resolutionExitPrice(side: string, resolution: string): number {
  if (resolution === 'yes') return side === 'yes' ? 1.00 : 0.00;
  return side === 'yes' ? 0.00 : 1.00;
}

// GET / - List all predictions
router.get('/', (req, res) => {
  try {
    const { status } = req.query;

    let query = 'SELECT * FROM predictions WHERE 1=1';
    const params: unknown[] = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY opened_at DESC, created_at DESC';

    const rows = db.prepare(query).all(...params) as Record<string, unknown>[];
    res.json(rows.map(rowToPrediction));
  } catch (error) {
    console.error('Error fetching predictions:', error);
    res.status(500).json({ error: 'Failed to fetch predictions' });
  }
});

// GET /stats/summary - Predictions summary (must be before /:id)
router.get('/stats/summary', (_req, res) => {
  try {
    const openCount = db.prepare(
      "SELECT COUNT(*) as count FROM predictions WHERE status = 'open'"
    ).get() as { count: number };

    const closedCount = db.prepare(
      "SELECT COUNT(*) as count FROM predictions WHERE status = 'closed'"
    ).get() as { count: number };

    const pnlStats = db.prepare(`
      SELECT
        COALESCE(SUM(pnl), 0) as total_pnl,
        COALESCE(SUM(cost_basis), 0) as total_cost_basis,
        COUNT(CASE WHEN pnl > 0 THEN 1 END) as wins,
        COUNT(CASE WHEN pnl < 0 THEN 1 END) as losses
      FROM predictions
      WHERE status = 'closed'
    `).get() as { total_pnl: number; total_cost_basis: number; wins: number; losses: number };

    const openCost = db.prepare(
      "SELECT COALESCE(SUM(cost_basis), 0) as total FROM predictions WHERE status = 'open'"
    ).get() as { total: number };

    const winRate = pnlStats.wins + pnlStats.losses > 0
      ? (pnlStats.wins / (pnlStats.wins + pnlStats.losses)) * 100
      : 0;

    const summary: PredictionsSummary = {
      openPredictions: openCount.count,
      closedPredictions: closedCount.count,
      predictionsPnl: pnlStats.total_pnl,
      predictionsCostBasis: pnlStats.total_cost_basis,
      predictionsWinRate: winRate,
      openPredictionsCost: openCost.total,
    };

    res.json(summary);
  } catch (error) {
    console.error('Error fetching predictions summary:', error);
    res.status(500).json({ error: 'Failed to fetch predictions summary' });
  }
});

// GET /:id - Get single prediction
router.get('/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM predictions WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!row) {
      return res.status(404).json({ error: 'Prediction not found' });
    }
    res.json(rowToPrediction(row));
  } catch (error) {
    console.error('Error fetching prediction:', error);
    res.status(500).json({ error: 'Failed to fetch prediction' });
  }
});

// POST / - Create prediction
router.post('/', (req, res) => {
  try {
    const { market, category, side, entryPrice, quantity, date, expiresAt, hypothesis, notes } = req.body;

    if (!market || typeof market !== 'string') {
      return res.status(400).json({ error: 'Market question is required' });
    }
    if (!side || !['yes', 'no'].includes(side)) {
      return res.status(400).json({ error: 'Side must be "yes" or "no"' });
    }
    if (typeof entryPrice !== 'number' || entryPrice < 0.01 || entryPrice > 0.99) {
      return res.status(400).json({ error: 'Entry price must be between $0.01 and $0.99' });
    }
    if (typeof quantity !== 'number' || quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number' });
    }
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const id = uuidv4();
    const costBasis = entryPrice * quantity;

    db.prepare(`
      INSERT INTO predictions (
        id, market, category, side, status, entry_price, quantity, cost_basis,
        hypothesis, notes, expires_at, opened_at
      ) VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, market.trim(), category || '', side, entryPrice, quantity, costBasis,
      hypothesis || '', notes || '', expiresAt || null, date
    );

    const row = db.prepare('SELECT * FROM predictions WHERE id = ?').get(id) as Record<string, unknown>;
    res.status(201).json(rowToPrediction(row));
  } catch (error) {
    console.error('Error creating prediction:', error);
    res.status(500).json({ error: 'Failed to create prediction' });
  }
});

// PUT /:id - Update prediction metadata
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { market, category, hypothesis, notes } = req.body;

    const updates: string[] = [];
    const params: unknown[] = [];

    if (market !== undefined) { updates.push('market = ?'); params.push(market.trim()); }
    if (category !== undefined) { updates.push('category = ?'); params.push(category); }
    if (hypothesis !== undefined) { updates.push('hypothesis = ?'); params.push(hypothesis); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push("updated_at = datetime('now')");
    params.push(id);

    const result = db.prepare(
      `UPDATE predictions SET ${updates.join(', ')} WHERE id = ?`
    ).run(...params);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Prediction not found' });
    }

    const row = db.prepare('SELECT * FROM predictions WHERE id = ?').get(id) as Record<string, unknown>;
    res.json(rowToPrediction(row));
  } catch (error) {
    console.error('Error updating prediction:', error);
    res.status(500).json({ error: 'Failed to update prediction' });
  }
});

// POST /:id/close - Close or resolve a prediction
router.post('/:id/close', (req, res) => {
  try {
    const { id } = req.params;
    const { exitPrice, resolution, date, notes } = req.body;

    const row = db.prepare('SELECT * FROM predictions WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) {
      return res.status(404).json({ error: 'Prediction not found' });
    }

    if (row.status !== 'open') {
      return res.status(400).json({ error: 'Prediction is already closed' });
    }

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Determine exit price
    let finalExitPrice: number;
    let finalResolution: string | null = null;

    if (resolution !== undefined) {
      if (!['yes', 'no'].includes(resolution)) {
        return res.status(400).json({ error: 'Resolution must be "yes" or "no"' });
      }
      finalExitPrice = resolutionExitPrice(row.side as string, resolution);
      finalResolution = resolution;
    } else if (exitPrice !== undefined) {
      if (typeof exitPrice !== 'number' || exitPrice < 0 || exitPrice > 1) {
        return res.status(400).json({ error: 'Exit price must be between $0.00 and $1.00' });
      }
      finalExitPrice = exitPrice;
    } else {
      return res.status(400).json({ error: 'Either exitPrice or resolution is required' });
    }

    const entryPrice = row.entry_price as number;
    const quantity = row.quantity as number;
    const costBasis = row.cost_basis as number;
    const pnl = (finalExitPrice - entryPrice) * quantity;
    const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

    db.prepare(`
      UPDATE predictions SET
        status = 'closed', resolution = ?, exit_price = ?,
        pnl = ?, pnl_percent = ?, closed_at = ?,
        notes = CASE WHEN ? != '' THEN ? ELSE notes END,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      finalResolution, finalExitPrice,
      pnl, pnlPercent, date,
      notes || '', notes || '',
      id
    );

    const updated = db.prepare('SELECT * FROM predictions WHERE id = ?').get(id) as Record<string, unknown>;
    res.json(rowToPrediction(updated));
  } catch (error) {
    console.error('Error closing prediction:', error);
    res.status(500).json({ error: 'Failed to close prediction' });
  }
});

// DELETE /:id - Delete prediction
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM predictions WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Prediction not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting prediction:', error);
    res.status(500).json({ error: 'Failed to delete prediction' });
  }
});

export default router;
