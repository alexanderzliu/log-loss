# Trading Journal

A local-first trading journal app to track your investments and P&L across crypto and stocks.

## Features

- **Trade Journal**: Record buys and sells with entry/exit prices, quantities, stop loss, take profit, and your trading hypothesis
- **Portfolio Dashboard**: View open positions with real-time unrealized P&L, win rate statistics, and performance metrics
- **Price Analytics**: Track asset performance with historical price charts (7/30/90 day views)
- **Close Position Flow**: One-click to close an open position, automatically calculates realized P&L
- **Real-time Prices**: Auto-fetching prices from CoinGecko (crypto) and Yahoo Finance (stocks)

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Recharts
- **Backend**: Node.js, Express
- **Database**: SQLite (local)
- **State Management**: Zustand

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
│   ├── database.ts        # SQLite database setup
│   └── routes/            # API routes
│       ├── trades.ts      # Trade CRUD operations
│       └── prices.ts      # Price data fetching
├── src/                   # Frontend React app
│   ├── api/               # API client functions
│   ├── components/        # React components
│   │   ├── trades/        # Trade list, form components
│   │   ├── portfolio/     # Position cards, dashboard widgets
│   │   └── charts/        # Price charts
│   ├── pages/             # Page components
│   │   ├── Dashboard.tsx  # Portfolio overview
│   │   ├── Journal.tsx    # Trade journal
│   │   └── Analytics.tsx  # Price analytics
│   ├── store/             # Zustand state management
│   ├── types/             # TypeScript interfaces
│   └── utils/             # Utility functions
└── trading-journal.db     # SQLite database (auto-created)
```

## API Endpoints

### Trades
- `GET /api/trades` - List all trades (supports filtering by status, assetType, symbol)
- `GET /api/trades/:id` - Get single trade
- `POST /api/trades` - Create new trade
- `PUT /api/trades/:id` - Update trade
- `DELETE /api/trades/:id` - Delete trade
- `GET /api/trades/stats/summary` - Get portfolio summary stats

### Prices
- `GET /api/prices/:assetType/:symbol` - Get current price for an asset
- `POST /api/prices/batch` - Get prices for multiple assets
- `GET /api/prices/history/:assetType/:symbol` - Get price history for charts

## Trade Model

```typescript
interface Trade {
  id: string;
  assetType: 'crypto' | 'stock';
  symbol: string;
  side: 'buy' | 'sell';
  entryDate: string;
  entryPrice: number;
  quantity: number;
  stopLoss: number | null;
  takeProfit: number | null;
  hypothesis: string;
  status: 'open' | 'closed';
  exitDate: string | null;
  exitPrice: number | null;
  pnl: number | null;
  pnlPercent: number | null;
  notes: string;
  linkedTradeId: string | null;  // Links sell to original buy
}
```

## Usage

1. **Add a Trade**: Click "New Trade" in the Journal, fill in the details including your hypothesis
2. **Track Performance**: View unrealized P&L on the Dashboard with live price updates
3. **Close a Position**: Click the menu on an open position and select "Close Position"
4. **Analyze Prices**: Use the Analytics page to view historical charts and search for any asset
