import { describe, it, expect } from 'vitest';
import { getDerivedOptionType, getTradeDate, isDateInRange } from './tradeFilters';
import type { Trade, TradeLeg } from '../types';

// --- Helpers to build minimal test objects ---

function makeLeg(overrides: Partial<TradeLeg> = {}): TradeLeg {
  return {
    id: '1',
    tradeId: 't1',
    ticker: 'SPY260401C647',
    optionType: 'call',
    strike: 647,
    expiration: '2026-04-01',
    side: 'buy',
    quantity: 1,
    entryPrice: 1.50,
    exitPrice: null,
    entryUnderlyingPrice: null,
    exitUnderlyingPrice: null,
    delta: null,
    gamma: null,
    theta: null,
    vega: null,
    iv: null,
    ...overrides,
  };
}

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 't1',
    name: 'SPY 1DTE 647C',
    assetType: 'option',
    underlying: 'SPY',
    status: 'closed',
    strategy: 'long',
    side: 'buy',
    quantity: 1,
    entryPrice: 1.50,
    exitPrice: 2.00,
    fees: 1.30,
    realizedPnl: 48.70,
    openDate: '2026-03-28T14:30:00.000Z',
    closeDate: '2026-03-28T15:45:00.000Z',
    entryQuality: 'clean',
    followedPlan: true,
    thesis: 'VWAP mean reversion',
    exitPlan: 'Target +50%',
    reflection: '',
    notes: '',
    createdAt: '2026-03-28T14:00:00.000Z',
    updatedAt: '2026-03-28T16:00:00.000Z',
    legs: [],
    tags: [],
    ...overrides,
  };
}

// =============================================================================
// getDerivedOptionType
// =============================================================================

describe('getDerivedOptionType', () => {
  it('returns null for no legs', () => {
    expect(getDerivedOptionType([])).toBe(null);
  });

  it('returns null for legs with no optionType (stock/futures)', () => {
    const legs = [
      makeLeg({ optionType: null }),
      makeLeg({ id: '2', optionType: null }),
    ];
    expect(getDerivedOptionType(legs)).toBe(null);
  });

  it('returns "call" for a single call leg', () => {
    expect(getDerivedOptionType([makeLeg({ optionType: 'call' })])).toBe('call');
  });

  it('returns "put" for a single put leg', () => {
    expect(getDerivedOptionType([makeLeg({ optionType: 'put' })])).toBe('put');
  });

  it('returns "call" for all-call legs (bull call spread)', () => {
    const legs = [
      makeLeg({ optionType: 'call', side: 'buy', strike: 645 }),
      makeLeg({ id: '2', optionType: 'call', side: 'sell', strike: 650 }),
    ];
    expect(getDerivedOptionType(legs)).toBe('call');
  });

  it('returns "put" for all-put legs (bear put spread)', () => {
    const legs = [
      makeLeg({ optionType: 'put', side: 'buy', strike: 650 }),
      makeLeg({ id: '2', optionType: 'put', side: 'sell', strike: 645 }),
    ];
    expect(getDerivedOptionType(legs)).toBe('put');
  });

  it('returns "mixed" for call+put legs (straddle)', () => {
    const legs = [
      makeLeg({ optionType: 'call', strike: 647 }),
      makeLeg({ id: '2', optionType: 'put', strike: 647 }),
    ];
    expect(getDerivedOptionType(legs)).toBe('mixed');
  });

  it('returns "mixed" for iron condor (4 legs)', () => {
    const legs = [
      makeLeg({ optionType: 'put', side: 'sell', strike: 640 }),
      makeLeg({ id: '2', optionType: 'put', side: 'buy', strike: 635 }),
      makeLeg({ id: '3', optionType: 'call', side: 'sell', strike: 655 }),
      makeLeg({ id: '4', optionType: 'call', side: 'buy', strike: 660 }),
    ];
    expect(getDerivedOptionType(legs)).toBe('mixed');
  });

  it('ignores non-option legs when determining type', () => {
    const legs = [
      makeLeg({ optionType: null }), // stock/futures leg
      makeLeg({ id: '2', optionType: 'call' }),
    ];
    expect(getDerivedOptionType(legs)).toBe('call');
  });
});

// =============================================================================
// getTradeDate
// =============================================================================

describe('getTradeDate', () => {
  it('extracts date from openDate', () => {
    const trade = makeTrade({ openDate: '2026-03-28T14:30:00.000Z' });
    expect(getTradeDate(trade)).toBe('2026-03-28');
  });

  it('falls back to createdAt when openDate is null (planned trade)', () => {
    const trade = makeTrade({ openDate: null, createdAt: '2026-03-27T10:00:00.000Z' });
    expect(getTradeDate(trade)).toBe('2026-03-27');
  });

  it('handles date-only string (no time component)', () => {
    const trade = makeTrade({ openDate: '2026-03-28' });
    expect(getTradeDate(trade)).toBe('2026-03-28');
  });
});

// =============================================================================
// isDateInRange
// =============================================================================

describe('isDateInRange', () => {
  it('returns true when both bounds are null', () => {
    expect(isDateInRange('2026-03-28', null, null)).toBe(true);
  });

  it('returns true when date matches single-day range', () => {
    expect(isDateInRange('2026-03-28', '2026-03-28', '2026-03-28')).toBe(true);
  });

  it('returns true when date is within range', () => {
    expect(isDateInRange('2026-03-28', '2026-03-25', '2026-03-30')).toBe(true);
  });

  it('returns true on the lower boundary', () => {
    expect(isDateInRange('2026-03-25', '2026-03-25', '2026-03-30')).toBe(true);
  });

  it('returns true on the upper boundary', () => {
    expect(isDateInRange('2026-03-30', '2026-03-25', '2026-03-30')).toBe(true);
  });

  it('returns false when date is before range', () => {
    expect(isDateInRange('2026-03-24', '2026-03-25', '2026-03-30')).toBe(false);
  });

  it('returns false when date is after range', () => {
    expect(isDateInRange('2026-03-31', '2026-03-25', '2026-03-30')).toBe(false);
  });

  it('returns true with only from bound (open-ended to)', () => {
    expect(isDateInRange('2026-12-31', '2026-03-25', null)).toBe(true);
    expect(isDateInRange('2026-03-24', '2026-03-25', null)).toBe(false);
  });

  it('returns true with only to bound (open-ended from)', () => {
    expect(isDateInRange('2020-01-01', null, '2026-03-30')).toBe(true);
    expect(isDateInRange('2026-03-31', null, '2026-03-30')).toBe(false);
  });
});
