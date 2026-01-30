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

This is a full-stack TypeScript trading journal app with React frontend and Express backend.

### Backend (`server/`)
- Express 5 server on port 3001
- SQLite database via better-sqlite3 (file: `trading-journal.db`, auto-created)
- Routes: `trades.ts` (CRUD + stats), `prices.ts` (CoinGecko for crypto, Yahoo Finance for stocks)
- Database uses snake_case columns; `rowToTrade` helper converts to camelCase TypeScript

### Frontend (`src/`)
- React 19 + Vite 7
- Zustand store (`store/useStore.ts`) manages all global state (trades, prices, portfolio)
- API client functions in `api/` return typed responses
- Tailwind CSS v4 with CSS custom properties in `index.css`
- Vite proxies `/api` requests to backend

### Key Data Flow
- Trades are created as 'buy' with status 'open'
- Closing a position creates a linked 'sell' trade and updates the original with exit data, P&L, and status 'closed'
- Prices are cached in DB for 5 minutes to avoid rate limiting external APIs

### External APIs
- CoinGecko (crypto prices/history) - free tier
- Yahoo Finance chart endpoint (stock prices/history)

### Testing
- Use the playwright MCP server to interact with the front-end to make sure functionality behaves properly
