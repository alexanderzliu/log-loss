import { Router } from 'express';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';
import { rowToChartSnapshot } from '../helpers/rowMappers';
import { fetchMultipleIntraday, buildOccTicker } from '../helpers/yahooIntraday';
import { computeIndicators, generateTheoreticalBars } from '../helpers/indicators';
import type { Trade, TradeLeg } from '../../shared/types.ts';
import { rowToTrade, rowToTradeLeg } from '../helpers/rowMappers';

const router = Router({ mergeParams: true });

// Helper: get trade with legs for capture
function getTradeForCapture(tradeId: string): (Trade & { legs: TradeLeg[] }) | null {
  const row = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId) as Record<string, unknown> | undefined;
  if (!row) return null;

  const trade = rowToTrade(row);
  const legRows = db.prepare(
    'SELECT * FROM trade_legs WHERE trade_id = ? ORDER BY rowid ASC'
  ).all(tradeId) as Record<string, unknown>[];
  trade.legs = legRows.map(rowToTradeLeg);

  return trade;
}

// Helper: determine what date to capture for a trade
function getCaptureDate(trade: Trade): string | null {
  // Use open_date if available, otherwise today
  if (trade.openDate) {
    // openDate might be 'YYYY-MM-DDTHH:MM' or 'YYYY-MM-DD'
    return trade.openDate.slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * Capture chart snapshots for a trade. Used by both the route handler and auto-capture hooks.
 */
export async function captureSnapshotsForTrade(tradeId: string, targetDate?: string): Promise<{
  captured: string[];
  theoretical: string[];
  failed: string[];
}> {
  const trade = getTradeForCapture(tradeId);
  if (!trade) throw new Error('Trade not found');

  const date = targetDate || getCaptureDate(trade);
  if (!date) throw new Error('Could not determine capture date');

  // Build list of symbols to capture
  const symbols: { symbol: string; type: 'underlying' | 'option'; legId?: string; leg?: TradeLeg }[] = [];

  // Always capture the underlying
  symbols.push({ symbol: trade.underlying.toUpperCase(), type: 'underlying' });

  // Capture each option leg
  for (const leg of trade.legs) {
    if (leg.optionType && leg.strike && leg.expiration) {
      const occTicker = buildOccTicker(
        trade.underlying,
        leg.expiration,
        leg.optionType,
        leg.strike,
      );
      symbols.push({ symbol: occTicker, type: 'option', legId: leg.id, leg });
    }
  }

  // Fetch real bars from Yahoo (sequential with rate limiting)
  const allSymbolNames = symbols.map((s) => s.symbol);
  const results = await fetchMultipleIntraday(allSymbolNames, date);

  const captured: string[] = [];
  const theoretical: string[] = [];
  const failed: string[] = [];

  // Get the underlying bars for theoretical fallback
  const underlyingResult = results.get(trade.underlying.toUpperCase());

  const upsert = db.prepare(`
    INSERT OR REPLACE INTO chart_snapshots
      (id, trade_id, leg_id, symbol, symbol_type, trade_date, bars, indicators, source, bar_count, captured_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  for (const sym of symbols) {
    const result = results.get(sym.symbol);

    if (result && result.bars.length > 0) {
      // Real data from Yahoo
      const indicators = computeIndicators(result.bars);
      const existingId = getExistingSnapshotId(tradeId, sym.symbol, result.tradingDate);

      upsert.run(
        existingId || uuidv4(),
        tradeId,
        sym.legId || null,
        sym.symbol,
        sym.type,
        result.tradingDate,
        JSON.stringify(result.bars),
        JSON.stringify(indicators),
        'yahoo',
        result.bars.length,
      );

      captured.push(sym.symbol);
    } else if (sym.type === 'option' && underlyingResult && sym.leg) {
      // Theoretical fallback for options
      const leg = sym.leg;
      if (leg.iv && leg.strike && leg.expiration && leg.optionType) {
        const theoBars = generateTheoreticalBars(
          underlyingResult.bars,
          leg.strike,
          leg.expiration,
          leg.optionType,
          leg.iv,
        );
        const indicators = computeIndicators(theoBars);
        const existingId = getExistingSnapshotId(tradeId, sym.symbol, underlyingResult.tradingDate);

        upsert.run(
          existingId || uuidv4(),
          tradeId,
          sym.legId || null,
          sym.symbol,
          sym.type,
          underlyingResult.tradingDate,
          JSON.stringify(theoBars),
          JSON.stringify(indicators),
          'theoretical',
          theoBars.length,
        );

        theoretical.push(sym.symbol);
      } else {
        failed.push(sym.symbol);
      }
    } else {
      failed.push(sym.symbol);
    }
  }

  return { captured, theoretical, failed };
}

function getExistingSnapshotId(tradeId: string, symbol: string, tradeDate: string): string | null {
  const row = db.prepare(
    'SELECT id FROM chart_snapshots WHERE trade_id = ? AND symbol = ? AND trade_date = ?'
  ).get(tradeId, symbol, tradeDate) as { id: string } | undefined;
  return row?.id || null;
}

// --- Routes ---

// POST /capture - Capture chart snapshots for a trade
router.post('/capture', async (req, res) => {
  try {
    const { tradeId } = req.params;
    const { tradeDate } = req.body || {};

    const result = await captureSnapshotsForTrade(tradeId, tradeDate);

    // Return the stored snapshots
    const snapshots = db.prepare(
      'SELECT * FROM chart_snapshots WHERE trade_id = ? ORDER BY symbol_type ASC, symbol ASC'
    ).all(tradeId) as Record<string, unknown>[];

    res.json({
      snapshots: snapshots.map(rowToChartSnapshot),
      status: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to capture snapshots';
    console.error('Error capturing snapshots:', error);
    if (message.includes('not found')) {
      return res.status(404).json({ error: message });
    }
    res.status(500).json({ error: 'Failed to capture chart data' });
  }
});

// GET / - Get all snapshots for a trade
router.get('/', (req, res) => {
  try {
    const { tradeId } = req.params;

    const rows = db.prepare(
      'SELECT * FROM chart_snapshots WHERE trade_id = ? ORDER BY symbol_type ASC, symbol ASC'
    ).all(tradeId) as Record<string, unknown>[];

    res.json(rows.map(rowToChartSnapshot));
  } catch (error) {
    console.error('Error fetching snapshots:', error);
    res.status(500).json({ error: 'Failed to fetch chart data' });
  }
});

// DELETE /:snapshotId - Delete a specific snapshot
router.delete('/:snapshotId', (req, res) => {
  try {
    const { tradeId, snapshotId } = req.params;

    const result = db.prepare(
      'DELETE FROM chart_snapshots WHERE id = ? AND trade_id = ?'
    ).run(snapshotId, tradeId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting snapshot:', error);
    res.status(500).json({ error: 'Failed to delete snapshot' });
  }
});

export default router;
