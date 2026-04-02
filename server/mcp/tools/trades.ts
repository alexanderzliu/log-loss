import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { db } from '../../database';
import { rowToTrade, rowToTradeLeg, rowToTradeTag } from '../../helpers/rowMappers';
import { getTradeWithDetails, backfillLegUnderlyingPrices } from '../../helpers/tradeQueries';
import type { TradeLeg, TradeTag, ComputedIndicators, VwapPoint } from '../../../shared/types.ts';

/**
 * Build a chart context summary from snapshot indicators at a given timestamp.
 */
function getChartContext(tradeId: string, underlying: string, openDate: string | null, closeDate: string | null) {
  const snapshot = db.prepare(
    "SELECT indicators, bars FROM chart_snapshots WHERE trade_id = ? AND symbol = ? AND symbol_type = 'underlying'"
  ).get(tradeId, underlying.toUpperCase()) as { indicators: string; bars: string } | undefined;

  if (!snapshot || !snapshot.indicators) return null;

  const indicators: ComputedIndicators = JSON.parse(snapshot.indicators);
  const bars = JSON.parse(snapshot.bars) as { t: number; c: number }[];

  function findVwapAtTime(time: string | null): VwapPoint | null {
    if (!time || !indicators.vwap || indicators.vwap.length === 0) return null;
    const target = new Date(time).getTime() / 1000;
    let closest = indicators.vwap[0];
    let minDiff = Math.abs(closest.t - target);
    for (const pt of indicators.vwap) {
      const diff = Math.abs(pt.t - target);
      if (diff < minDiff) { closest = pt; minDiff = diff; }
    }
    return closest;
  }

  function describeBandPosition(price: number, vwap: VwapPoint): string {
    if (price > vwap.upperBand3) return 'above +3SD';
    if (price > vwap.upperBand2) return 'between +2SD and +3SD';
    if (price > vwap.upperBand1) return 'between +1SD and +2SD';
    if (price > vwap.vwap) return 'between VWAP and +1SD';
    if (price > vwap.lowerBand1) return 'between -1SD and VWAP';
    if (price > vwap.lowerBand2) return 'between -2SD and -1SD';
    if (price > vwap.lowerBand3) return 'between -3SD and -2SD';
    return 'below -3SD';
  }

  function findPriceAtTime(time: string | null): number | null {
    if (!time || bars.length === 0) return null;
    const target = new Date(time).getTime() / 1000;
    let closest = bars[0];
    let minDiff = Math.abs(closest.t - target);
    for (const bar of bars) {
      const diff = Math.abs(bar.t - target);
      if (diff < minDiff) { closest = bar; minDiff = diff; }
    }
    return closest.c;
  }

  const entryVwap = findVwapAtTime(openDate);
  const exitVwap = findVwapAtTime(closeDate);
  const entryPrice = findPriceAtTime(openDate);
  const exitPrice = findPriceAtTime(closeDate);

  return {
    vwapAtEntry: entryVwap?.vwap ?? null,
    vwapAtExit: exitVwap?.vwap ?? null,
    entryBandPosition: entryVwap && entryPrice ? describeBandPosition(entryPrice, entryVwap) : null,
    exitBandPosition: exitVwap && exitPrice ? describeBandPosition(exitPrice, exitVwap) : null,
    poc: indicators.poc,
    valueAreaHigh: indicators.valueAreaHigh,
    valueAreaLow: indicators.valueAreaLow,
    entryInValueArea: entryPrice != null
      ? entryPrice >= indicators.valueAreaLow && entryPrice <= indicators.valueAreaHigh
      : null,
    distanceFromPoc: entryPrice != null && indicators.poc
      ? Math.round(((entryPrice - indicators.poc) / indicators.poc) * 10000) / 100
      : null,
  };
}

