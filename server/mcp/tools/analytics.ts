import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { db } from '../../database';
import { rowToTrade, rowToTradeLeg, rowToTradeTag } from '../../helpers/rowMappers';
import type { TradeLeg, TradeTag } from '../../../shared/types.ts';

export function registerAnalyticsTools(server: McpServer) {
  // --- get_daily_summary ---
  server.registerTool(
    'get_daily_summary',
    {
      title: 'Daily Summary',
      description: 'Get a complete summary of all trades for a specific date including P&L, win/loss, entry quality breakdown, and trade details.',
      inputSchema: {
        date: z.string().describe('Date in YYYY-MM-DD format'),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      try {
        const rows = db.prepare(`
          SELECT * FROM trades
          WHERE date(close_date) = ? OR date(open_date) = ?
          ORDER BY COALESCE(open_date, created_at) ASC
        `).all(args.date, args.date) as Record<string, unknown>[];

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

        const closed = trades.filter(t => t.status === 'closed' && t.realizedPnl != null);
        const wins = closed.filter(t => t.realizedPnl! > 0);
        const losses = closed.filter(t => t.realizedPnl! < 0);
        const totalPnl = closed.reduce((s, t) => s + (t.realizedPnl ?? 0), 0);
        const totalFees = closed.reduce((s, t) => s + (t.fees ?? 0), 0);

        // Entry quality breakdown
        const qualityBreakdown: Record<string, { count: number; pnl: number; wins: number; losses: number }> = {};
        for (const t of closed) {
          const q = t.entryQuality || 'unrated';
          if (!qualityBreakdown[q]) qualityBreakdown[q] = { count: 0, pnl: 0, wins: 0, losses: 0 };
          qualityBreakdown[q].count++;
          qualityBreakdown[q].pnl += t.realizedPnl ?? 0;
          if ((t.realizedPnl ?? 0) > 0) qualityBreakdown[q].wins++;
          else qualityBreakdown[q].losses++;
        }

        const bestTrade = closed.length > 0 ? closed.reduce((b, t) => (t.realizedPnl ?? 0) > (b.realizedPnl ?? 0) ? t : b) : null;
        const worstTrade = closed.length > 0 ? closed.reduce((w, t) => (t.realizedPnl ?? 0) < (w.realizedPnl ?? 0) ? t : w) : null;

        // Followed plan stats
        const planAssessed = closed.filter(t => t.followedPlan != null);
        const planFollowed = planAssessed.filter(t => t.followedPlan === true);

        const summary = {
          date: args.date,
          totalTrades: closed.length,
          wins: wins.length,
          losses: losses.length,
          winRate: closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 0,
          totalPnl: Math.round(totalPnl * 100) / 100,
          totalFees: Math.round(totalFees * 100) / 100,
          netPnl: Math.round((totalPnl - totalFees) * 100) / 100,
          avgWin: wins.length > 0 ? Math.round((wins.reduce((s, t) => s + (t.realizedPnl ?? 0), 0) / wins.length) * 100) / 100 : null,
          avgLoss: losses.length > 0 ? Math.round((losses.reduce((s, t) => s + (t.realizedPnl ?? 0), 0) / losses.length) * 100) / 100 : null,
          bestTrade: bestTrade ? { name: bestTrade.name, pnl: bestTrade.realizedPnl } : null,
          worstTrade: worstTrade ? { name: worstTrade.name, pnl: worstTrade.realizedPnl } : null,
          entryQualityBreakdown: qualityBreakdown,
          followedPlanRate: planAssessed.length > 0 ? Math.round((planFollowed.length / planAssessed.length) * 100) : null,
          trades: trades.map(t => ({
            id: t.id,
            name: t.name,
            underlying: t.underlying,
            strategy: t.strategy,
            side: t.side,
            entryPrice: t.entryPrice,
            exitPrice: t.exitPrice,
            realizedPnl: t.realizedPnl,
            fees: t.fees,
            entryQuality: t.entryQuality,
            followedPlan: t.followedPlan,
            openDate: t.openDate,
            closeDate: t.closeDate,
            thesis: t.thesis,
            tags: t.tags.map(tag => tag.tag),
          })),
        };

        return { content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  // --- get_portfolio_summary ---
  server.registerTool(
    'get_portfolio_summary',
    {
      title: 'Portfolio Summary',
      description: 'Get overall portfolio statistics: open/closed count, total P&L, win rate, fees, followed-plan rate.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
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
          FROM trades WHERE status = 'closed'
        `).get() as { total_pnl: number; total_fees: number; wins: number; losses: number };

        const planStats = db.prepare(`
          SELECT
            COUNT(CASE WHEN followed_plan = 1 THEN 1 END) as followed,
            COUNT(CASE WHEN followed_plan IS NOT NULL THEN 1 END) as assessed
          FROM trades WHERE status = 'closed'
        `).get() as { followed: number; assessed: number };

        const winRate = pnlStats.wins + pnlStats.losses > 0
          ? Math.round((pnlStats.wins / (pnlStats.wins + pnlStats.losses)) * 100)
          : 0;

        const followedPlanRate = planStats.assessed > 0
          ? Math.round((planStats.followed / planStats.assessed) * 100)
          : 0;

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              openTrades: counts.open_trades,
              closedTrades: counts.closed_trades,
              realizedPnl: pnlStats.total_pnl,
              totalFees: pnlStats.total_fees,
              netPnl: Math.round((pnlStats.total_pnl - pnlStats.total_fees) * 100) / 100,
              wins: pnlStats.wins,
              losses: pnlStats.losses,
              winRate,
              followedPlanRate,
            }, null, 2),
          }],
        };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  // --- get_equity_curve ---
  server.registerTool(
    'get_equity_curve',
    {
      title: 'Equity Curve',
      description: 'Get cumulative P&L over time, grouped by date. Useful for charting performance trajectory.',
      inputSchema: {
        dateFrom: z.string().optional().describe('Start date YYYY-MM-DD'),
        dateTo: z.string().optional().describe('End date YYYY-MM-DD'),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      try {
        let query = `
          SELECT
            date(close_date) as date,
            SUM(realized_pnl) as daily_pnl,
            SUM(fees) as daily_fees,
            COUNT(*) as trade_count
          FROM trades
          WHERE status = 'closed' AND close_date IS NOT NULL AND realized_pnl IS NOT NULL
        `;
        const params: unknown[] = [];

        if (args.dateFrom) { query += ' AND date(close_date) >= ?'; params.push(args.dateFrom); }
        if (args.dateTo) { query += ' AND date(close_date) <= ?'; params.push(args.dateTo); }

        query += ' GROUP BY date(close_date) ORDER BY date(close_date) ASC';

        const rows = db.prepare(query).all(...params) as { date: string; daily_pnl: number; daily_fees: number; trade_count: number }[];

        let cumulative = 0;
        const curve = rows.map((row) => {
          cumulative += row.daily_pnl;
          return {
            date: row.date,
            dailyPnl: Math.round(row.daily_pnl * 100) / 100,
            dailyFees: Math.round((row.daily_fees || 0) * 100) / 100,
            cumulativePnl: Math.round(cumulative * 100) / 100,
            tradeCount: row.trade_count,
          };
        });

        return { content: [{ type: 'text' as const, text: JSON.stringify(curve, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  // --- get_analytics ---
  server.registerTool(
    'get_analytics',
    {
      title: 'Trading Analytics',
      description: 'Get detailed breakdowns: P&L by strategy, entry quality, underlying, and monthly. Includes profit factor, avg win/loss, avg hold time.',
      inputSchema: {
        dateFrom: z.string().optional().describe('Start date YYYY-MM-DD'),
        dateTo: z.string().optional().describe('End date YYYY-MM-DD'),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      try {
        const dateFilter = [];
        const dateParams: unknown[] = [];
        if (args.dateFrom) { dateFilter.push('date(close_date) >= ?'); dateParams.push(args.dateFrom); }
        if (args.dateTo) { dateFilter.push('date(close_date) <= ?'); dateParams.push(args.dateTo); }
        const dateWhere = dateFilter.length > 0 ? ' AND ' + dateFilter.join(' AND ') : '';

        const pnlByUnderlying = db.prepare(`
          SELECT underlying, asset_type as assetType, SUM(realized_pnl) as pnl, COUNT(*) as tradeCount
          FROM trades WHERE status = 'closed'${dateWhere}
          GROUP BY underlying, asset_type ORDER BY SUM(realized_pnl) DESC
        `).all(...dateParams);

        const pnlByStrategy = db.prepare(`
          SELECT strategy, SUM(realized_pnl) as pnl, COUNT(*) as tradeCount,
            CASE WHEN COUNT(CASE WHEN realized_pnl IS NOT NULL THEN 1 END) > 0
              THEN CAST(COUNT(CASE WHEN realized_pnl > 0 THEN 1 END) AS REAL) / COUNT(CASE WHEN realized_pnl IS NOT NULL THEN 1 END) * 100
              ELSE 0 END as winRate
          FROM trades WHERE status = 'closed'${dateWhere}
          GROUP BY strategy ORDER BY SUM(realized_pnl) DESC
        `).all(...dateParams);

        const pnlByEntryQuality = db.prepare(`
          SELECT COALESCE(entry_quality, 'unrated') as entryQuality,
            SUM(realized_pnl) as pnl, COUNT(*) as tradeCount,
            CASE WHEN COUNT(CASE WHEN realized_pnl IS NOT NULL THEN 1 END) > 0
              THEN CAST(COUNT(CASE WHEN realized_pnl > 0 THEN 1 END) AS REAL) / COUNT(CASE WHEN realized_pnl IS NOT NULL THEN 1 END) * 100
              ELSE 0 END as winRate
          FROM trades WHERE status = 'closed'${dateWhere}
          GROUP BY COALESCE(entry_quality, 'unrated') ORDER BY SUM(realized_pnl) DESC
        `).all(...dateParams);

        const monthlyPnl = db.prepare(`
          SELECT strftime('%Y-%m', close_date) as month, SUM(realized_pnl) as pnl,
            COUNT(CASE WHEN realized_pnl > 0 THEN 1 END) as wins,
            COUNT(CASE WHEN realized_pnl < 0 THEN 1 END) as losses
          FROM trades WHERE status = 'closed' AND close_date IS NOT NULL${dateWhere}
          GROUP BY strftime('%Y-%m', close_date) ORDER BY month ASC
        `).all(...dateParams);

        const bestTrade = db.prepare(`
          SELECT realized_pnl as pnl, close_date as date, underlying, name
          FROM trades WHERE status = 'closed' AND realized_pnl IS NOT NULL${dateWhere}
          ORDER BY realized_pnl DESC LIMIT 1
        `).get(...dateParams);

        const worstTrade = db.prepare(`
          SELECT realized_pnl as pnl, close_date as date, underlying, name
          FROM trades WHERE status = 'closed' AND realized_pnl IS NOT NULL${dateWhere}
          ORDER BY realized_pnl ASC LIMIT 1
        `).get(...dateParams);

        const avgStats = db.prepare(`
          SELECT
            AVG(CASE WHEN realized_pnl > 0 THEN realized_pnl END) as avg_win,
            AVG(CASE WHEN realized_pnl < 0 THEN realized_pnl END) as avg_loss,
            SUM(CASE WHEN realized_pnl > 0 THEN realized_pnl ELSE 0 END) as total_wins,
            ABS(SUM(CASE WHEN realized_pnl < 0 THEN realized_pnl ELSE 0 END)) as total_losses
          FROM trades WHERE status = 'closed'${dateWhere}
        `).get(...dateParams) as { avg_win: number | null; avg_loss: number | null; total_wins: number; total_losses: number };

        const avgHoldTime = db.prepare(`
          SELECT AVG(julianday(close_date) - julianday(open_date)) as avg_days
          FROM trades WHERE status = 'closed' AND close_date IS NOT NULL AND open_date IS NOT NULL${dateWhere}
        `).get(...dateParams) as { avg_days: number | null };

        const profitFactor = avgStats.total_losses > 0
          ? Math.round((avgStats.total_wins / avgStats.total_losses) * 100) / 100
          : avgStats.total_wins > 0 ? Infinity : 0;

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              pnlByUnderlying,
              pnlByStrategy,
              pnlByEntryQuality,
              monthlyPnl,
              bestTrade: bestTrade || null,
              worstTrade: worstTrade || null,
              avgWin: avgStats.avg_win ? Math.round(avgStats.avg_win * 100) / 100 : null,
              avgLoss: avgStats.avg_loss ? Math.round(avgStats.avg_loss * 100) / 100 : null,
              profitFactor,
              avgHoldDays: avgHoldTime.avg_days ? Math.round(avgHoldTime.avg_days * 100) / 100 : null,
            }, null, 2),
          }],
        };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );
}
