# Trading Journal

A local-first trading journal app to track your investments and P&L across crypto and stocks.

## Features

- **Trade Journal**: Record buys and sells with entry/exit prices, quantities, stop loss, take profit, and your trading hypothesis
- **Portfolio Dashboard**: View open positions with real-time unrealized P&L, win rate statistics, and performance metrics
- **Price Analytics**: Track asset performance with historical price charts (7/30/90 day views)
- **Position Management**: Scale into positions with multiple buy executions, close with one-click sell flow
- **Real-time Prices**: Auto-fetching prices from CoinGecko (crypto) and Yahoo Finance (stocks)

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Recharts, Zustand
- **Backend**: Express 5, better-sqlite3
- **Runtime**: Node.js with tsx for TypeScript execution

## Getting Started

```bash
# Install dependencies
npm install

# Start development server (runs both frontend and backend)
npm run dev
```

The app will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Project Structure

```
├── server/                 # Backend Express server
│   ├── index.ts           # Server entry point
│   ├── database.ts        # SQLite schema, indexes, migration
│   └── routes/
│       ├── positions.ts   # Position & execution CRUD + stats
│       └── prices.ts      # Price fetching, caching, history
├── src/                   # Frontend React app
│   ├── api/               # API client functions
│   ├── components/        # Shared UI components
│   │   ├── trades/        # PositionList, ExecutionList, TradeForm
│   │   ├── ConfirmDialog.tsx
│   │   ├── DropdownMenu.tsx
│   │   └── PageTransition.tsx
│   ├── hooks/             # Custom React hooks
│   ├── pages/             # Page components
│   │   ├── Dashboard.tsx  # Portfolio overview
│   │   ├── Journal.tsx    # Trade journal
│   │   └── Analytics.tsx  # Price analytics
│   ├── store/             # Zustand state management
│   ├── types/             # TypeScript interfaces
│   └── utils/             # Formatting, styles, P&L helpers
└── trading-journal.db     # SQLite database (auto-created)
```

## API Endpoints

### Positions
- `GET /api/positions` - List all positions with executions (filter by `status`, `assetType`, `symbol`)
- `GET /api/positions/:id` - Get single position with executions
- `POST /api/positions` - Create trade (auto-joins existing open position or creates new one)
- `PUT /api/positions/:id` - Update position metadata (stop loss, take profit, hypothesis, notes)
- `DELETE /api/positions/:id` - Delete position (cascades to executions)
- `GET /api/positions/stats/summary` - Portfolio summary stats

### Executions
- `POST /api/positions/:id/executions` - Add execution to existing position
- `DELETE /api/positions/:posId/executions/:execId` - Delete single execution (recomputes position)

### Prices
- `GET /api/prices/:assetType/:symbol` - Get current price for an asset
- `POST /api/prices/batch` - Get prices for multiple assets
- `GET /api/prices/history/:assetType/:symbol` - Get price history for charts

## Data Model

```typescript
interface Position {
  id: string;
  assetType: 'crypto' | 'stock';
  symbol: string;
  direction: 'long' | 'short';
  status: 'open' | 'closed';
  totalQuantity: number;
  remainingQuantity: number;
  avgEntryPrice: number;
  totalCostBasis: number;
  realizedPnl: number;
  realizedPnlPercent: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  hypothesis: string;
  notes: string;
  openedAt: string;
  closedAt: string | null;
  executions: Execution[];
}

interface Execution {
  id: string;
  positionId: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  executedAt: string;
  pnl: number | null;       // Set on sell executions
  pnlPercent: number | null; // Set on sell executions
  notes: string;
}
```

## Usage

1. **Add a Trade**: Click "New Trade" in the Journal, fill in the details including your hypothesis
2. **Scale In**: Buying the same symbol again auto-adds to the existing open position
3. **Track Performance**: View unrealized P&L on the Dashboard with live price updates
4. **Close a Position**: Click the menu on an open position and select "Close Position"
5. **Analyze Prices**: Use the Analytics page to view historical charts and search for any asset
