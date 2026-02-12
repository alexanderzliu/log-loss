import { Router } from 'express';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';
import type { Rule } from '../../shared/types.ts';

const router = Router();

function rowToRule(row: Record<string, unknown>): Rule {
  return {
    id: row.id as string,
    content: row.content as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// GET / - List all rules ordered by created_at
router.get('/', (_req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM rules ORDER BY created_at ASC').all() as Record<string, unknown>[];
    res.json(rows.map(rowToRule));
  } catch (error) {
    console.error('Error fetching rules:', error);
    res.status(500).json({ error: 'Failed to fetch rules' });
  }
});

// POST / - Create a rule
router.post('/', (req, res) => {
  try {
    const { content } = req.body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'content is required and must be a non-empty string' });
    }
    if (content.length > 500) {
      return res.status(400).json({ error: 'content must be 500 characters or less' });
    }

    const id = uuidv4();

    db.prepare(`
      INSERT INTO rules (id, content)
      VALUES (?, ?)
    `).run(id, content.trim());

    const row = db.prepare('SELECT * FROM rules WHERE id = ?').get(id) as Record<string, unknown>;
    res.status(201).json(rowToRule(row));
  } catch (error) {
    console.error('Error creating rule:', error);
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

// PUT /:id - Update a rule
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'content is required and must be a non-empty string' });
    }
    if (content.length > 500) {
      return res.status(400).json({ error: 'content must be 500 characters or less' });
    }

    const result = db.prepare(`
      UPDATE rules SET content = ?, updated_at = datetime('now') WHERE id = ?
    `).run(content.trim(), id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    const row = db.prepare('SELECT * FROM rules WHERE id = ?').get(id) as Record<string, unknown>;
    res.json(rowToRule(row));
  } catch (error) {
    console.error('Error updating rule:', error);
    res.status(500).json({ error: 'Failed to update rule' });
  }
});

// DELETE /:id - Delete a rule
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM rules WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting rule:', error);
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

export default router;
