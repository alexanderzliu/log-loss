import { z } from 'zod';
import { readFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { db } from '../../database';
import { getTradeWithDetails, findUnderlyingPrice } from '../../helpers/tradeQueries';
import { captureSnapshotsForTrade } from '../../routes/snapshots';
import { parseFidelityCsv, pairOrders, type PairedTrade } from '../helpers/csvParser';

/**
 * Generate a descriptive trade name from parsed data.
 * e.g., "SPY 1DTE 647C" or "SPY 0DTE 641P"
 */
function generateTradeName(trade: PairedTrade): string {
  const entryDate = trade.entryTime.slice(0, 10);
  const expDate = trade.expiration;

  // Calculate DTE
  const entry = new Date(entryDate);
  const exp = new Date(expDate);
  const dte = Math.round((exp.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24));

  const typeChar = trade.optionType === 'call' ? 'C' : 'P';
  return `${trade.underlying} ${dte}DTE ${trade.strike}${typeChar}`;
}

export function registerImportTools(server: McpServer) {
  // --- parse_fidelity_csv ---
  server.registerTool(
    'parse_fidelity_csv',
    {
      title: 'Parse Fidelity CSV',
      description: 'Parse a Fidelity Active Trader Pro CSV export. Pairs BTO/STC orders into trades and computes P&L. Does NOT create any trades — returns parsed data for interactive review.',
      inputSchema: {
        filePath: z.string().optional().describe('Path to the CSV file on disk'),
        csvText: z.string().optional().describe('Raw CSV text content (alternative to filePath)'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async (args) => {
      let csv: string;
      if (args.csvText) {
        csv = args.csvText;
      } else if (args.filePath) {
        try {
          csv = readFileSync(args.filePath, 'utf-8');
        } catch (e) {
          return { content: [{ type: 'text' as const, text: `Error reading file: ${(e as Error).message}` }], isError: true };
        }
      } else {
        return { content: [{ type: 'text' as const, text: 'Error: Provide either filePath or csvText' }], isError: true };
      }

      const { orders, skippedRows } = parseFidelityCsv(csv);
      if (orders.length === 0) {
        return { content: [{ type: 'text' as const, text: `No filled orders found in CSV. Skipped: ${skippedRows.join('; ')}` }], isError: true };
      }

      const result = pairOrders(orders);

      // Build summary
      const totalPnl = result.trades.reduce((s, t) => s + t.realizedPnl, 0);
      const totalFees = result.trades.reduce((s, t) => s + t.fees, 0);
      const wins = result.trades.filter(t => t.realizedPnl > 0).length;
      const losses = result.trades.filter(t => t.realizedPnl < 0).length;
      const breakeven = result.trades.filter(t => t.realizedPnl === 0).length;
      const date = result.trades[0]?.entryTime.slice(0, 10) || 'unknown';

      const output = {
        date,
        summary: {
          tradeCount: result.trades.length,
          wins,
          losses,
          breakeven,
          totalPnlBeforeFees: Math.round(totalPnl * 100) / 100,
          totalFees: Math.round(totalFees * 100) / 100,
          netPnl: Math.round((totalPnl - totalFees) * 100) / 100,
        },
        trades: result.trades.map((t, i) => ({
          index: i + 1,
          name: generateTradeName(t),
          ...t,
          netPnl: Math.round((t.realizedPnl - t.fees) * 100) / 100,
        })),
        orphanedOrders: result.orphanedOrders.length > 0
          ? result.orphanedOrders.map(o => `${o.action} ${o.symbol} at $${o.fillPrice} (${o.orderTime})`)
          : undefined,
        skippedRows: [...skippedRows, ...result.skippedRows].length > 0
          ? [...skippedRows, ...result.skippedRows]
          : undefined,
      };

      return { content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }] };
    },
  );

  // --- create_trade ---
  server.registerTool(
    'create_trade',
    {
      title: 'Create Trade',
      description: 'Create a fully-closed trade with option leg, tags, and metadata. Auto-calculates fees and triggers chart snapshot capture with underlying price backfill.',
      inputSchema: {
        name: z.string().optional().describe('Trade name (auto-generated if omitted)'),
        underlying: z.string().describe('Underlying symbol (e.g., SPY)'),
        strategy: z.enum(['long', 'short', 'debit_spread', 'credit_spread', 'iron_condor', 'straddle', 'strangle', 'custom']).default('long'),
        side: z.enum(['buy', 'sell']).default('buy'),
        quantity: z.number().int().positive().default(1),
        entryPrice: z.number().describe('Entry premium per share'),
        exitPrice: z.number().describe('Exit premium per share'),
        openDate: z.string().describe('Entry datetime (ISO format)'),
        closeDate: z.string().describe('Exit datetime (ISO format)'),
        realizedPnl: z.number().describe('Realized P&L in dollars'),
        entryQuality: z.enum(['clean', 'fomo', 'chased', 'intuitive']).optional(),
        followedPlan: z.boolean().optional(),
        thesis: z.string().default(''),
        exitPlan: z.string().default(''),
        reflection: z.string().default(''),
        notes: z.string().default(''),
        leg: z.object({
          ticker: z.string().describe('OCC symbol'),
          optionType: z.enum(['call', 'put']),
          strike: z.number(),
          expiration: z.string().describe('YYYY-MM-DD'),
          side: z.enum(['buy', 'sell']).default('buy'),
          quantity: z.number().int().positive().default(1),
          entryPrice: z.number(),
          exitPrice: z.number(),
        }),
        tags: z.array(z.object({
          tag: z.string(),
          category: z.string().optional(),
        })).default([]),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (args) => {
      try {
        const tradeId = uuidv4();
        const legId = uuidv4();
        const fees = args.quantity * 1.30;

        // Auto-generate name if not provided
        const name = args.name || (() => {
          const entryDate = args.openDate.slice(0, 10);
          const expDate = args.leg.expiration;
          const entry = new Date(entryDate);
          const exp = new Date(expDate);
          const dte = Math.round((exp.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24));
          const typeChar = args.leg.optionType === 'call' ? 'C' : 'P';
          return `${args.underlying.toUpperCase()} ${dte}DTE ${args.leg.strike}${typeChar}`;
        })();

        const create = db.transaction(() => {
          db.prepare(`
            INSERT INTO trades (
              id, name, asset_type, underlying, status, strategy, side, quantity,
              entry_price, exit_price, fees, realized_pnl, open_date, close_date,
              entry_quality, followed_plan, thesis, exit_plan, reflection, notes
            ) VALUES (?, ?, 'option', ?, 'closed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            tradeId, name, args.underlying.toUpperCase(), args.strategy, args.side,
            args.quantity, args.entryPrice, args.exitPrice, fees, args.realizedPnl,
            args.openDate, args.closeDate,
            args.entryQuality ?? null,
            args.followedPlan != null ? (args.followedPlan ? 1 : 0) : null,
            args.thesis, args.exitPlan, args.reflection, args.notes,
          );

          db.prepare(`
            INSERT INTO trade_legs (
              id, trade_id, ticker, option_type, strike, expiration, side, quantity,
              entry_price, exit_price
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            legId, tradeId, args.leg.ticker, args.leg.optionType,
            args.leg.strike, args.leg.expiration, args.leg.side, args.leg.quantity,
            args.leg.entryPrice, args.leg.exitPrice,
          );

          if (args.tags.length > 0) {
            const insertTag = db.prepare(
              'INSERT OR IGNORE INTO trade_tags (id, trade_id, tag, category) VALUES (?, ?, ?, ?)'
            );
            for (const t of args.tags) {
              insertTag.run(uuidv4(), tradeId, t.tag, t.category ?? null);
            }
          }
        });

        create();

        // Capture chart snapshots and backfill underlying prices
        let snapshotStatus = 'pending';
        try {
          const captureDate = args.closeDate.slice(0, 10);
          await captureSnapshotsForTrade(tradeId, captureDate);

          // Backfill underlying prices from snapshot bars
          const entryUnderlying = findUnderlyingPrice(tradeId, args.underlying, args.openDate);
          const exitUnderlying = findUnderlyingPrice(tradeId, args.underlying, args.closeDate);

          if (entryUnderlying !== null || exitUnderlying !== null) {
            db.prepare(
              'UPDATE trade_legs SET entry_underlying_price = ?, exit_underlying_price = ? WHERE id = ?'
            ).run(entryUnderlying, exitUnderlying, legId);
          }

          snapshotStatus = 'captured';
        } catch (e) {
          console.error('Snapshot capture failed (non-fatal):', e);
          snapshotStatus = `failed: ${(e as Error).message}`;
        }

        const trade = getTradeWithDetails(tradeId);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ trade, snapshotStatus }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error creating trade: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  // --- batch_create_trades ---
  server.registerTool(
    'batch_create_trades',
    {
      title: 'Batch Create Trades',
      description: 'Create multiple fully-closed trades at once. Deduplicates chart snapshot captures (fetches each underlying once). Much faster than calling create_trade in a loop for CSV imports.',
      inputSchema: {
        trades: z.array(z.object({
          name: z.string().optional(),
          underlying: z.string(),
          strategy: z.enum(['long', 'short', 'debit_spread', 'credit_spread', 'iron_condor', 'straddle', 'strangle', 'custom']).default('long'),
          side: z.enum(['buy', 'sell']).default('buy'),
          quantity: z.number().int().positive().default(1),
          entryPrice: z.number(),
          exitPrice: z.number(),
          openDate: z.string(),
          closeDate: z.string(),
          realizedPnl: z.number(),
          entryQuality: z.enum(['clean', 'fomo', 'chased', 'intuitive']).optional(),
          followedPlan: z.boolean().optional(),
          thesis: z.string().default(''),
          exitPlan: z.string().default(''),
          reflection: z.string().default(''),
          notes: z.string().default(''),
          leg: z.object({
            ticker: z.string(),
            optionType: z.enum(['call', 'put']),
            strike: z.number(),
            expiration: z.string(),
            side: z.enum(['buy', 'sell']).default('buy'),
            quantity: z.number().int().positive().default(1),
            entryPrice: z.number(),
            exitPrice: z.number(),
          }),
          tags: z.array(z.object({
            tag: z.string(),
            category: z.string().optional(),
          })).default([]),
        })),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (args) => {
      try {
        const tradeRecords: { tradeId: string; legId: string; data: typeof args.trades[0] }[] = [];

        // Create all trades in a single transaction
        const create = db.transaction(() => {
          for (const t of args.trades) {
            const tradeId = uuidv4();
            const legId = uuidv4();
            const fees = t.quantity * 1.30;

            const name = t.name || (() => {
              const entryDate = t.openDate.slice(0, 10);
              const expDate = t.leg.expiration;
              const entry = new Date(entryDate);
              const exp = new Date(expDate);
              const dte = Math.round((exp.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24));
              const typeChar = t.leg.optionType === 'call' ? 'C' : 'P';
              return `${t.underlying.toUpperCase()} ${dte}DTE ${t.leg.strike}${typeChar}`;
            })();

            db.prepare(`
              INSERT INTO trades (
                id, name, asset_type, underlying, status, strategy, side, quantity,
                entry_price, exit_price, fees, realized_pnl, open_date, close_date,
                entry_quality, followed_plan, thesis, exit_plan, reflection, notes
              ) VALUES (?, ?, 'option', ?, 'closed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              tradeId, name, t.underlying.toUpperCase(), t.strategy, t.side,
              t.quantity, t.entryPrice, t.exitPrice, fees, t.realizedPnl,
              t.openDate, t.closeDate,
              t.entryQuality ?? null,
              t.followedPlan != null ? (t.followedPlan ? 1 : 0) : null,
              t.thesis, t.exitPlan, t.reflection, t.notes,
            );

            db.prepare(`
              INSERT INTO trade_legs (
                id, trade_id, ticker, option_type, strike, expiration, side, quantity,
                entry_price, exit_price
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              legId, tradeId, t.leg.ticker, t.leg.optionType,
              t.leg.strike, t.leg.expiration, t.leg.side, t.leg.quantity,
              t.leg.entryPrice, t.leg.exitPrice,
            );

            if (t.tags.length > 0) {
              const insertTag = db.prepare(
                'INSERT OR IGNORE INTO trade_tags (id, trade_id, tag, category) VALUES (?, ?, ?, ?)'
              );
              for (const tag of t.tags) {
                insertTag.run(uuidv4(), tradeId, tag.tag, tag.category ?? null);
              }
            }

            tradeRecords.push({ tradeId, legId, data: t });
          }
        });

        create();

        // Capture snapshots — deduplicate by underlying+date
        const capturedSnapshots = new Set<string>();
        let snapshotsFailed = 0;

        for (const rec of tradeRecords) {
          const captureDate = rec.data.closeDate.slice(0, 10);
          const key = `${rec.data.underlying.toUpperCase()}:${captureDate}`;

          try {
            // Only capture if we haven't already for this underlying+date via another trade
            if (!capturedSnapshots.has(key)) {
              await captureSnapshotsForTrade(rec.tradeId, captureDate);
              capturedSnapshots.add(key);
            } else {
              // For subsequent trades on same underlying+date, still capture the option leg
              await captureSnapshotsForTrade(rec.tradeId, captureDate);
            }

            // Backfill underlying prices
            const entryUnderlying = findUnderlyingPrice(rec.tradeId, rec.data.underlying, rec.data.openDate);
            const exitUnderlying = findUnderlyingPrice(rec.tradeId, rec.data.underlying, rec.data.closeDate);

            if (entryUnderlying !== null || exitUnderlying !== null) {
              db.prepare(
                'UPDATE trade_legs SET entry_underlying_price = ?, exit_underlying_price = ? WHERE id = ?'
              ).run(entryUnderlying, exitUnderlying, rec.legId);
            }
          } catch {
            snapshotsFailed++;
          }
        }

        const createdTrades = tradeRecords.map(r => getTradeWithDetails(r.tradeId));

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              created: createdTrades.length,
              snapshotsCaptured: capturedSnapshots.size,
              snapshotsFailed,
              trades: createdTrades,
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error in batch create: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
