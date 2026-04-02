import { parseOccSymbol } from './occParser';

export interface ParsedFidelityOrder {
  orderTime: string;           // ISO datetime (naive ET, no offset)
  action: string;              // Raw action text
  direction: 'buy' | 'sell';
  openClose: 'open' | 'close';
  optionType: 'call' | 'put';
  fillPrice: number;
  symbol: string;              // OCC symbol from CSV
  quantity: number;
  orderNumber: string;
}

export interface PairedTrade {
  symbol: string;
  underlying: string;
  optionType: 'call' | 'put';
  strike: number;
  expiration: string;          // YYYY-MM-DD
  side: 'buy' | 'sell';       // The opening side
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: string;           // ISO datetime
  exitTime: string;            // ISO datetime
  realizedPnl: number;         // Dollar P&L
  fees: number;                // Auto-calculated
}

export interface ParseResult {
  trades: PairedTrade[];
  orphanedOrders: ParsedFidelityOrder[];
  skippedRows: string[];
}

const MONTH_ABBR: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

/**
 * Parse Fidelity Order Time: "3:00:03 PM ET Mar-31-2026" -> "2026-03-31T15:00:03"
 */
function parseOrderTime(raw: string): string | null {
  const match = raw.match(
    /^(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)\s+ET\s+(\w{3})-(\d{2})-(\d{4})$/
  );
  if (!match) return null;

  let [, hourStr, min, sec, ampm, monthStr, day, year] = match;
  let hour = parseInt(hourStr, 10);
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;

  const month = MONTH_ABBR[monthStr];
  if (!month) return null;

  return `${year}-${month}-${day}T${String(hour).padStart(2, '0')}:${min}:${sec}`;
}

/**
 * Parse Action field: "Buy to Open Call" -> { direction, openClose, optionType }
 */
function parseAction(raw: string): { direction: 'buy' | 'sell'; openClose: 'open' | 'close'; optionType: 'call' | 'put' } | null {
  const match = raw.match(/^(Buy|Sell)\s+to\s+(Open|Close)\s+(Call|Put)$/i);
  if (!match) return null;

  return {
    direction: match[1].toLowerCase() as 'buy' | 'sell',
    openClose: match[2].toLowerCase() as 'open' | 'close',
    optionType: match[3].toLowerCase() as 'call' | 'put',
  };
}

/**
 * Parse fill price from Status field: "Filled at $4.35" -> 4.35
 */
