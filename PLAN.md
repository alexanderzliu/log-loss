# Options Trading Journal — Migration Plan

Migrating from a crypto/memecoin-focused trading journal to an options-first trading journal with richer metadata, equity curve tracking, and programmatic access via API/MCP.

## Current state

The app is a full-stack TypeScript journal (React + Express + SQLite) built around crypto spot trading and memecoin analytics. Major crypto-specific features: DexScreener/GeckoTerminal integrations, token momentum panel, pattern flags, holder tracking, scanner page, snapshot service.

The user has been tracking options trades in Notion with these fields:
- **Trade**: Descriptive name (e.g. "SPY 1DTE 646P — Micro Mean Reversion (New POC)")
- **Open Date / Close Date**
- **Asset Type**: Option, Futures
- **Ticker**: Varies from OCC-style (SPY260327P646) to loose (SPY, MU)
- **Strategy**: Long, Debit Spread, etc.
- **Side**: Buy, Sell
- **Quantity**: Number of contracts
- **Entry Price / Exit Price**: Per-share premium
- **Fees**: Flat $0.65/contract ($1.34 round trip with reg fees)
- **Realized P/L**
- **Status**: Open, Closed, Planned
- **Notes**: Rich journal entries — thesis, exit plan, lessons, reflections all in one field
- **Entry Quality**: Clean, FOMO, Chased, Intuitive
- **Thesis Tag**: VWAP Mean Reversion, Iran/Oil Disruption, AI/Semis, Earnings Vol, Other
- **Timeframe**: Intraday, (blank for multi-day/swing)

Trade mix: mostly SPY 0DTE/1DTE options (VWAP mean reversion), debit spreads (bull call, bear put), some single-name options (NVDA, MU, META), nano futures (WTI oil). Multi-leg strategies are common (vertical spreads).

---

## Phase 1: Data model redesign for options

**Status: Complete**

### New schema design