export function registerTradeTools(server: McpServer) {
  // --- search_trades ---
  server.registerTool(
    'search_trades',
    {
      title: 'Search Trades',
      description: 'Search and filter trades with rich criteria. Returns paginated results with legs and tags.',
      inputSchema: {
        dateFrom: z.string().optional().describe('Start date YYYY-MM-DD (inclusive, matches open_date or close_date)'),
        dateTo: z.string().optional().describe('End date YYYY-MM-DD (inclusive)'),
        underlying: z.string().optional().describe('Filter by underlying symbol'),
        strategy: z.enum(['long', 'short', 'debit_spread', 'credit_spread', 'iron_condor', 'straddle', 'strangle', 'custom']).optional(),
        status: z.enum(['open', 'closed']).optional(),
        side: z.enum(['buy', 'sell']).optional(),
        entryQuality: z.enum(['clean', 'fomo', 'chased', 'intuitive']).optional(),
        tag: z.string().optional().describe('Filter by tag'),
        pnlMin: z.number().optional().describe('Minimum realized P&L'),
        pnlMax: z.number().optional().describe('Maximum realized P&L'),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      try {
        let query = 'SELECT DISTINCT t.* FROM trades t';
        let countQuery = 'SELECT COUNT(DISTINCT t.id) as total FROM trades t';
        const params: unknown[] = [];
        const conditions: string[] = [];

        if (args.tag) {
          query += ' JOIN trade_tags tt ON tt.trade_id = t.id';
          countQuery += ' JOIN trade_tags tt ON tt.trade_id = t.id';
          conditions.push('tt.tag = ?');
          params.push(args.tag);
        }

        if (args.dateFrom) {
          conditions.push("(date(t.open_date) >= ? OR date(t.close_date) >= ?)");
          params.push(args.dateFrom, args.dateFrom);
        }
        if (args.dateTo) {
          conditions.push("(date(t.open_date) <= ? OR date(t.close_date) <= ?)");
          params.push(args.dateTo, args.dateTo);
        }
        if (args.underlying) { conditions.push('t.underlying = ?'); params.push(args.underlying.toUpperCase()); }
        if (args.strategy) { conditions.push('t.strategy = ?'); params.push(args.strategy); }
        if (args.status) { conditions.push('t.status = ?'); params.push(args.status); }
        if (args.side) { conditions.push('t.side = ?'); params.push(args.side); }
        if (args.entryQuality) { conditions.push('t.entry_quality = ?'); params.push(args.entryQuality); }
        if (args.pnlMin != null) { conditions.push('t.realized_pnl >= ?'); params.push(args.pnlMin); }
        if (args.pnlMax != null) { conditions.push('t.realized_pnl <= ?'); params.push(args.pnlMax); }

        const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
        query += whereClause + ' ORDER BY COALESCE(t.open_date, t.created_at) DESC LIMIT ? OFFSET ?';
        countQuery += whereClause;

        const totalRow = db.prepare(countQuery).get(...params) as { total: number };
        const rows = db.prepare(query).all(...params, args.limit, args.offset) as Record<string, unknown>[];
        const trades = rows.map(rowToTrade);

        // Batch fetch legs and tags
        const tradeIds = trades.map(t => t.id);
        if (tradeIds.length > 0) {
          const ph = tradeIds.map(() => '?').join(',');

          const legRows = db.prepare(
            `SELECT * FROM trade_legs WHERE trade_id IN (${ph}) ORDER BY rowid ASC`
          ).all(...tradeIds) as Record<string, unknown>[];
          const legsByTrade = new Map<string, TradeLeg[]>();
          for (const row of legRows) {
            const tid = row.trade_id as string;
            if (!legsByTrade.has(tid)) legsByTrade.set(tid, []);
            legsByTrade.get(tid)!.push(rowToTradeLeg(row));
          }

          const tagRows = db.prepare(
            `SELECT * FROM trade_tags WHERE trade_id IN (${ph})`
          ).all(...tradeIds) as Record<string, unknown>[];
          const tagsByTrade = new Map<string, TradeTag[]>();
          for (const row of tagRows) {
            const tid = row.trade_id as string;
            if (!tagsByTrade.has(tid)) tagsByTrade.set(tid, []);
            tagsByTrade.get(tid)!.push(rowToTradeTag(row));
          }

          for (const trade of trades) {
            trade.legs = legsByTrade.get(trade.id) ?? [];
            trade.tags = tagsByTrade.get(trade.id) ?? [];
          }
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              total: totalRow.total,
              limit: args.limit,
              offset: args.offset,
              trades,
            }, null, 2),
          }],
        };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  // --- get_trade ---
  server.registerTool(
    'get_trade',
    {
      title: 'Get Trade',
      description: 'Get full trade details including legs, tags, reflections, and chart context (VWAP position, POC, value area at entry/exit).',
      inputSchema: {
        tradeId: z.string().describe('Trade UUID'),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      try {
        const trade = getTradeWithDetails(args.tradeId);
        if (!trade) {
          return { content: [{ type: 'text' as const, text: 'Trade not found' }], isError: true };
        }

        const chartContext = getChartContext(trade.id, trade.underlying, trade.openDate, trade.closeDate);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ trade, chartContext }, null, 2),
          }],
        };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  // --- update_trade ---
  server.registerTool(
    'update_trade',
    {
      title: 'Update Trade',
      description: 'Update any trade field: metadata, dates, prices, P&L, strategy, side, quantity, underlying, and tags. Date updates re-trigger snapshot capture for chart arrows.',
      inputSchema: {
        tradeId: z.string().describe('Trade UUID'),
        // Metadata
        name: z.string().optional(),
        thesis: z.string().optional(),
        exitPlan: z.string().optional(),
        notes: z.string().optional(),
        reflection: z.string().optional(),
        entryQuality: z.enum(['clean', 'fomo', 'chased', 'intuitive']).optional(),
        followedPlan: z.boolean().optional(),
        // Dates (ISO format, e.g. 2026-03-31T14:35:00Z)
        openDate: z.string().optional().describe('Entry datetime ISO format'),
        closeDate: z.string().optional().describe('Exit datetime ISO format'),
        // Pricing & P&L
        entryPrice: z.number().nonnegative().optional().describe('Entry premium per share'),
        exitPrice: z.number().nonnegative().optional().describe('Exit premium per share'),
        realizedPnl: z.number().optional().describe('Realized P&L in dollars'),
        fees: z.number().nonnegative().optional(),
        recalculatePnl: z.boolean().optional().describe('Auto-recalculate P&L from (exitPrice - entryPrice) * quantity * 100 - fees'),
        // Structure
        strategy: z.enum(['long', 'short', 'debit_spread', 'credit_spread', 'iron_condor', 'straddle', 'strangle', 'custom']).optional(),
        quantity: z.number().int().positive().optional(),
        side: z.enum(['buy', 'sell']).optional(),
        underlying: z.string().optional(),
        // Tags
        tags: z.array(z.object({ tag: z.string(), category: z.string().optional() })).optional().describe('Replace all tags'),
        addTags: z.array(z.object({ tag: z.string(), category: z.string().optional() })).optional().describe('Add tags without removing existing'),
        removeTags: z.array(z.string()).optional().describe('Remove tags by ID'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (args) => {
      try {
        const updates: string[] = [];
        const params: unknown[] = [];

        // Metadata
        if (args.name !== undefined) { updates.push('name = ?'); params.push(args.name); }
        if (args.thesis !== undefined) { updates.push('thesis = ?'); params.push(args.thesis); }
        if (args.exitPlan !== undefined) { updates.push('exit_plan = ?'); params.push(args.exitPlan); }
        if (args.notes !== undefined) { updates.push('notes = ?'); params.push(args.notes); }
        if (args.reflection !== undefined) { updates.push('reflection = ?'); params.push(args.reflection); }
        if (args.entryQuality !== undefined) { updates.push('entry_quality = ?'); params.push(args.entryQuality); }
        if (args.followedPlan !== undefined) { updates.push('followed_plan = ?'); params.push(args.followedPlan ? 1 : 0); }

        // Dates
        if (args.openDate !== undefined) { updates.push('open_date = ?'); params.push(args.openDate); }
        if (args.closeDate !== undefined) { updates.push('close_date = ?'); params.push(args.closeDate); }

        // Pricing
        if (args.entryPrice !== undefined) { updates.push('entry_price = ?'); params.push(args.entryPrice); }
        if (args.exitPrice !== undefined) { updates.push('exit_price = ?'); params.push(args.exitPrice); }
        if (args.fees !== undefined) { updates.push('fees = ?'); params.push(args.fees); }

        // Structure
        if (args.strategy !== undefined) { updates.push('strategy = ?'); params.push(args.strategy); }
        if (args.quantity !== undefined) { updates.push('quantity = ?'); params.push(args.quantity); }
        if (args.side !== undefined) { updates.push('side = ?'); params.push(args.side); }
        if (args.underlying !== undefined) { updates.push('underlying = ?'); params.push(args.underlying.toUpperCase()); }

        // Explicit realized P&L (non-recalculate path)
        if (args.realizedPnl !== undefined && !args.recalculatePnl) {
          updates.push('realized_pnl = ?'); params.push(args.realizedPnl);
        }

        // Validation
        if (args.openDate && args.closeDate && new Date(args.openDate) >= new Date(args.closeDate)) {
          return { content: [{ type: 'text' as const, text: 'Error: openDate must be before closeDate' }], isError: true };
        }

        const hasTagOps = args.tags !== undefined || args.addTags !== undefined || args.removeTags !== undefined;

        if (updates.length === 0 && !args.recalculatePnl && !hasTagOps) {
          return { content: [{ type: 'text' as const, text: 'No fields to update' }], isError: true };
        }

        const txn = db.transaction(() => {
          // Recalculate P&L
          if (args.recalculatePnl) {
            const trade = db.prepare('SELECT entry_price, exit_price, quantity, fees, side FROM trades WHERE id = ?').get(args.tradeId) as {
              entry_price: number | null; exit_price: number | null; quantity: number; fees: number | null; side: string;
            } | undefined;
            if (trade) {
              const entry = args.entryPrice ?? trade.entry_price;
              const exit = args.exitPrice ?? trade.exit_price;
              const qty = args.quantity ?? trade.quantity;
              const fees = args.fees ?? trade.fees ?? 0;
              const side = args.side ?? trade.side;
              if (entry != null && exit != null) {
                const direction = side === 'buy' ? 1 : -1;
                const pnl = direction * (exit - entry) * qty * 100 - fees;
                updates.push('realized_pnl = ?'); params.push(pnl);
              }
            }
          }

          if (updates.length > 0) {
            updates.push("updated_at = datetime('now')");
            params.push(args.tradeId);
            const result = db.prepare(`UPDATE trades SET ${updates.join(', ')} WHERE id = ?`).run(...params);
            if (result.changes === 0) throw new Error('Trade not found');
          }

          // Tag operations
          if (args.tags !== undefined) {
            db.prepare('DELETE FROM trade_tags WHERE trade_id = ?').run(args.tradeId);
            const insertTag = db.prepare('INSERT OR IGNORE INTO trade_tags (id, trade_id, tag, category) VALUES (?, ?, ?, ?)');
            for (const t of args.tags) {
              insertTag.run(uuidv4(), args.tradeId, t.tag, t.category ?? null);
            }
          } else {
            if (args.removeTags) {
              const deleteTag = db.prepare('DELETE FROM trade_tags WHERE trade_id = ? AND id = ?');
              for (const tagId of args.removeTags) {
                deleteTag.run(args.tradeId, tagId);
              }
            }
            if (args.addTags) {
              const insertTag = db.prepare('INSERT OR IGNORE INTO trade_tags (id, trade_id, tag, category) VALUES (?, ?, ?, ?)');
              for (const t of args.addTags) {
                insertTag.run(uuidv4(), args.tradeId, t.tag, t.category ?? null);
              }
            }
          }
        });

        txn();

        const trade = getTradeWithDetails(args.tradeId);
        if (!trade) {
          return { content: [{ type: 'text' as const, text: 'Trade not found' }], isError: true };
        }

        // Re-trigger snapshot capture and leg price backfill when dates change
        if (args.openDate !== undefined || args.closeDate !== undefined) {
          backfillLegUnderlyingPrices(trade.id).catch((err) =>
            console.error(`Snapshot re-capture on update failed: ${err}`)
          );
        }

        return { content: [{ type: 'text' as const, text: JSON.stringify(trade, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  // --- delete_trade ---
  server.registerTool(
    'delete_trade',
    {
      title: 'Delete Trade',
      description: 'Permanently delete a trade and all associated data (legs, tags, reflections, snapshots). Use with caution.',
      inputSchema: {
        tradeId: z.string().describe('Trade UUID to delete'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async (args) => {
      try {
        // Fetch before deleting for confirmation
        const trade = getTradeWithDetails(args.tradeId);
        if (!trade) {
          return { content: [{ type: 'text' as const, text: 'Trade not found' }], isError: true };
        }

        db.prepare('DELETE FROM chart_snapshots WHERE trade_id = ?').run(args.tradeId);
        db.prepare('DELETE FROM trades WHERE id = ?').run(args.tradeId);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ deleted: true, trade: { id: trade.id, name: trade.name, underlying: trade.underlying, realizedPnl: trade.realizedPnl } }),
          }],
        };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  // --- close_trade ---
  server.registerTool(
    'close_trade',
    {
      title: 'Close Trade',
      description: 'Close an open trade with exit data. Triggers chart snapshot capture for the exit session.',
      inputSchema: {
        tradeId: z.string().describe('Trade UUID'),
        exitPrice: z.number().describe('Exit premium per share'),
        closeDate: z.string().describe('Exit datetime (ISO format)'),
        realizedPnl: z.number().describe('Realized P&L in dollars'),
        reflection: z.string().optional(),
        followedPlan: z.boolean().optional(),
        legExitPrices: z.array(z.object({
          legId: z.string(),
          exitPrice: z.number(),
        })).optional().describe('Per-leg exit prices'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (args) => {
      try {
        const existing = db.prepare('SELECT id, status FROM trades WHERE id = ?').get(args.tradeId) as { id: string; status: string } | undefined;
        if (!existing) return { content: [{ type: 'text' as const, text: 'Trade not found' }], isError: true };
        if (existing.status === 'closed') return { content: [{ type: 'text' as const, text: 'Trade is already closed' }], isError: true };

        const close = db.transaction(() => {
          db.prepare(`
            UPDATE trades SET
              status = 'closed', exit_price = ?, close_date = ?, realized_pnl = ?,
              reflection = COALESCE(?, reflection),
              followed_plan = ?,
              updated_at = datetime('now')
            WHERE id = ?
          `).run(
            args.exitPrice, args.closeDate, args.realizedPnl,
            args.reflection ?? null,
            args.followedPlan != null ? (args.followedPlan ? 1 : 0) : null,
            args.tradeId,
          );

          if (args.legExitPrices) {
            const updateLeg = db.prepare('UPDATE trade_legs SET exit_price = ? WHERE id = ? AND trade_id = ?');
            for (const leg of args.legExitPrices) {
              updateLeg.run(leg.exitPrice, leg.legId, args.tradeId);
            }
          }
        });

        close();

        // Capture exit session snapshots and backfill leg underlying prices
        backfillLegUnderlyingPrices(args.tradeId).catch((err) =>
          console.error(`Snapshot capture on close failed: ${err}`)
        );

        const trade = getTradeWithDetails(args.tradeId);
        return { content: [{ type: 'text' as const, text: JSON.stringify(trade, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );
}