function parseFillPrice(raw: string): number | null {
  const match = raw.match(/Filled at \$([\d.]+)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Parse filled quantity from Filled field: "1 / 1" -> { filled: 1, total: 1 }
 */
function parseFilledQty(raw: string): { filled: number; total: number } | null {
  const match = raw.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return null;
  return { filled: parseInt(match[1], 10), total: parseInt(match[2], 10) };
}

/**
 * Parse a CSV line handling quoted fields.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Parse raw Fidelity CSV text into individual orders.
 */
export function parseFidelityCsv(csvText: string): { orders: ParsedFidelityOrder[]; skippedRows: string[] } {
  // Normalize line endings
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  // Find the header row (starts with "Order Time")
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('Order Time,') || lines[i].startsWith('"Order Time",')) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    return { orders: [], skippedRows: ['Could not find header row'] };
  }

  const headers = parseCsvLine(lines[headerIdx]);
  const colIdx: Record<string, number> = {};
  headers.forEach((h, i) => { colIdx[h.trim()] = i; });

  const orders: ParsedFidelityOrder[] = [];
  const skippedRows: string[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('Disclosure') || line.startsWith('"')) break;

    const fields = parseCsvLine(line);

    const orderTimeRaw = fields[colIdx['Order Time']]?.trim();
    const actionRaw = fields[colIdx['Action']]?.trim();
    const statusRaw = fields[colIdx['Status']]?.trim();
    const symbol = fields[colIdx['Symbol']]?.trim();
    const amountRaw = fields[colIdx['Amount']]?.trim();
    const filledRaw = fields[colIdx['Filled']]?.trim();
    const orderNumber = fields[colIdx['Order Number']]?.trim() || '';

    // Skip unfilled orders
    if (!statusRaw || !statusRaw.startsWith('Filled')) {
      skippedRows.push(`Row ${i + 1}: not filled (${statusRaw})`);
      continue;
    }

    // Check partial fills
    if (filledRaw) {
      const fillInfo = parseFilledQty(filledRaw);
      if (fillInfo && fillInfo.filled === 0) {
        skippedRows.push(`Row ${i + 1}: zero fill`);
        continue;
      }
    }

    const orderTime = parseOrderTime(orderTimeRaw || '');
    const action = parseAction(actionRaw || '');
    const fillPrice = parseFillPrice(statusRaw);

    if (!orderTime || !action || fillPrice === null || !symbol) {
      skippedRows.push(`Row ${i + 1}: could not parse (time=${orderTimeRaw}, action=${actionRaw}, status=${statusRaw})`);
      continue;
    }

    // Use filled quantity if available, otherwise Amount
    let quantity = parseInt(amountRaw || '1', 10);
    if (filledRaw) {
      const fillInfo = parseFilledQty(filledRaw);
      if (fillInfo) quantity = fillInfo.filled;
    }

    orders.push({
      orderTime,
      action: actionRaw || '',
      direction: action.direction,
      openClose: action.openClose,
      optionType: action.optionType,
      fillPrice,
      symbol,
      quantity,
      orderNumber,
    });
  }

  return { orders, skippedRows };
}

/**
 * FIFO-pair opening and closing orders by symbol.
 * Orders MUST be sorted by time ascending before pairing.
 */
export function pairOrders(orders: ParsedFidelityOrder[]): ParseResult {
  // Sort by time ascending (CSV is usually newest-first)
  const sorted = [...orders].sort((a, b) => a.orderTime.localeCompare(b.orderTime));

  // Group by symbol
  const opensBySymbol = new Map<string, ParsedFidelityOrder[]>();
  const trades: PairedTrade[] = [];
  const orphaned: ParsedFidelityOrder[] = [];

  for (const order of sorted) {
    if (order.openClose === 'open') {
      if (!opensBySymbol.has(order.symbol)) opensBySymbol.set(order.symbol, []);
      opensBySymbol.get(order.symbol)!.push(order);
    } else {
      // Close order — try to match with earliest open
      const opens = opensBySymbol.get(order.symbol);
      if (!opens || opens.length === 0) {
        orphaned.push(order);
        continue;
      }

      const openOrder = opens.shift()!;

      // Compute P&L: for buys, profit = (exit - entry) * qty * 100
      // For sells (writing), profit = (entry - exit) * qty * 100
      const multiplier = openOrder.direction === 'buy' ? 1 : -1;
      const pnl = multiplier * (order.fillPrice - openOrder.fillPrice) * order.quantity * 100;
      const fees = order.quantity * 1.30; // $0.65 each way

      const occ = parseOccSymbol(order.symbol);
      if (!occ) {
        orphaned.push(openOrder);
        orphaned.push(order);
        continue;
      }

      trades.push({
        symbol: order.symbol,
        underlying: occ.underlying,
        optionType: occ.optionType,
        strike: occ.strike,
        expiration: occ.expiration,
        side: openOrder.direction,
        quantity: order.quantity,
        entryPrice: openOrder.fillPrice,
        exitPrice: order.fillPrice,
        entryTime: openOrder.orderTime,
        exitTime: order.orderTime,
        realizedPnl: Math.round(pnl * 100) / 100,
        fees,
      });
    }
  }

  // Any remaining opens are orphaned
  for (const [, opens] of opensBySymbol) {
    orphaned.push(...opens);
  }

  // Sort trades by entry time
  trades.sort((a, b) => a.entryTime.localeCompare(b.entryTime));

  return { trades, orphanedOrders: orphaned, skippedRows: [] };
}
