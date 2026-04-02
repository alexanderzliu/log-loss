import type { Trade, TradeLeg, TradeTag, Reflection, ChartSnapshot, SnapshotSymbolType, SnapshotSource, ComputedIndicators } from '../../shared/types.ts';

export function rowToTrade(row: Record<string, unknown>): Trade {
  return {
    id: row.id as string,
    name: row.name as string,
    assetType: row.asset_type as Trade['assetType'],
    underlying: row.underlying as string,
    status: row.status as Trade['status'],
    strategy: row.strategy as Trade['strategy'],
    side: row.side as Trade['side'],
    quantity: row.quantity as number,
    entryPrice: row.entry_price as number | null,
    exitPrice: row.exit_price as number | null,
    fees: row.fees as number | null,
    realizedPnl: row.realized_pnl as number | null,
    openDate: row.open_date as string | null,
    closeDate: row.close_date as string | null,
    entryQuality: row.entry_quality as Trade['entryQuality'],
    followedPlan: row.followed_plan == null ? null : Boolean(row.followed_plan),
    thesis: (row.thesis as string) || '',
    exitPlan: (row.exit_plan as string) || '',
    reflection: (row.reflection as string) || '',
    notes: (row.notes as string) || '',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    legs: [],
    tags: [],
  };
}

export function rowToTradeLeg(row: Record<string, unknown>): TradeLeg {
  return {
    id: row.id as string,
    tradeId: row.trade_id as string,
    ticker: row.ticker as string,
    optionType: row.option_type as TradeLeg['optionType'],
    strike: row.strike as number | null,
    expiration: row.expiration as string | null,
    side: row.side as TradeLeg['side'],
    quantity: row.quantity as number,
    entryPrice: row.entry_price as number | null,
    exitPrice: row.exit_price as number | null,
    entryUnderlyingPrice: row.entry_underlying_price as number | null,
    exitUnderlyingPrice: row.exit_underlying_price as number | null,
    delta: row.delta as number | null,
    gamma: row.gamma as number | null,
    theta: row.theta as number | null,
    vega: row.vega as number | null,
    iv: row.iv as number | null,
  };
}

export function rowToTradeTag(row: Record<string, unknown>): TradeTag {
  return {
    id: row.id as string,
    tradeId: row.trade_id as string,
    tag: row.tag as string,
    category: row.category as string | null,
  };
}

export function rowToChartSnapshot(row: Record<string, unknown>): ChartSnapshot {
  return {
    id: row.id as string,
    tradeId: row.trade_id as string,
    legId: (row.leg_id as string) || null,
    symbol: row.symbol as string,
    symbolType: row.symbol_type as SnapshotSymbolType,
    tradeDate: row.trade_date as string,
    bars: JSON.parse(row.bars as string),
    indicators: row.indicators ? JSON.parse(row.indicators as string) as ComputedIndicators : null,
    source: row.source as SnapshotSource,
    barCount: row.bar_count as number,
    capturedAt: row.captured_at as string,
  };
}

export function rowToReflection(row: Record<string, unknown>): Reflection {
  return {
    id: row.id as string,
    tradeId: row.trade_id as string,
    type: row.type as Reflection['type'],
    content: row.content as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    underlying: row.underlying as string | undefined,
    assetType: row.asset_type as string | undefined,
  };
}
