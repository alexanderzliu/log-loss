import { Router } from 'express';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';
import type { TradeLeg, TradeTag } from '../../shared/types.ts';
import { rowToTrade, rowToTradeLeg, rowToTradeTag } from '../helpers/rowMappers';
import { getTradeWithDetails, backfillLegUnderlyingPrices } from '../helpers/tradeQueries';
import { captureSnapshotsForTrade } from './snapshots';

const router = Router();

// GET / - List all trades
router.get('/', (req, res) => {
  try {
    const { status, assetType, underlying, strategy, tag } = req.query;

    let query = 'SELECT DISTINCT t.* FROM trades t';
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (tag) {
      query += ' JOIN trade_tags tt ON tt.trade_id = t.id';
      conditions.push('tt.tag = ?');
      params.push(tag);
    }

    if (status) { conditions.push('t.status = ?'); params.push(status); }
    if (assetType) { conditions.push('t.asset_type = ?'); params.push(assetType); }
    if (underlying) { conditions.push('t.underlying = ?'); params.push(underlying); }
    if (strategy) { conditions.push('t.strategy = ?'); params.push(strategy); }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY COALESCE(t.open_date, t.created_at) DESC';

    const rows = db.prepare(query).all(...params) as Record<string, unknown>[];
    const trades = rows.map(rowToTrade);

    // Batch-fetch legs, tags, and reflection counts
    const tradeIds = trades.map(t => t.id);

    if (tradeIds.length > 0) {
      const placeholders = tradeIds.map(() => '?').join(',');

      // Legs
      const legsByTrade = new Map<string, TradeLeg[]>();
      const allLegRows = db.prepare(
        `SELECT * FROM trade_legs WHERE trade_id IN (${placeholders}) ORDER BY rowid ASC`
      ).all(...tradeIds) as Record<string, unknown>[];
      for (const row of allLegRows) {
        const tradeId = row.trade_id as string;
        if (!legsByTrade.has(tradeId)) legsByTrade.set(tradeId, []);
        legsByTrade.get(tradeId)!.push(rowToTradeLeg(row));
      }

      // Tags
      const tagsByTrade = new Map<string, TradeTag[]>();
      const allTagRows = db.prepare(
        `SELECT * FROM trade_tags WHERE trade_id IN (${placeholders})`
      ).all(...tradeIds) as Record<string, unknown>[];
      for (const row of allTagRows) {
        const tradeId = row.trade_id as string;
        if (!tagsByTrade.has(tradeId)) tagsByTrade.set(tradeId, []);
        tagsByTrade.get(tradeId)!.push(rowToTradeTag(row));
      }

      // Reflection counts
      const reflectionCountByTrade = new Map<string, number>();
      const countRows = db.prepare(
        `SELECT trade_id, COUNT(*) as count FROM reflections WHERE trade_id IN (${placeholders}) GROUP BY trade_id`
      ).all(...tradeIds) as { trade_id: string; count: number }[];
      for (const row of countRows) {
        reflectionCountByTrade.set(row.trade_id, row.count);
      }

      for (const trade of trades) {
        trade.legs = legsByTrade.get(trade.id) ?? [];
        trade.tags = tagsByTrade.get(trade.id) ?? [];
        trade.reflectionCount = reflectionCountByTrade.get(trade.id) ?? 0;
      }
    }

    res.json(trades);
  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

// GET /stats/summary - Portfolio summary
router.get('/stats/summary', (_req, res) => {
  try {
    const counts = db.prepare(`
      SELECT
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open_trades,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_trades
      FROM trades
    `).get() as { open_trades: number; closed_trades: number };

    const pnlStats = db.prepare(`
      SELECT
        COALESCE(SUM(realized_pnl), 0) as total_pnl,
        COALESCE(SUM(fees), 0) as total_fees,
        COUNT(CASE WHEN realized_pnl > 0 THEN 1 END) as wins,
        COUNT(CASE WHEN realized_pnl < 0 THEN 1 END) as losses
      FROM trades
      WHERE status = 'closed'
    `).get() as { total_pnl: number; total_fees: number; wins: number; losses: number };

    const planStats = db.prepare(`
      SELECT
        COUNT(CASE WHEN followed_plan = 1 THEN 1 END) as followed,
        COUNT(CASE WHEN followed_plan IS NOT NULL THEN 1 END) as assessed
      FROM trades
      WHERE status = 'closed'
    `).get() as { followed: number; assessed: number };

    const winRate = pnlStats.wins + pnlStats.losses > 0
      ? (pnlStats.wins / (pnlStats.wins + pnlStats.losses)) * 100
      : 0;

    const followedPlanRate = planStats.assessed > 0
      ? (planStats.followed / planStats.assessed) * 100
      : 0;

    res.json({
      openTrades: counts.open_trades,
      closedTrades: counts.closed_trades,
      realizedPnl: pnlStats.total_pnl,
      winRate,
      totalFees: pnlStats.total_fees,
      followedPlanRate,
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// GET /stats/equity-curve - Cumulative P&L over time
router.get('/stats/equity-curve', (_req, res) => {
  try {
    const rows = db.prepare(`
      SELECT
        date(close_date) as date,
        SUM(realized_pnl) as daily_pnl,
        COUNT(*) as trade_count
      FROM trades
      WHERE status = 'closed' AND close_date IS NOT NULL AND realized_pnl IS NOT NULL
      GROUP BY date(close_date)
      ORDER BY date(close_date) ASC
    `).all() as { date: string; daily_pnl: number; trade_count: number }[];

    let cumulative = 0;
    const curve = rows.map((row) => {
      cumulative += row.daily_pnl;
      return {
        date: row.date,
        dailyPnl: row.daily_pnl,
        cumulativePnl: cumulative,
        tradeCount: row.trade_count,
      };
    });

    res.json(curve);
  } catch (error) {
    console.error('Error fetching equity curve:', error);
    res.status(500).json({ error: 'Failed to fetch equity curve' });
  }
});

// GET /stats/analytics - Detailed trading analytics
router.get('/stats/analytics', (_req, res) => {
  try {
    // P&L by underlying
    const pnlByUnderlying = db.prepare(`
      SELECT
        underlying,
        asset_type as assetType,
        SUM(realized_pnl) as pnl,
        COUNT(*) as tradeCount
      FROM trades
      WHERE status = 'closed'
      GROUP BY underlying, asset_type
      ORDER BY SUM(realized_pnl) DESC
    `).all() as { underlying: string; assetType: string; pnl: number; tradeCount: number }[];

    // P&L by strategy
    const pnlByStrategy = db.prepare(`
      SELECT
        strategy,
        SUM(realized_pnl) as pnl,
        COUNT(*) as tradeCount,
        CASE WHEN COUNT(CASE WHEN realized_pnl IS NOT NULL THEN 1 END) > 0
          THEN CAST(COUNT(CASE WHEN realized_pnl > 0 THEN 1 END) AS REAL) / COUNT(CASE WHEN realized_pnl IS NOT NULL THEN 1 END) * 100
          ELSE 0 END as winRate
      FROM trades
      WHERE status = 'closed'
      GROUP BY strategy
      ORDER BY SUM(realized_pnl) DESC
    `).all() as { strategy: string; pnl: number; tradeCount: number; winRate: number }[];

    // Monthly P&L
    const monthlyPnl = db.prepare(`
      SELECT
        strftime('%Y-%m', close_date) as month,
        SUM(realized_pnl) as pnl,
        COUNT(CASE WHEN realized_pnl > 0 THEN 1 END) as wins,
        COUNT(CASE WHEN realized_pnl < 0 THEN 1 END) as losses
      FROM trades
      WHERE status = 'closed' AND close_date IS NOT NULL
      GROUP BY strftime('%Y-%m', close_date)
      ORDER BY month ASC
    `).all() as { month: string; pnl: number; wins: number; losses: number }[];

    // Best and worst trades
    const bestTrade = db.prepare(`
      SELECT realized_pnl as pnl, close_date as date, underlying, name
      FROM trades
      WHERE status = 'closed' AND realized_pnl IS NOT NULL
      ORDER BY realized_pnl DESC LIMIT 1
    `).get() as { pnl: number; date: string; underlying: string; name: string } | undefined;

    const worstTrade = db.prepare(`
      SELECT realized_pnl as pnl, close_date as date, underlying, name
      FROM trades
      WHERE status = 'closed' AND realized_pnl IS NOT NULL
      ORDER BY realized_pnl ASC LIMIT 1
    `).get() as { pnl: number; date: string; underlying: string; name: string } | undefined;

    // P&L by entry quality
    const pnlByEntryQuality = db.prepare(`
      SELECT
        COALESCE(entry_quality, 'unrated') as entryQuality,
        SUM(realized_pnl) as pnl,
        COUNT(*) as tradeCount,
        CASE WHEN COUNT(CASE WHEN realized_pnl IS NOT NULL THEN 1 END) > 0
          THEN CAST(COUNT(CASE WHEN realized_pnl > 0 THEN 1 END) AS REAL) / COUNT(CASE WHEN realized_pnl IS NOT NULL THEN 1 END) * 100
          ELSE 0 END as winRate
      FROM trades
      WHERE status = 'closed'
      GROUP BY COALESCE(entry_quality, 'unrated')
      ORDER BY SUM(realized_pnl) DESC
    `).all() as { entryQuality: string; pnl: number; tradeCount: number; winRate: number }[];

    // Average win/loss and profit factor
    const avgStats = db.prepare(`
      SELECT
        AVG(CASE WHEN realized_pnl > 0 THEN realized_pnl END) as avg_win,
        AVG(CASE WHEN realized_pnl < 0 THEN realized_pnl END) as avg_loss,
        SUM(CASE WHEN realized_pnl > 0 THEN realized_pnl ELSE 0 END) as total_wins,
        ABS(SUM(CASE WHEN realized_pnl < 0 THEN realized_pnl ELSE 0 END)) as total_losses
      FROM trades
      WHERE status = 'closed'
    `).get() as { avg_win: number | null; avg_loss: number | null; total_wins: number; total_losses: number };

    // Average hold time
    const avgHoldTime = db.prepare(`
      SELECT AVG(julianday(close_date) - julianday(open_date)) as avg_days
      FROM trades
      WHERE status = 'closed' AND close_date IS NOT NULL AND open_date IS NOT NULL
    `).get() as { avg_days: number | null };

    const profitFactor = avgStats.total_losses > 0
      ? avgStats.total_wins / avgStats.total_losses
      : avgStats.total_wins > 0 ? Infinity : 0;

    res.json({
      pnlByUnderlying,
      pnlByStrategy,
      pnlByEntryQuality,
      monthlyPnl,
      bestTrade: bestTrade ? { pnl: bestTrade.pnl, date: bestTrade.date, underlying: bestTrade.underlying, name: bestTrade.name } : null,
      worstTrade: worstTrade ? { pnl: worstTrade.pnl, date: worstTrade.date, underlying: worstTrade.underlying, name: worstTrade.name } : null,
      avgWin: avgStats.avg_win,
      avgLoss: avgStats.avg_loss,
      profitFactor,
      avgHoldDays: avgHoldTime.avg_days,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /stats/recent-activity - Last 10 trades by date
router.get('/stats/recent-activity', (_req, res) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM trades
      ORDER BY COALESCE(close_date, open_date, created_at) DESC
      LIMIT 10
    `).all() as Record<string, unknown>[];

    const trades = rows.map(rowToTrade);

    // Batch-fetch legs and tags
    const tradeIds = trades.map(t => t.id);
    if (tradeIds.length > 0) {
      const placeholders = tradeIds.map(() => '?').join(',');

      const allLegRows = db.prepare(
        `SELECT * FROM trade_legs WHERE trade_id IN (${placeholders}) ORDER BY rowid ASC`
      ).all(...tradeIds) as Record<string, unknown>[];
      const legsByTrade = new Map<string, TradeLeg[]>();
      for (const row of allLegRows) {
        const tradeId = row.trade_id as string;
        if (!legsByTrade.has(tradeId)) legsByTrade.set(tradeId, []);
        legsByTrade.get(tradeId)!.push(rowToTradeLeg(row));
      }

      const allTagRows = db.prepare(
        `SELECT * FROM trade_tags WHERE trade_id IN (${placeholders})`
      ).all(...tradeIds) as Record<string, unknown>[];
      const tagsByTrade = new Map<string, TradeTag[]>();
      for (const row of allTagRows) {
        const tradeId = row.trade_id as string;
        if (!tagsByTrade.has(tradeId)) tagsByTrade.set(tradeId, []);
        tagsByTrade.get(tradeId)!.push(rowToTradeTag(row));
      }

      for (const trade of trades) {
        trade.legs = legsByTrade.get(trade.id) ?? [];
        trade.tags = tagsByTrade.get(trade.id) ?? [];
      }
    }

    res.json(trades);
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});

// GET /:id - Get single trade with details
router.get('/:id', (req, res) => {
  try {
    const trade = getTradeWithDetails(req.params.id);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    res.json(trade);
  } catch (error) {
    console.error('Error fetching trade:', error);
    res.status(500).json({ error: 'Failed to fetch trade' });
  }
});

// POST / - Create trade with legs and tags
router.post('/', (req, res) => {
  try {
    const {
      name, assetType, underlying, status: requestedStatus, strategy, side, quantity,
      entryPrice, fees, openDate, entryQuality,
      thesis, exitPlan, notes, legs, tags,
    } = req.body;

    if (!underlying || typeof underlying !== 'string') {
      return res.status(400).json({ error: 'Underlying symbol is required' });
    }

    const tradeId = uuidv4();
    const initialStatus = requestedStatus === 'planned' ? 'planned' : 'open';

    const create = db.transaction(() => {
      db.prepare(`
        INSERT INTO trades (
          id, name, asset_type, underlying, status, strategy, side, quantity,
          entry_price, fees, open_date, entry_quality,
          thesis, exit_plan, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        tradeId,
        name || '',
        assetType || 'option',
        underlying.toUpperCase(),
        initialStatus,
        strategy || 'long',
        side || 'buy',
        quantity || 1,
        entryPrice ?? null,
        fees ?? null,
        openDate ?? null,
        entryQuality ?? null,
        thesis || '',
        exitPlan || '',
        notes || '',
      );

      // Insert legs
      if (Array.isArray(legs)) {
        const insertLeg = db.prepare(`
          INSERT INTO trade_legs (
            id, trade_id, ticker, option_type, strike, expiration, side, quantity,
            entry_price, exit_price, entry_underlying_price, exit_underlying_price,
            delta, gamma, theta, vega, iv
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const leg of legs) {
          insertLeg.run(
            uuidv4(), tradeId,
            leg.ticker || '', leg.optionType ?? null,
            leg.strike ?? null, leg.expiration ?? null,
            leg.side || 'buy', leg.quantity || 1,
            leg.entryPrice ?? null, leg.exitPrice ?? null,
            leg.entryUnderlyingPrice ?? null, leg.exitUnderlyingPrice ?? null,
            leg.delta ?? null, leg.gamma ?? null,
            leg.theta ?? null, leg.vega ?? null, leg.iv ?? null,
          );
        }
      }

      // Insert tags
      if (Array.isArray(tags)) {
        const insertTag = db.prepare(`
          INSERT OR IGNORE INTO trade_tags (id, trade_id, tag, category)
          VALUES (?, ?, ?, ?)
        `);

        for (const t of tags) {
          insertTag.run(uuidv4(), tradeId, t.tag, t.category ?? null);
        }
      }
    });

    create();

    const trade = getTradeWithDetails(tradeId);
    res.status(201).json(trade);

    // Fire-and-forget: capture chart data for open trades
    if (initialStatus === 'open') {
      captureSnapshotsForTrade(tradeId).catch((err) =>
        console.error(`Auto-capture on create failed for trade ${tradeId}:`, err)
      );
    }
  } catch (error) {
    console.error('Error creating trade:', error);
    res.status(500).json({ error: 'Failed to create trade' });
  }
});

// PUT /:id - Update trade fields
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates: string[] = [];
    const params: unknown[] = [];

    // Metadata fields
    if ('name' in req.body) { updates.push('name = ?'); params.push(req.body.name ?? ''); }
    if ('thesis' in req.body) { updates.push('thesis = ?'); params.push(req.body.thesis ?? ''); }
    if ('exitPlan' in req.body) { updates.push('exit_plan = ?'); params.push(req.body.exitPlan ?? ''); }
    if ('notes' in req.body) { updates.push('notes = ?'); params.push(req.body.notes ?? ''); }
    if ('reflection' in req.body) { updates.push('reflection = ?'); params.push(req.body.reflection ?? ''); }
    if ('entryQuality' in req.body) { updates.push('entry_quality = ?'); params.push(req.body.entryQuality ?? null); }
    if ('followedPlan' in req.body) { updates.push('followed_plan = ?'); params.push(req.body.followedPlan != null ? (req.body.followedPlan ? 1 : 0) : null); }

    // Date fields
    if ('openDate' in req.body) { updates.push('open_date = ?'); params.push(req.body.openDate ?? null); }
    if ('closeDate' in req.body) { updates.push('close_date = ?'); params.push(req.body.closeDate ?? null); }

    // Pricing & P&L
    if ('entryPrice' in req.body) { updates.push('entry_price = ?'); params.push(req.body.entryPrice ?? null); }
    if ('exitPrice' in req.body) { updates.push('exit_price = ?'); params.push(req.body.exitPrice ?? null); }
    if ('fees' in req.body) { updates.push('fees = ?'); params.push(req.body.fees ?? null); }

    // Structure
    if ('strategy' in req.body) { updates.push('strategy = ?'); params.push(req.body.strategy); }
    if ('quantity' in req.body) { updates.push('quantity = ?'); params.push(req.body.quantity); }
    if ('side' in req.body) { updates.push('side = ?'); params.push(req.body.side); }
    if ('underlying' in req.body) { updates.push('underlying = ?'); params.push(typeof req.body.underlying === 'string' ? req.body.underlying.toUpperCase() : req.body.underlying); }

    // Realized P&L — either explicit or recalculated
    if ('realizedPnl' in req.body && !req.body.recalculatePnl) {
      updates.push('realized_pnl = ?'); params.push(req.body.realizedPnl ?? null);
    }

    const hasTagOps = 'tags' in req.body || 'addTags' in req.body || 'removeTags' in req.body;

    if (updates.length === 0 && !req.body.recalculatePnl && !hasTagOps) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Validation: openDate must be before closeDate
    if ('openDate' in req.body && 'closeDate' in req.body && req.body.openDate && req.body.closeDate) {
      if (new Date(req.body.openDate) >= new Date(req.body.closeDate)) {
        return res.status(400).json({ error: 'openDate must be before closeDate' });
      }
    }

    const update = db.transaction(() => {
      // Recalculate P&L if requested
      if (req.body.recalculatePnl) {
        const trade = db.prepare('SELECT entry_price, exit_price, quantity, fees, side FROM trades WHERE id = ?').get(id) as {
          entry_price: number | null; exit_price: number | null; quantity: number; fees: number | null; side: string;
        } | undefined;
        if (trade) {
          const entry = 'entryPrice' in req.body ? req.body.entryPrice : trade.entry_price;
          const exit = 'exitPrice' in req.body ? req.body.exitPrice : trade.exit_price;
          const qty = 'quantity' in req.body ? req.body.quantity : trade.quantity;
          const fees = 'fees' in req.body ? (req.body.fees ?? 0) : (trade.fees ?? 0);
          const side = 'side' in req.body ? req.body.side : trade.side;
          if (entry != null && exit != null) {
            const direction = side === 'buy' ? 1 : -1;
            const pnl = direction * (exit - entry) * qty * 100 - fees;
            updates.push('realized_pnl = ?'); params.push(pnl);
          }
        }
      }

      if (updates.length > 0) {
        updates.push("updated_at = datetime('now')");
        params.push(id);
        const result = db.prepare(`UPDATE trades SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        if (result.changes === 0) throw new Error('Trade not found');
      }

      // Tag operations
      if ('tags' in req.body) {
        // Replace all tags
        db.prepare('DELETE FROM trade_tags WHERE trade_id = ?').run(id);
        if (Array.isArray(req.body.tags)) {
          const insertTag = db.prepare('INSERT OR IGNORE INTO trade_tags (id, trade_id, tag, category) VALUES (?, ?, ?, ?)');
          for (const t of req.body.tags) {
            insertTag.run(uuidv4(), id, t.tag, t.category ?? null);
          }
        }
      } else {
        if (Array.isArray(req.body.removeTags)) {
          const deleteTag = db.prepare('DELETE FROM trade_tags WHERE trade_id = ? AND id = ?');
          for (const tagId of req.body.removeTags) {
            deleteTag.run(id, tagId);
          }
        }
        if (Array.isArray(req.body.addTags)) {
          const insertTag = db.prepare('INSERT OR IGNORE INTO trade_tags (id, trade_id, tag, category) VALUES (?, ?, ?, ?)');
          for (const t of req.body.addTags) {
            insertTag.run(uuidv4(), id, t.tag, t.category ?? null);
          }
        }
      }
    });

    update();

    const trade = getTradeWithDetails(id);
    if (!trade) return res.status(404).json({ error: 'Trade not found' });
    res.json(trade);

    // Re-trigger snapshot capture and leg price backfill when dates change
    if ('openDate' in req.body || 'closeDate' in req.body) {
      backfillLegUnderlyingPrices(id).catch((err) =>
        console.error(`Snapshot re-capture failed for trade ${id}:`, err)
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update trade';
    console.error('Error updating trade:', error);
    if (message === 'Trade not found') return res.status(404).json({ error: message });
    res.status(500).json({ error: 'Failed to update trade' });
  }
});

// PUT /:id/close - Close a trade
router.put('/:id/close', (req, res) => {
  try {
    const { id } = req.params;
    const { exitPrice, closeDate, realizedPnl, reflection, followedPlan, legs: legUpdates } = req.body;

    const close = db.transaction(() => {
      const existing = db.prepare('SELECT id, status FROM trades WHERE id = ?').get(id) as { id: string; status: string } | undefined;
      if (!existing) throw new Error('Trade not found');
      if (existing.status === 'closed') throw new Error('Trade is already closed');

      db.prepare(`
        UPDATE trades SET
          status = 'closed',
          exit_price = ?,
          close_date = ?,
          realized_pnl = ?,
          reflection = COALESCE(?, reflection),
          followed_plan = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        exitPrice ?? null,
        closeDate ?? null,
        realizedPnl ?? null,
        reflection ?? null,
        followedPlan != null ? (followedPlan ? 1 : 0) : null,
        id,
      );

      // Update per-leg exit prices if provided
      if (Array.isArray(legUpdates)) {
        const updateLeg = db.prepare(
          'UPDATE trade_legs SET exit_price = ? WHERE id = ? AND trade_id = ?'
        );
        for (const leg of legUpdates) {
          updateLeg.run(leg.exitPrice ?? null, leg.id, id);
        }
      }
    });

    close();

    const trade = getTradeWithDetails(id);
    res.json(trade);

    // Fire-and-forget: capture exit session chart data and backfill leg prices
    backfillLegUnderlyingPrices(id).catch((err) =>
      console.error(`Auto-capture on close failed for trade ${id}:`, err)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to close trade';
    console.error('Error closing trade:', error);
    if (message.includes('not found') || message.includes('already closed')) {
      return res.status(400).json({ error: message });
    }
    res.status(500).json({ error: 'Failed to close trade' });
  }
});

// PUT /:id/open - Open a planned trade
router.put('/:id/open', (req, res) => {
  try {
    const { id } = req.params;
    const { entryPrice, openDate, fees } = req.body;

    const existing = db.prepare('SELECT id, status FROM trades WHERE id = ?').get(id) as { id: string; status: string } | undefined;
    if (!existing) return res.status(404).json({ error: 'Trade not found' });
    if (existing.status !== 'planned') return res.status(400).json({ error: 'Only planned trades can be opened' });

    const updates: string[] = ["status = 'open'", "updated_at = datetime('now')"];
    const params: unknown[] = [];

    if (entryPrice != null) { updates.push('entry_price = ?'); params.push(entryPrice); }
    if (openDate != null) { updates.push('open_date = ?'); params.push(openDate); }
    if (fees != null) { updates.push('fees = ?'); params.push(fees); }

    params.push(id);
    db.prepare(`UPDATE trades SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const trade = getTradeWithDetails(id);
    res.json(trade);
  } catch (error) {
    console.error('Error opening trade:', error);
    res.status(500).json({ error: 'Failed to open trade' });
  }
});

// DELETE /:id - Delete trade (cascades to legs, tags, reflections)
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM trades WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting trade:', error);
    res.status(500).json({ error: 'Failed to delete trade' });
  }
});

// POST /:id/legs - Add a leg to a trade
router.post('/:id/legs', (req, res) => {
  try {
    const tradeId = req.params.id;
    const existing = db.prepare('SELECT id FROM trades WHERE id = ?').get(tradeId);
    if (!existing) return res.status(404).json({ error: 'Trade not found' });

    const leg = req.body;
    const legId = uuidv4();

    db.prepare(`
      INSERT INTO trade_legs (
        id, trade_id, ticker, option_type, strike, expiration, side, quantity,
        entry_price, exit_price, entry_underlying_price, exit_underlying_price,
        delta, gamma, theta, vega, iv
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      legId, tradeId,
      leg.ticker || '', leg.optionType ?? null,
      leg.strike ?? null, leg.expiration ?? null,
      leg.side || 'buy', leg.quantity || 1,
      leg.entryPrice ?? null, leg.exitPrice ?? null,
      leg.entryUnderlyingPrice ?? null, leg.exitUnderlyingPrice ?? null,
      leg.delta ?? null, leg.gamma ?? null,
      leg.theta ?? null, leg.vega ?? null, leg.iv ?? null,
    );

    const trade = getTradeWithDetails(tradeId);
    res.status(201).json(trade);
  } catch (error) {
    console.error('Error adding leg:', error);
    res.status(500).json({ error: 'Failed to add leg' });
  }
});

// PUT /:id/legs/:legId - Update a leg
router.put('/:id/legs/:legId', (req, res) => {
  try {
    const { id: tradeId, legId } = req.params;
    const updates: string[] = [];
    const params: unknown[] = [];

    const fields: Record<string, string> = {
      ticker: 'ticker', optionType: 'option_type', strike: 'strike',
      expiration: 'expiration', side: 'side', quantity: 'quantity',
      entryPrice: 'entry_price', exitPrice: 'exit_price',
      entryUnderlyingPrice: 'entry_underlying_price', exitUnderlyingPrice: 'exit_underlying_price',
      delta: 'delta', gamma: 'gamma', theta: 'theta', vega: 'vega', iv: 'iv',
    };

    for (const [jsKey, dbKey] of Object.entries(fields)) {
      if (jsKey in req.body) {
        updates.push(`${dbKey} = ?`);
        params.push(req.body[jsKey] ?? null);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(legId, tradeId);
    const result = db.prepare(
      `UPDATE trade_legs SET ${updates.join(', ')} WHERE id = ? AND trade_id = ?`
    ).run(...params);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Leg not found' });
    }

    const trade = getTradeWithDetails(tradeId);
    res.json(trade);
  } catch (error) {
    console.error('Error updating leg:', error);
    res.status(500).json({ error: 'Failed to update leg' });
  }
});

// DELETE /:id/legs/:legId - Remove a leg
router.delete('/:id/legs/:legId', (req, res) => {
  try {
    const { id: tradeId, legId } = req.params;
    const result = db.prepare('DELETE FROM trade_legs WHERE id = ? AND trade_id = ?').run(legId, tradeId);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Leg not found' });
    }

    const trade = getTradeWithDetails(tradeId);
    res.json(trade);
  } catch (error) {
    console.error('Error deleting leg:', error);
    res.status(500).json({ error: 'Failed to delete leg' });
  }
});

// POST /:id/tags - Add a tag to a trade
router.post('/:id/tags', (req, res) => {
  try {
    const tradeId = req.params.id;
    const existing = db.prepare('SELECT id FROM trades WHERE id = ?').get(tradeId);
    if (!existing) return res.status(404).json({ error: 'Trade not found' });

    const { tag, category } = req.body;
    if (!tag) return res.status(400).json({ error: 'Tag is required' });

    db.prepare(
      'INSERT OR IGNORE INTO trade_tags (id, trade_id, tag, category) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), tradeId, tag, category ?? null);

    const trade = getTradeWithDetails(tradeId);
    res.json(trade);
  } catch (error) {
    console.error('Error adding tag:', error);
    res.status(500).json({ error: 'Failed to add tag' });
  }
});

// DELETE /:id/tags/:tagId - Remove a tag
router.delete('/:id/tags/:tagId', (req, res) => {
  try {
    const { id: tradeId, tagId } = req.params;
    const result = db.prepare('DELETE FROM trade_tags WHERE id = ? AND trade_id = ?').run(tagId, tradeId);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    const trade = getTradeWithDetails(tradeId);
    res.json(trade);
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

export default router;
