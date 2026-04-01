# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (runs frontend + backend concurrently)
npm run dev

# Run only frontend (Vite on port 5173)
npm run dev:client

# Run only backend (Express on port 3001)
npm run dev:server

# Build for production
npm run build

# Lint
npm run lint
```

## Architecture

This is a full-stack TypeScript options trading journal app with React frontend and Express backend.

### Backend (`server/`)
- Express 5 server on port 3001
- SQLite database via better-sqlite3 (file: `trading-journal.db`, auto-created)
- Routes: `trades.ts` (CRUD + stats), `reflections.ts`, `predictions.ts`, `rules.ts`, `prices.ts` (Yahoo Finance)
- Database uses snake_case columns; `rowToTrade`/`rowToTradeLeg`/`rowToTradeTag` helpers convert to camelCase TypeScript
- API base paths: `/api/trades`, `/api/reflections`, `/api/predictions`, `/api/rules`, `/api/prices`

### Frontend (`src/`)
- React 19 + Vite 7
- Zustand store (`store/useStore.ts`) manages all global state (trades, prices, portfolio, predictions, reflections, rules)
- API client functions in `api/` return typed responses
- Tailwind CSS v4 with CSS custom properties in `index.css`
- Vite proxies `/api` requests to backend

### Data Model
- **`trades`** table: One row per trade (options, futures, stocks). Fields include name, underlying, strategy, side, entry/exit prices, fees, realized P&L, entry quality, followed_plan (execution quality boolean), thesis, exit plan, reflection, notes.
- **`trade_legs`** table: Multi-leg support for spreads/iron condors. Each leg has ticker (OCC code), option type, strike, expiration, side, greeks, IV.
- **`trade_tags`** table: Flexible tagging with optional category (thesis, timeframe, setup).
- **`reflections`** table: Success/lesson/mistake entries linked to trades via `trade_id`.
- **`predictions`** table: Standalone prediction market bets (Kalshi-style).
- **`rules`** table: User-defined trading rules.
- **`price_cache`** table: Cached price data from Yahoo Finance (5-min TTL).

### Key Data Flow
- Trades are created with status 'open', optionally with legs and tags
- Closing a trade sets exit_price, close_date, realized_pnl, followed_plan, and status 'closed'
- Per-leg exit prices can be set when closing multi-leg trades
- Unrealized P&L for options is deferred (planned: Yahoo Finance OCC ticker lookup)
- Prices are cached in DB for 5 minutes to avoid rate limiting

### External APIs
- Yahoo Finance chart endpoint (stock/option prices and history)

### Testing
- Use the playwright MCP server to interact with the front-end to make sure functionality behaves properly
