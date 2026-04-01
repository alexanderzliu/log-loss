/**
 * One-shot import of trades from Notion CSV export into SQLite.
 * Run: npx tsx server/scripts/importNotion.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- CSV Parsing ---

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (line[i] === ',' && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += line[i];
    }
  }
  result.push(current);
  return result;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split('\n');
  const headers = parseCSVLine(lines[0].replace(/^\ufeff/, ''));
  const rows: Record<string, string>[] = [];
  let i = 1;
  while (i < lines.length) {
    let line = lines[i];
    // Handle multiline quoted fields
    while (line && (line.match(/"/g) || []).length % 2 !== 0 && i + 1 < lines.length) {
      i++;
      line += '\n' + lines[i];
    }
    if (line.trim()) {
      const fields = parseCSVLine(line);
      if (fields.some(f => f.trim())) {
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => obj[h.trim()] = (fields[idx] || '').trim());
        rows.push(obj);
      }
    }
    i++;
  }
  return rows;
}

// --- Value Parsers ---

const MONTHS: Record<string, string> = {
  'January': '01', 'February': '02', 'March': '03', 'April': '04',
  'May': '05', 'June': '06', 'July': '07', 'August': '08',
  'September': '09', 'October': '10', 'November': '11', 'December': '12',
};

function parseDate(s: string): string | null {
  if (!s) return null;
  // "March 10, 2026" → "2026-03-10"
  const match = s.match(/^(\w+)\s+(\d{1,2}),?\s*(\d{4})$/);
  if (match) {
    const month = MONTHS[match[1]];
    if (!month) return null;
    return `${match[3]}-${month}-${match[2].padStart(2, '0')}`;
  }
  return null;
}

function parseMoney(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function mapAssetType(s: string): string {
  const lower = s.toLowerCase();
  if (lower === 'option') return 'option';
  if (lower === 'futures') return 'futures';
  if (lower === 'stock') return 'stock';
  return 'option';
}

function mapStrategy(s: string): string {
  const lower = s.toLowerCase();
  if (lower === 'debit spread') return 'debit_spread';
  if (lower === 'credit spread') return 'credit_spread';
  if (lower === 'long') return 'long';
  if (lower === 'short') return 'short';
  if (lower === 'other') return 'custom';
  return 'long';
}

function mapStatus(s: string): string {
  const lower = s.toLowerCase();
  if (lower === 'closed') return 'closed';
  return 'open'; // Open and Planned both map to open
}

function mapEntryQuality(s: string): string | null {
  if (!s) return null;
  const lower = s.toLowerCase();
  if (['clean', 'fomo', 'chased', 'intuitive'].includes(lower)) return lower;
  return null;
}

function mapSide(s: string): string {
  return s.toLowerCase() === 'sell' ? 'sell' : 'buy';
}

// --- Underlying & Leg Extraction ---

function extractUnderlying(ticker: string): string {
  if (!ticker) return '';
  // OCC codes: SPY260326C651 → SPY
  const occMatch = ticker.match(/^([A-Z]{1,5})\d{6}[CP]\d+$/);
  if (occMatch) return occMatch[1];
  // "NOL (Coinbase Nano Oil)" → NOL
  // "MCL (Coinbase Nano WTI)" → MCL
  // "SPY 3/25 $658C" → SPY
  return ticker.split(/[\s(]/)[0].toUpperCase();
}

interface LegInfo {
  ticker: string;
  optionType: 'call' | 'put' | null;
  strike: number | null;
  expiration: string | null;
  side: string;
  quantity: number;
  entryPrice: number | null;
  exitPrice: number | null;
}

function parseOCCTicker(ticker: string): { underlying: string; expiration: string; optionType: 'call' | 'put'; strike: number } | null {
  // SPY260326C651 → { underlying: SPY, expiration: 2026-03-26, optionType: call, strike: 651 }
  const match = ticker.match(/^([A-Z]{1,5})(\d{2})(\d{2})(\d{2})([CP])(\d+)$/);
  if (!match) return null;
  return {
    underlying: match[1],
    expiration: `20${match[2]}-${match[3]}-${match[4]}`,
    optionType: match[5] === 'C' ? 'call' : 'put',
    strike: parseFloat(match[6]),
  };
}

function parseSingleLegFromName(name: string, ticker: string): { optionType: 'call' | 'put' | null; strike: number | null; expiration: string | null } {
  // Try OCC ticker first
  const occ = parseOCCTicker(ticker);
  if (occ) return { optionType: occ.optionType, strike: occ.strike, expiration: occ.expiration };

  // "SPY 0DTE 669P" → put, 669
  // "SPY 1DTE 659P" → put, 659
  // "MU Mar 20 $460 Call" → call, 460
  // "JETS Put $23.50 Mar 27" → put, 23.50
  // "NVDA 190C" → call, 190

  let optionType: 'call' | 'put' | null = null;
  let strike: number | null = null;
  let expiration: string | null = null;

  // Detect call/put from name
  if (/\bCall\b/i.test(name) || /\d+C\b/.test(name) || /\$[\d.]+C\b/.test(name)) optionType = 'call';
  if (/\bPut\b/i.test(name) || /\d+P\b/.test(name) || /\$[\d.]+P\b/.test(name)) optionType = 'put';

  // Extract strike: "$460", "$23.50", "669P", "651C", "$658C", "$657P", "$700 May Call", "Put $23.50"
  const strikeMatch = name.match(/\$?([\d.]+)\s*(?:C|P|Call|Put)/i)
    || name.match(/(?:Call|Put)\s+\$?([\d.]+)/i)
    || name.match(/\$([\d.]+)\s+\w+\s+(?:Call|Put)/i)
    || name.match(/(?:strike|DTE)\s+\$?([\d.]+)/i)
    || name.match(/\b(\d+(?:\.\d+)?)[CP]\b/);
  if (strikeMatch) strike = parseFloat(strikeMatch[1]);

  // Extract expiration from name: "Mar 27", "Mar 20", "Apr 17", "July"
  const expMatch = name.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{1,2})\b/i);
  if (expMatch) {
    const monthName = expMatch[1].toLowerCase();
    const monthMap: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const m = monthMap[monthName.slice(0, 3)];
    if (m) expiration = `2026-${m}-${expMatch[2].padStart(2, '0')}`;
  }

  // Also try ticker for expiration: "SPY 3/25 $658C" → 2026-03-25
  const tickerExpMatch = ticker.match(/(\d{1,2})\/(\d{1,2})/);
  if (tickerExpMatch && !expiration) {
    expiration = `2026-${tickerExpMatch[1].padStart(2, '0')}-${tickerExpMatch[2].padStart(2, '0')}`;
  }

  return { optionType, strike, expiration };
}

function parseSpreadLegs(name: string, notes: string, assetType: string): { longStrike: number | null; shortStrike: number | null; optionType: 'call' | 'put' | null; expiration: string | null } {
  // "USO Bull Call Debit Spread $112/$122 Mar 27" → 112, 122, call
  // "MU Bull Call Spread $390/$400 July" → 390, 400, call
  // "SPY Bear Put Debit Spread $670/$640 Apr 17" → 670, 640, put

  let longStrike: number | null = null;
  let shortStrike: number | null = null;
  let optionType: 'call' | 'put' | null = null;
  let expiration: string | null = null;

  // Detect type from name
  if (/\bCall\b/i.test(name)) optionType = 'call';
  if (/\bPut\b/i.test(name)) optionType = 'put';

  // Extract strikes from "$STRIKE1/$STRIKE2" pattern in name
  const strikeMatch = name.match(/\$(\d+(?:\.\d+)?)\s*\/\s*\$(\d+(?:\.\d+)?)/);
  if (strikeMatch) {
    const s1 = parseFloat(strikeMatch[1]);
    const s2 = parseFloat(strikeMatch[2]);
    // For bull call: buy lower, sell higher
    // For bear put: buy higher, sell lower
    if (optionType === 'call') {
      longStrike = Math.min(s1, s2);
      shortStrike = Math.max(s1, s2);
    } else {
      longStrike = Math.max(s1, s2);
      shortStrike = Math.min(s1, s2);
    }
  }

  // If not found in name, try notes: "Buy SPY Apr 17 $670P / Sell SPY Apr 17 $640P"
  if (!strikeMatch && notes) {
    const notesStrikeMatch = notes.match(/\$(\d+(?:\.\d+)?)[CP]?\s*\/\s*(?:Sell\s+\w+\s+[\w\s]+)?\$(\d+(?:\.\d+)?)/i);
    if (notesStrikeMatch) {
      const s1 = parseFloat(notesStrikeMatch[1]);
      const s2 = parseFloat(notesStrikeMatch[2]);
      if (optionType === 'call') {
        longStrike = Math.min(s1, s2);
        shortStrike = Math.max(s1, s2);
      } else {
        longStrike = Math.max(s1, s2);
        shortStrike = Math.min(s1, s2);
      }
    }
  }

  // Extract expiration from name
  const expMatch = name.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{1,2})\b/i);
  if (expMatch) {
    const monthMap: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const m = monthMap[expMatch[1].toLowerCase().slice(0, 3)];
    if (m) expiration = `2026-${m}-${expMatch[2].padStart(2, '0')}`;
  } else {
    // "July" without a day
    const monthOnly = name.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i);
    if (monthOnly) {
      const m = MONTHS[monthOnly[1].charAt(0).toUpperCase() + monthOnly[1].slice(1).toLowerCase()];
      if (m) expiration = `2026-${m}-01`; // Default to 1st of month
    }
  }

  return { longStrike, shortStrike, optionType, expiration };
}

// --- Main Import ---

function importTrades() {
  const csvPath = path.join(__dirname, '../../notion-trade-journal/Trade Log 7e87d38b1edd4506b0ae5a4336b070a3_all.csv');
  const csvText = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(csvText);

  console.log(`Parsed ${rows.length} rows from CSV\n`);

  // Deduplicate: "SPY Bear Put Spread (Apr 17)" (Open) is the same trade as
  // "SPY Bear Put Debit Spread $670/$640 Apr 17" (Closed). Merge them.
  const spyBearPutOpen = rows.findIndex(r => r.Trade === 'SPY Bear Put Spread (Apr 17)' && r.Status === 'Open');
  const spyBearPutClosed = rows.findIndex(r => r.Trade === 'SPY Bear Put Debit Spread $670/$640 Apr 17' && r.Status === 'Closed');

  if (spyBearPutOpen >= 0 && spyBearPutClosed >= 0) {
    // Merge open date and entry quality from the open row into the closed row
    const openRow = rows[spyBearPutOpen];
    const closedRow = rows[spyBearPutClosed];
    if (!closedRow['Open Date'] && openRow['Open Date']) {
      closedRow['Open Date'] = openRow['Open Date'];
    }
    if (!closedRow['Entry Quality'] && openRow['Entry Quality']) {
      closedRow['Entry Quality'] = openRow['Entry Quality'];
    }
    // Merge notes
    if (openRow.Notes && closedRow.Notes) {
      closedRow.Notes = openRow.Notes + '\n\n---\n\n' + closedRow.Notes;
    } else if (openRow.Notes && !closedRow.Notes) {
      closedRow.Notes = openRow.Notes;
    }
    // Use the more descriptive name
    closedRow.Trade = 'SPY Bear Put Debit Spread $670/$640 Apr 17';
    // Remove the open row
    rows.splice(spyBearPutOpen, 1);
    console.log('Merged duplicate SPY Bear Put Spread rows\n');
  }

  // Filter out empty rows
  const validRows = rows.filter(r => r.Trade && r.Trade.trim());
  console.log(`${validRows.length} valid trades to import\n`);

  const insertTrade = db.prepare(`
    INSERT INTO trades (
      id, name, asset_type, underlying, status, strategy, side, quantity,
      entry_price, exit_price, fees, realized_pnl, open_date, close_date,
      entry_quality, followed_plan, thesis, exit_plan, reflection, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertLeg = db.prepare(`
    INSERT INTO trade_legs (
      id, trade_id, ticker, option_type, strike, expiration, side, quantity,
      entry_price, exit_price, entry_underlying_price, exit_underlying_price,
      delta, gamma, theta, vega, iv
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTag = db.prepare(`
    INSERT OR IGNORE INTO trade_tags (id, trade_id, tag, category)
    VALUES (?, ?, ?, ?)
  `);

  let imported = 0;
  const warnings: string[] = [];

  const doImport = db.transaction(() => {
    for (const row of validRows) {
      const tradeId = uuidv4();
      const name = row.Trade;
      const assetType = mapAssetType(row['Asset Type'] || 'option');
      const underlying = extractUnderlying(row.Ticker || '').toUpperCase() || extractUnderlying(row.Trade).toUpperCase();
      const status = mapStatus(row.Status || 'open');
      const strategy = mapStrategy(row.Strategy || 'long');
      const side = mapSide(row.Side || 'buy');
      const quantity = parseInt(row.Quantity) || 1;
      const entryPrice = parseMoney(row['Entry Price']);
      const exitPrice = parseMoney(row['Exit Price']);
      const fees = parseMoney(row.Fees);
      const realizedPnl = parseMoney(row['Realized P/L']);
      const openDate = parseDate(row['Open Date']);
      const closeDate = parseDate(row['Close Date']);
      const entryQuality = mapEntryQuality(row['Entry Quality'] || '');
      const notes = row.Notes || '';

      if (!underlying) {
        warnings.push(`Skipping "${name}": could not determine underlying`);
        continue;
      }

      // Insert trade
      insertTrade.run(
        tradeId, name, assetType, underlying, status, strategy, side, quantity,
        entryPrice, exitPrice, fees, realizedPnl, openDate, closeDate,
        entryQuality, null, // followed_plan
        '', '', '', notes   // thesis, exit_plan, reflection, notes
      );

      // Build legs
      if (strategy === 'debit_spread') {
        const spread = parseSpreadLegs(name, notes, assetType);
        if (spread.longStrike !== null && spread.shortStrike !== null) {
          // Long leg
          insertLeg.run(
            uuidv4(), tradeId,
            row.Ticker || underlying, spread.optionType, spread.longStrike,
            spread.expiration, 'buy', quantity,
            null, null, null, null, null, null, null, null, null
          );
          // Short leg
          insertLeg.run(
            uuidv4(), tradeId,
            row.Ticker || underlying, spread.optionType, spread.shortStrike,
            spread.expiration, 'sell', quantity,
            null, null, null, null, null, null, null, null, null
          );
        } else {
          // Couldn't parse individual legs, create single leg
          warnings.push(`"${name}": could not parse spread legs, created single leg`);
          insertLeg.run(
            uuidv4(), tradeId,
            row.Ticker || underlying, spread.optionType, null,
            spread.expiration, side, quantity,
            entryPrice, exitPrice, null, null, null, null, null, null, null
          );
        }
      } else {
        // Single-leg trade
        const legInfo = assetType === 'option'
          ? parseSingleLegFromName(name, row.Ticker || '')
          : { optionType: null, strike: null, expiration: null };

        insertLeg.run(
          uuidv4(), tradeId,
          row.Ticker || underlying,
          legInfo.optionType, legInfo.strike, legInfo.expiration,
          side, quantity,
          entryPrice, exitPrice, null, null,
          null, null, null, null, null
        );
      }

      // Tags
      const thesisTag = row['Thesis Tag'];
      if (thesisTag) {
        insertTag.run(uuidv4(), tradeId, thesisTag, 'thesis');
      }

      const timeframe = row.Timeframe;
      if (timeframe) {
        insertTag.run(uuidv4(), tradeId, timeframe, 'timeframe');
      }

      imported++;
    }
  });

  doImport();

  console.log(`Successfully imported ${imported} trades\n`);

  // Post-import: backfill expiration for 0DTE trades (exp = close_date)
  // and 1DTE trades (exp = close_date) since they expired on close
  const fixExpiration = db.prepare(`
    UPDATE trade_legs SET expiration = (
      SELECT t.close_date FROM trades t WHERE t.id = trade_legs.trade_id
    )
    WHERE expiration IS NULL
    AND trade_id IN (
      SELECT t.id FROM trades t
      WHERE t.status = 'closed'
      AND t.close_date IS NOT NULL
      AND t.asset_type = 'option'
      AND (t.name LIKE '%0DTE%' OR t.name LIKE '%1DTE%')
    )
  `);
  const fixResult = fixExpiration.run();
  if (fixResult.changes > 0) {
    console.log(`Backfilled expiration dates for ${fixResult.changes} 0DTE/1DTE legs\n`);
  }

  if (warnings.length > 0) {
    console.log('Warnings:');
    warnings.forEach(w => console.log(`  ⚠ ${w}`));
    console.log();
  }

  // Summary stats
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'open' THEN 1 END) as open,
      COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed,
      COALESCE(SUM(realized_pnl), 0) as totalPnl,
      COUNT(CASE WHEN realized_pnl > 0 THEN 1 END) as wins,
      COUNT(CASE WHEN realized_pnl < 0 THEN 1 END) as losses
    FROM trades
  `).get() as Record<string, number>;

  const legCount = (db.prepare('SELECT COUNT(*) as count FROM trade_legs').get() as { count: number }).count;
  const tagCount = (db.prepare('SELECT COUNT(*) as count FROM trade_tags').get() as { count: number }).count;

  console.log('Database summary:');
  console.log(`  Trades: ${stats.total} (${stats.open} open, ${stats.closed} closed)`);
  console.log(`  Legs: ${legCount}`);
  console.log(`  Tags: ${tagCount}`);
  console.log(`  Win/Loss: ${stats.wins}W / ${stats.losses}L`);
  console.log(`  Total P&L: $${stats.totalPnl.toFixed(2)}`);
}

importTrades();