**`trades` table** (replaces `positions` — flat, one row per trade like the Notion log)

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | UUID |
| `name` | TEXT | Descriptive trade name (e.g. "SPY 1DTE 646P — Micro Mean Reversion") |
| `asset_type` | TEXT | `'option'`, `'futures'`, `'stock'` |
| `underlying` | TEXT | Underlying symbol (SPY, MU, USO, MCL, etc.) |
| `status` | TEXT | `'planned'`, `'open'`, `'closed'` |
| `strategy` | TEXT | `'long'`, `'short'`, `'debit_spread'`, `'credit_spread'`, `'iron_condor'`, `'straddle'`, `'strangle'`, `'custom'` |
| `side` | TEXT | `'buy'`, `'sell'` |
| `quantity` | INTEGER | Number of contracts |
| `entry_price` | REAL | Per-share/contract premium or price |
| `exit_price` | REAL | Per-share/contract at close |
| `fees` | REAL | Total fees for the trade |
| `realized_pnl` | REAL | Dollar P&L (computed or manual) |
| `open_date` | TEXT | Entry date/time |
| `close_date` | TEXT | Exit date/time |
| `entry_quality` | TEXT | `'clean'`, `'fomo'`, `'chased'`, `'intuitive'` |
| `thesis` | TEXT | Trade thesis / rationale for entering |
| `exit_plan` | TEXT | Planned exit conditions (targets, stops, invalidation) |
| `reflection` | TEXT | Post-trade reflection (lessons, what went well/wrong) |
| `notes` | TEXT | Additional notes (anything that doesn't fit above) |
| `created_at` | TEXT | Record timestamp |
| `updated_at` | TEXT | Record timestamp |

**`trade_tags` table** (flexible tagging — thesis, timeframe, grouping)

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | UUID |
| `trade_id` | TEXT FK | References `trades.id` ON DELETE CASCADE |
| `tag` | TEXT | The tag value (e.g. "VWAP Mean Reversion", "0DTE", "Iran/Oil") |
| `category` | TEXT | Optional grouping: `'thesis'`, `'timeframe'`, `'setup'`, or NULL for general |

Use cases: filter 0DTE/1DTE scalps vs swing trades, group by macro thesis (Iran cluster), filter by setup type (VWAP mean reversion vs earnings vol). Trades can have multiple tags.

**`trade_legs` table** (for multi-leg strategies like spreads)

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | UUID |
| `trade_id` | TEXT FK | References `trades.id` |
| `ticker` | TEXT | Full option symbol or OCC code |
| `option_type` | TEXT | `'call'`, `'put'`, NULL for futures/stock |
| `strike` | REAL | Strike price |
| `expiration` | TEXT | Expiration date |
| `side` | TEXT | `'buy'`, `'sell'` (for the leg — a spread has buy + sell legs) |
| `quantity` | INTEGER | Contracts for this leg |
| `entry_price` | REAL | Premium per share at open |
| `exit_price` | REAL | Premium per share at close |
| `entry_underlying_price` | REAL | Underlying price at leg entry |
| `exit_underlying_price` | REAL | Underlying price at leg exit |
| `delta` | REAL | Greeks snapshot at entry (optional) |
| `gamma` | REAL | |
| `theta` | REAL | |
| `vega` | REAL | |
| `iv` | REAL | Implied volatility at entry |

This design means:
- **Single-leg trade** (e.g. "SPY 1DTE 646P"): 1 row in `trades` + 1 row in `trade_legs`
- **Spread** (e.g. "USO Bull Call $112/$122"): 1 row in `trades` + 2 rows in `trade_legs`
- **Iron condor**: 1 row in `trades` + 4 rows in `trade_legs`
- **Futures trade**: 1 row in `trades` + 1 row in `trade_legs` (no option fields)

**Keep existing tables (renamed/tweaked):**
- `reflections` → keep, link to `trades.id` instead of `positions.id`
- `rules` → keep as-is
- `predictions` → keep as-is
- `price_cache` → keep, simplify to Yahoo Finance only

**Drop:**
- `positions`, `executions` (replaced by `trades` + `trade_legs`)
- `token_metrics`, `token_snapshots`, `service_state`

### Migration tasks

- [x] Design and finalize schema (above — review with user)
- [x] Implement new tables in `database.ts`
- [x] Update TypeScript types in `shared/types.ts`
- [x] Update row mappers in `server/helpers/rowMappers.ts`
- [x] Create new CRUD routes for `trades` + `trade_legs`
- [x] Update stats/analytics endpoints for new schema
- [x] Update Zustand store

### Open questions

- For spreads, the net debit/credit is on the `trades` row — should individual leg prices also be tracked? (The schema above supports this)

## Phase 2: Strip crypto/memecoin features

**Status: Complete**

Removed all crypto-specific code to simplify the codebase:

- [x] Remove `server/routes/metrics.ts` (DexScreener token metrics)
- [x] Remove `server/routes/holders.ts` (Helius/Etherscan holder counts)
- [x] Remove `server/routes/scanner.ts` (GeckoTerminal trade feed)
- [x] Remove `server/services/snapshotService.ts` (background snapshot polling)
- [x] Remove `src/pages/Scanner.tsx`
- [x] Remove `src/components/MomentumPanel.tsx`, `PatternFlags.tsx`, `MetricTrends.tsx`, `Sparkline.tsx`
- [x] Remove `src/components/trades/TokenSearch.tsx` (DexScreener search)
- [x] Remove `src/store/useMetricsStore.ts`
- [x] Remove `src/api/scanner.ts`, `src/api/metrics.ts`
- [x] Simplify `server/routes/prices.ts` — removed DexScreener/GeckoTerminal, kept Yahoo Finance only
- [x] Remove CoinGecko integration
- [x] Remove `server/services/rateLimiter.ts` (only used by DexScreener)
- [x] Remove `token_metrics`, `token_snapshots`, `service_state` table migrations from schema
- [x] Remove `server/ai/openai.ts` and `server/routes/ai.ts` (AI analysis page)
- [x] Remove `src/pages/AIAnalysis.tsx`
- [x] Remove `src/api/ai.ts`
- [x] Clean up chain/contractAddress references from types, store, routes, and components
- [x] Remove Scanner and AI Analysis from sidebar navigation and routing

## Phase 3: UI updates for options trading

**Status: Complete**

Update the frontend to support options workflows:

- [x] Redesign `TradeForm` for options: underlying, strategy type, legs builder (add/remove legs with strike/exp/type)
- [x] Update trade list to show options-relevant columns (underlying, strategy, DTE, strikes, P&L)
- [x] Strategy grouping — visually show spread legs together
- [x] Expiration awareness — highlight approaching expirations, show DTE
- [x] Entry quality badges (Clean/FOMO/Chased/Intuitive) with color coding — shown on trade list rows, form, and filtering
- [x] Thesis tag filtering and grouping
- [x] Update Dashboard with options-relevant metrics — basic metrics on Dashboard, strategy/entry-quality breakdowns on Analytics page
- [x] Update Analytics/equity curve for options P&L
- [x] Planned trades view — 'planned' status support with filter pill, create-as-planned toggle, open trade action

## Phase 4: VWAP & chart data capture

**Status: Not started**

Store price context at trade entry/exit to support post-hoc analysis:

- [ ] Capture OHLCV data window around entry/exit (e.g., 5-min bars for surrounding session)
- [ ] Compute and store VWAP for the session
- [ ] Store as JSON blob in `chart_snapshots` table linked to `trade_legs`
- [ ] Frontend: render mini-charts showing entry/exit points overlaid on price + VWAP
- [ ] Data source: Yahoo Finance intraday data (or another free source for intraday bars)

**Open questions:**
- What timeframe bars are most useful? (1-min, 5-min, 15-min?)
- How much context around the trade? (full session? 2 hours before/after?)
- Any other indicators beyond VWAP? (EMAs, volume profile, VWAP bands/standard deviations?)

## Phase 5: API & MCP server / CLI

**Status: Not started**

Build programmatic access so Claude can query and analyze the journal:

- [ ] Clean REST API — document and stabilize endpoints
- [ ] MCP server with tools: `search_trades`, `get_trade`, `get_equity_curve`, `get_analytics`, `query_by_tag`, `query_by_entry_quality`, `add_trade`, `get_rules`, etc.
- [ ] Batch query support — filter by date range, underlying, strategy type, P&L range, thesis tag, entry quality, timeframe
- [ ] Aggregation queries — P&L by thesis tag, win rate by entry quality, performance by strategy type
- [ ] Export capabilities — CSV/JSON dump for external analysis

## Phase 6: Notion data migration

**Status: Complete**

Import existing trades from the Notion CSV exports in `notion-trade-journal/`:

- [x] Parse CSV and map fields to new schema
- [x] Extract option details from ticker/name (strike, expiration, call/put)
- [x] Handle multi-leg trades (spreads have 2 legs to create)
- [x] Parse the rich Notes field — potentially split into structured fields if we add them
- [x] Validate imported data and computed P&L
- [x] Backfill equity curve data points from close dates + realized P&L

---

## Decisions log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-29 | Start migration from crypto to options focus | User pivoted to options trading, tracking in Notion but wants equity curve + programmatic access |
| 2026-03-29 | Keep predictions, reflections, rules tables | Still useful for options trading workflow |
| 2026-03-29 | Flat trade model (trades + trade_legs) instead of position/execution model | Better matches how options are tracked — each trade is a discrete decision, spreads are multi-leg trades not multiple positions |
| 2026-03-29 | Track fees per trade | Flat $0.65/contract currently but good to have in case it changes or for accurate P&L |
| 2026-03-29 | Include entry_quality and thesis_tag as first-class fields | Core to the user's journaling workflow — enables analysis by quality and thesis |
| 2026-03-29 | Support `planned` status | User tracks planned trades (e.g. STNG spread thesis) before executing |
| 2026-03-29 | Use `trade_tags` table instead of text column for thesis/timeframe | Flexible filtering — group 0DTE scalps vs swings, cluster trades by macro thesis |
| 2026-03-29 | Split Notes into thesis, exit_plan, reflection, notes | Structured fields enable better querying and analysis |
| 2026-03-29 | Strip crypto code (Phase 2) before building new schema (Phase 1) | Clean slate approach — less old code to work around |

## Notes

- Strategy focus: mean reversion around VWAP indicators (0DTE/1DTE SPY options)
- Also trades debit spreads on macro theses, single-name options around catalysts
- Tackling phases one at a time, across multiple sessions
- Notion CSV exports are in `notion-trade-journal/` — two files (appear identical)
- Existing DB (`trading-journal.db`) has crypto trade data — archive before schema migration
