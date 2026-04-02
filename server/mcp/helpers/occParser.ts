export interface ParsedOcc {
  underlying: string;
  expiration: string; // YYYY-MM-DD
  optionType: 'call' | 'put';
  strike: number;
}

const MONTH_MAP: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

/**
 * Parse a Fidelity-style or standard OCC option symbol.
 *
 * Fidelity shorthand: SPY260401C647  (strike is whole dollars, < 8 digits)
 * Standard OCC:       SPY260401C00647000  (strike is 8 digits, divide by 1000)
 */
export function parseOccSymbol(symbol: string): ParsedOcc | null {
  const match = symbol.match(/^([A-Z]{1,6})(\d{6})([CP])(\d+)$/);
  if (!match) return null;

  const [, underlying, dateStr, typeChar, strikeStr] = match;

  // Parse YYMMDD -> YYYY-MM-DD
  const yy = dateStr.slice(0, 2);
  const mm = dateStr.slice(2, 4);
  const dd = dateStr.slice(4, 6);
  const expiration = `20${yy}-${mm}-${dd}`;

  // Strike: 8 digits = standard OCC (divide by 1000), fewer = whole dollars
  let strike: number;
  if (strikeStr.length === 8) {
    strike = parseInt(strikeStr, 10) / 1000;
  } else if (strikeStr.length < 8) {
    strike = parseInt(strikeStr, 10);
  } else {
    return null; // > 8 digits is invalid
  }

  return {
    underlying,
    expiration,
    optionType: typeChar === 'C' ? 'call' : 'put',
    strike,
  };
}

/**
 * Parse the Fidelity Security Description to extract option details as a fallback.
 * Format: "CALL (SPY) STATE STREET SPDR APR 01 26 $647 (100 SHS)"
 */
export function parseSecurityDescription(desc: string): ParsedOcc | null {
  const match = desc.match(
    /^(CALL|PUT)\s+\(([A-Z]{1,6})\).*?(\w{3})\s+(\d{2})\s+(\d{2})\s+\$(\d+(?:\.\d+)?)/
  );
  if (!match) return null;

  const [, type, underlying, monthStr, day, year, strikeStr] = match;
  const mm = MONTH_MAP[monthStr];
  if (!mm) return null;

  return {
    underlying,
    expiration: `20${year}-${mm}-${day}`,
    optionType: type === 'CALL' ? 'call' : 'put',
    strike: parseFloat(strikeStr),
  };
}
