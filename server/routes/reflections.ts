import { Router } from 'express';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';
import type { InsightFeedItem } from '../../shared/types.ts';
import { rowToReflection } from '../helpers/rowMappers';

const router = Router();

// GET / - List all reflections with optional filters
router.get('/', (req, res) => {
  try {
    const { tradeId, type, search } = req.query;

    let query = `
      SELECT r.*, t.underlying, t.asset_type
      FROM reflections r
      JOIN trades t ON t.id = r.trade_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (tradeId) {
      query += ' AND r.trade_id = ?';
      params.push(tradeId);
    }
    if (type) {
      query += ' AND r.type = ?';
      params.push(type);
    }
    if (search) {
      query += ' AND r.content LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY r.created_at DESC';

    const rows = db.prepare(query).all(...params) as Record<string, unknown>[];
    res.json(rows.map(rowToReflection));
  } catch (error) {
    console.error('Error fetching reflections:', error);
    res.status(500).json({ error: 'Failed to fetch reflections' });
  }
});

// GET /feed - Unified insights feed merging theses and reflections
router.get('/feed', (req, res) => {
  try {
    const { search, type, underlying } = req.query;

    const thesisConditions: string[] = ["t.thesis IS NOT NULL AND t.thesis != ''"];
    const reflectionConditions: string[] = ['1=1'];
    const thesisParams: unknown[] = [];
    const reflectionParams: unknown[] = [];

    if (type) {
      if (type === 'hypothesis') {
        reflectionConditions.push('0');
      } else {
        thesisConditions.push('0');
        reflectionConditions.push('r.type = ?');
        reflectionParams.push(type);
      }
    }

    if (underlying) {
      thesisConditions.push('t.underlying = ?');
      thesisParams.push(underlying);
      reflectionConditions.push('t.underlying = ?');
      reflectionParams.push(underlying);
    }

    if (search) {
      thesisConditions.push('t.thesis LIKE ?');
      thesisParams.push(`%${search}%`);
      reflectionConditions.push('r.content LIKE ?');
      reflectionParams.push(`%${search}%`);
    }

    const query = `
      SELECT
        t.id as id,
        'hypothesis' as type,
        t.thesis as content,
        COALESCE(t.open_date, t.created_at) as date,
        t.id as trade_id,
        t.underlying,
        t.asset_type,
        t.strategy,
        t.status,
        t.realized_pnl
      FROM trades t
      WHERE ${thesisConditions.join(' AND ')}

      UNION ALL

      SELECT
        r.id as id,
        r.type as type,
        r.content as content,
        r.created_at as date,
        r.trade_id,
        t.underlying,
        t.asset_type,
        t.strategy,
        t.status,
        t.realized_pnl
      FROM reflections r
      JOIN trades t ON t.id = r.trade_id
      WHERE ${reflectionConditions.join(' AND ')}

      ORDER BY date DESC
    `;

    const params = [...thesisParams, ...reflectionParams];
    const rows = db.prepare(query).all(...params) as Record<string, unknown>[];

    const feed: InsightFeedItem[] = rows.map(row => ({
      id: row.id as string,
      type: row.type as InsightFeedItem['type'],
      content: row.content as string,
      date: row.date as string,
      tradeId: row.trade_id as string,
      underlying: row.underlying as string,
      assetType: row.asset_type as string,
      strategy: row.strategy as string,
      status: row.status as string,
      realizedPnl: (row.realized_pnl as number) || 0,
    }));

    res.json(feed);
  } catch (error) {
    console.error('Error fetching insights feed:', error);
    res.status(500).json({ error: 'Failed to fetch insights feed' });
  }
});

// POST / - Create reflection
router.post('/', (req, res) => {
  try {
    const { tradeId, type, content } = req.body;

    if (!tradeId || typeof tradeId !== 'string') {
      return res.status(400).json({ error: 'tradeId is required' });
    }
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'content is required' });
    }
    if (type && !['success', 'lesson', 'mistake'].includes(type)) {
      return res.status(400).json({ error: 'type must be "success", "lesson", or "mistake"' });
    }

    // Verify trade exists
    const trade = db.prepare('SELECT id FROM trades WHERE id = ?').get(tradeId);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    const id = uuidv4();

    db.prepare(`
      INSERT INTO reflections (id, trade_id, type, content)
      VALUES (?, ?, ?, ?)
    `).run(id, tradeId, type || 'success', content);

    const row = db.prepare(`
      SELECT r.*, t.underlying, t.asset_type
      FROM reflections r
      JOIN trades t ON t.id = r.trade_id
      WHERE r.id = ?
    `).get(id) as Record<string, unknown>;

    res.status(201).json(rowToReflection(row));
  } catch (error) {
    console.error('Error creating reflection:', error);
    res.status(500).json({ error: 'Failed to create reflection' });
  }
});

// PUT /:id - Update reflection
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { content, type } = req.body;

    const updates: string[] = [];
    const params: unknown[] = [];

    if (content !== undefined) {
      if (typeof content !== 'string' || !content) {
        return res.status(400).json({ error: 'content must be a non-empty string' });
      }
      updates.push('content = ?');
      params.push(content);
    }
    if (type !== undefined) {
      if (!['success', 'lesson', 'mistake'].includes(type)) {
        return res.status(400).json({ error: 'type must be "success", "lesson", or "mistake"' });
      }
      updates.push('type = ?');
      params.push(type);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push("updated_at = datetime('now')");
    params.push(id);

    const result = db.prepare(`UPDATE reflections SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Reflection not found' });
    }

    const row = db.prepare(`
      SELECT r.*, t.underlying, t.asset_type
      FROM reflections r
      JOIN trades t ON t.id = r.trade_id
      WHERE r.id = ?
    `).get(id) as Record<string, unknown>;

    res.json(rowToReflection(row));
  } catch (error) {
    console.error('Error updating reflection:', error);
    res.status(500).json({ error: 'Failed to update reflection' });
  }
});

// DELETE /:id - Delete reflection
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM reflections WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Reflection not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting reflection:', error);
    res.status(500).json({ error: 'Failed to delete reflection' });
  }
});

export default router;
