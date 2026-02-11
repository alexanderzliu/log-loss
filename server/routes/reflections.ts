import { Router } from 'express';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';
import type { Reflection, InsightFeedItem } from '../../shared/types.ts';

const router = Router();

function rowToReflection(row: Record<string, unknown>): Reflection {
  const tags = (row.tags as string) || '';
  return {
    id: row.id as string,
    positionId: row.position_id as string,
    type: row.type as Reflection['type'],
    content: row.content as string,
    tags: tags ? tags.split(',').map(t => t.trim()) : [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    symbol: row.symbol as string | undefined,
    assetType: row.asset_type as string | undefined,
  };
}

// GET / - List all reflections with optional filters
router.get('/', (req, res) => {
  try {
    const { positionId, type, tag, search } = req.query;

    let query = `
      SELECT r.*, p.symbol, p.asset_type
      FROM reflections r
      JOIN positions p ON p.id = r.position_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (positionId) {
      query += ' AND r.position_id = ?';
      params.push(positionId);
    }
    if (type) {
      query += ' AND r.type = ?';
      params.push(type);
    }
    if (tag) {
      // Match comma-separated tags: exact match, starts with, ends with, or in middle
      query += " AND (',' || r.tags || ',') LIKE ('%,' || ? || ',%')";
      params.push(tag);
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

// GET /tags - Get all unique tags
router.get('/tags', (_req, res) => {
  try {
    const rows = db.prepare(
      "SELECT DISTINCT tags FROM reflections WHERE tags != ''"
    ).all() as { tags: string }[];

    const tagSet = new Set<string>();
    for (const row of rows) {
      for (const tag of row.tags.split(',')) {
        const trimmed = tag.trim();
        if (trimmed) tagSet.add(trimmed);
      }
    }

    res.json([...tagSet].sort());
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// GET /feed - Unified insights feed merging hypotheses and reflections
router.get('/feed', (req, res) => {
  try {
    const { search, type, symbol } = req.query;

    // Build WHERE clauses for each half of the UNION
    const hypothesisConditions: string[] = ["p.hypothesis != ''"];
    const reflectionConditions: string[] = ['1=1'];
    const hypothesisParams: unknown[] = [];
    const reflectionParams: unknown[] = [];

    if (type) {
      if (type === 'hypothesis') {
        // Only return hypotheses
        reflectionConditions.push('0'); // exclude reflections
      } else {
        // Only return reflections of this type
        hypothesisConditions.push('0'); // exclude hypotheses
        reflectionConditions.push('r.type = ?');
        reflectionParams.push(type);
      }
    }

    if (symbol) {
      hypothesisConditions.push('p.symbol = ?');
      hypothesisParams.push(symbol);
      reflectionConditions.push('p.symbol = ?');
      reflectionParams.push(symbol);
    }

    if (search) {
      hypothesisConditions.push('p.hypothesis LIKE ?');
      hypothesisParams.push(`%${search}%`);
      reflectionConditions.push('r.content LIKE ?');
      reflectionParams.push(`%${search}%`);
    }

    const query = `
      SELECT
        p.id as id,
        'hypothesis' as type,
        p.hypothesis as content,
        '' as tags,
        p.opened_at as date,
        p.id as position_id,
        p.symbol,
        p.asset_type,
        p.direction,
        p.status,
        p.realized_pnl,
        p.realized_pnl_percent
      FROM positions p
      WHERE ${hypothesisConditions.join(' AND ')}

      UNION ALL

      SELECT
        r.id as id,
        r.type as type,
        r.content as content,
        r.tags as tags,
        r.created_at as date,
        r.position_id,
        p.symbol,
        p.asset_type,
        p.direction,
        p.status,
        p.realized_pnl,
        p.realized_pnl_percent
      FROM reflections r
      JOIN positions p ON p.id = r.position_id
      WHERE ${reflectionConditions.join(' AND ')}

      ORDER BY date DESC
    `;

    const params = [...hypothesisParams, ...reflectionParams];
    const rows = db.prepare(query).all(...params) as Record<string, unknown>[];

    const feed: InsightFeedItem[] = rows.map(row => {
      const tags = (row.tags as string) || '';
      return {
        id: row.id as string,
        type: row.type as InsightFeedItem['type'],
        content: row.content as string,
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        date: row.date as string,
        positionId: row.position_id as string,
        symbol: row.symbol as string,
        assetType: row.asset_type as string,
        direction: row.direction as string,
        status: row.status as string,
        realizedPnl: row.realized_pnl as number,
        realizedPnlPercent: row.realized_pnl_percent as number | null,
      };
    });

    res.json(feed);
  } catch (error) {
    console.error('Error fetching insights feed:', error);
    res.status(500).json({ error: 'Failed to fetch insights feed' });
  }
});

// POST / - Create reflection
router.post('/', (req, res) => {
  try {
    const { positionId, type, content, tags } = req.body;

    if (!positionId || typeof positionId !== 'string') {
      return res.status(400).json({ error: 'positionId is required' });
    }
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'content is required' });
    }
    if (type && !['reflection', 'lesson', 'mistake'].includes(type)) {
      return res.status(400).json({ error: 'type must be "reflection", "lesson", or "mistake"' });
    }
    if (Array.isArray(tags) && tags.some((t: unknown) => typeof t === 'string' && t.includes(','))) {
      return res.status(400).json({ error: 'Tags must not contain commas' });
    }

    // Verify position exists
    const position = db.prepare('SELECT id FROM positions WHERE id = ?').get(positionId);
    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }

    const id = uuidv4();
    const tagsStr = Array.isArray(tags) ? tags.join(',') : (tags || '');

    db.prepare(`
      INSERT INTO reflections (id, position_id, type, content, tags)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, positionId, type || 'reflection', content, tagsStr);

    const row = db.prepare(`
      SELECT r.*, p.symbol, p.asset_type
      FROM reflections r
      JOIN positions p ON p.id = r.position_id
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
    const { content, type, tags } = req.body;

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
      if (!['reflection', 'lesson', 'mistake'].includes(type)) {
        return res.status(400).json({ error: 'type must be "reflection", "lesson", or "mistake"' });
      }
      updates.push('type = ?');
      params.push(type);
    }
    if (tags !== undefined) {
      if (Array.isArray(tags) && tags.some((t: unknown) => typeof t === 'string' && t.includes(','))) {
        return res.status(400).json({ error: 'Tags must not contain commas' });
      }
      const tagsStr = Array.isArray(tags) ? tags.join(',') : (tags || '');
      updates.push('tags = ?');
      params.push(tagsStr);
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
      SELECT r.*, p.symbol, p.asset_type
      FROM reflections r
      JOIN positions p ON p.id = r.position_id
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
