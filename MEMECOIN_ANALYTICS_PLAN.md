# Memecoin Analytics & Tracking — Feature Plan

## Overview

Extend the trading journal with sophisticated memecoin-specific analytics: real-time momentum tracking, time-series derivatives, wallet intelligence, holder distribution analysis, liquidity monitoring, and automated pattern detection. Solana-first (where most memecoins live), with EVM chain support where feasible.

**Assumptions:**
- 5-10 open memecoin positions currently, scaling to 20-30 over time
- Server will run continuously to accumulate snapshot data
- All data sources must be free tier (no paid API subscriptions)
- Alerts are in-app only (bell icon + notification center), with external channels (Telegram/Discord) as a future extension
- Want to track as many wallets as possible on free tiers

---

## Data Sources

### Already Integrated
| Source | What We Use Today | What We'll Add |
|---|---|---|
| **DexScreener** (free, 60 req/min) | Price, market cap, FDV, liquidity, 24h txn count | `volumeBuy`/`volumeSell`, `buyers`/`sellers`/`makers` by timeframe, `priceChange` by timeframe, `liquidity` breakdown, `pairCreatedAt` |
| **Helius** (free tier, 1M credits/mo) | `getTokenAccounts` for holder count | Holder count (keep current usage). Reserve credits for high-priority wallet parsing (2-4 wallets max on free tier) |
| **Etherscan** (free, have key) | Holder count for EVM tokens | No changes needed |

### New Integrations
| Source | What For | Cost | Priority |
|---|---|---|---|
| **Shyft** (free, 1 req/sec) | Wallet transaction history with pre-parsed DEX swaps. Primary source for wallet tracking (50-100 wallets feasible) | Free (unlimited credits, 1 API req/sec) | High |
| **PumpPortal** (free WebSocket) | Real-time Pump.fun trade detection via `subscribeAccountTrade`. Covers bonding curve + PumpSwap trades instantly with zero polling cost. Not an official Pump.fun API — third-party, could change | Free | High |
| **GeckoTerminal** (free) | OHLCV historical data for DEX pairs. Solves the "no historical data" gap for DexScreener tokens. Enables proper candlestick charts | Free | High |
| **RugCheck.xyz** | Risk scoring, LP lock status, mint authority, freeze authority checks | Free (requires API key — create account on rugcheck.xyz) | Medium |
| **Jupiter API** (free) | Secondary price source, token metadata, quote data | Free | Low |
| **Moralis Pump.fun API** (free tier) | OHLCV for Pump.fun tokens, bonding curve lifecycle tracking | Free tier | Low |

### Dropped / Deferred
| Source | Reason |
|---|---|
| **Solscan Pro** | Paid service. Helius + Shyft + DexScreener cover 90% of what we'd use it for |
| **Birdeye** | Free tier too limited (30k CU/month, 1 RPS). Not viable for polling |
| **Cielo Finance** | Free API tier too limited (<1 wallet). Web UI tracks 250 wallets with Telegram alerts — useful as a manual supplement, not for programmatic integration |
| **Defined.fi** | Redundant with DexScreener + GeckoTerminal |

---

## Phase 1: Momentum Dashboard (DexScreener Deep Integration)

### Goal
Surface all the buy/sell volume, buyer/seller count, and price change data DexScreener provides across 5m/1h/6h/24h timeframes. Compute derived metrics and display them for open memecoin positions.

### Backend Changes

#### 1.1 Expand DexScreener Data Extraction
Update the `DexScreenerPair` interface in `server/routes/prices.ts` to capture all available fields:

```typescript
interface DexScreenerMetrics {
  txns: {
    m5:  { buys: number; sells: number };
    h1:  { buys: number; sells: number };
    h6:  { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: { m5: number; h1: number; h6: number; h24: number };
  volumeBuy: { m5: number; h1: number; h6: number; h24: number };
  volumeSell: { m5: number; h1: number; h6: number; h24: number };
  buyers: { m5: number; h1: number; h6: number; h24: number };
  sellers: { m5: number; h1: number; h6: number; h24: number };
  makers: { m5: number; h1: number; h6: number; h24: number };
  priceChange: { m5: number; h1: number; h6: number; h24: number };
  liquidity: { usd: number; base: number; quote: number };
  pairCreatedAt: number; // unix ms
  pairAddress: string;
  dexId: string;
}
```

Note: `volumeBuy`/`volumeSell` and `buyers`/`sellers`/`makers` are available directly from DexScreener — no approximation needed. Buy pressure = `volumeBuy / (volumeBuy + volumeSell)` per timeframe.

#### 1.2 New `token_metrics` Cache Table
Single row per token, refreshed on each fetch (same 5-min TTL as `price_cache`). Frequently-queried fields as columns, full response in a JSON blob.

```sql
CREATE TABLE token_metrics (
  chain            TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  -- Key metrics as discrete columns for fast queries
  price            REAL,
  volume_24h       REAL,
  volume_buy_24h   REAL,
  volume_sell_24h  REAL,
  buys_24h         INTEGER,
  sells_24h        INTEGER,
  buyers_24h       INTEGER,
  sellers_24h      INTEGER,
  liquidity_usd    REAL,
  market_cap       REAL,
  fdv              REAL,
  pair_created_at  INTEGER,
  pair_address     TEXT,
  dex_id           TEXT,
  -- Full DexScreener response for all timeframes
  raw_metrics      TEXT NOT NULL, -- JSON blob with all m5/h1/h6/h24 data
  -- Metadata
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (chain, contract_address)
);
```

#### 1.3 Global DexScreener Rate Limiter
Implement a token-bucket rate limiter (60 tokens/min) shared between the price route handler and the snapshot polling service. Without this, background polling competes with interactive requests and causes 429 errors.

```typescript
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  constructor(private maxTokens: number, private refillRate: number) { ... }
  async acquire(): Promise<void> { ... } // waits if no tokens available
}
const dexScreenerLimiter = new RateLimiter(60, 60); // 60 req/min
```

#### 1.4 Computed Metrics (server-side)
Derive from raw DexScreener data:
- **Buy pressure**: `volumeBuy / (volumeBuy + volumeSell)` per timeframe (exact)
- **Avg buy size**: `volumeBuy / buyers` per timeframe
- **Avg sell size**: `volumeSell / sellers` per timeframe
- **Volume acceleration**: `(volume_5m * 12) / volume_1h` — if >1, volume is accelerating
- **Buyer/seller ratio**: `buyers / sellers` per timeframe

#### 1.5 Token Lifecycle Classification
Computed from `pairCreatedAt`:
- **Launch** (0-1h): Brand new, highly volatile
- **Discovery** (1-24h): Finding its audience
- **Momentum** (1-7d): Narrative-driven phase
- **Established** (7d+): Has proven staying power
- **Note**: Lifecycle stage affects how patterns should be interpreted (see Phase 6)

#### 1.6 Metrics API Endpoints
- `GET /api/metrics/:chain/:address` — current token metrics with computed fields
- `GET /api/metrics/:chain/:address/momentum` — momentum summary (buy pressure, volume acceleration, lifecycle stage)

### Frontend Changes

#### 1.7 Momentum Panel Component
For each open memecoin position, show a compact momentum panel:
- 4-column layout: 5m | 1h | 6h | 24h
- Rows: Buy Vol, Sell Vol, Buyers, Sellers, Price Change, Buy Pressure %
- Color coding: green for buy-dominant, red for sell-dominant
- Lifecycle stage badge

#### 1.8 Pattern Flags (basic, pre-Phase 6)
Detect and badge common patterns from current metrics:
- **"Whale Accumulation"** — volumeBuy >> volumeSell AND buyers < sellers
- **"Retail FOMO"** — buyers >> sellers AND avg buy size decreasing AND volume accelerating
- **"Distribution"** — volumeSell increasing while price stable/rising
- **"Exhaustion"** — volume decelerating across all timeframes
- **"Fresh Launch"** — pairCreatedAt < 24h, high volume/mcap ratio, buy pressure > 60%

---

## Phase 2: Time-Series Snapshots & Derivatives

### Goal
Store periodic snapshots of token metrics to compute rate-of-change (derivatives) and render historical trend charts.

### Backend Changes

#### 2.1 `token_snapshots` Table
Store key metrics as columns, full data in JSON blob.

```sql
CREATE TABLE token_snapshots (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  chain            TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  captured_at      TEXT NOT NULL,
  -- Key metrics for fast derivative queries
  price            REAL,
  volume_24h       REAL,
  volume_buy_24h   REAL,
  volume_sell_24h  REAL,
  buys_24h         INTEGER,
  sells_24h        INTEGER,
  liquidity_usd    REAL,
  holder_count     INTEGER,
  market_cap       REAL,
  buy_pressure     REAL, -- pre-computed volumeBuy/(volumeBuy+volumeSell) for 24h
  -- Full snapshot for detailed analysis
  raw_metrics      TEXT, -- JSON blob of complete DexScreener response
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_snapshots_token_time ON token_snapshots(chain, contract_address, captured_at);
CREATE INDEX idx_snapshots_time ON token_snapshots(captured_at); -- for efficient pruning
```

#### 2.2 Snapshot Polling Service
`setTimeout`-based recursive loop (not `setInterval`) with persistent state:

```typescript
class SnapshotService {
  private running = false;

  async start() {
    this.running = true;
    // Check last poll time from service_state table
    // If recently polled, wait remaining interval; otherwise poll immediately
    this.loop();
  }

  private async loop() {
    if (!this.running) return;
    try {
      await this.poll();
      // Store last_poll_at in service_state table
    } catch (e) {
      console.error('Snapshot poll failed:', e);
    }
    setTimeout(() => this.loop(), POLL_INTERVAL_MS);
  }

  private async poll() {
    // 1. Get all open positions with chain + contract_address
    // 2. Fetch current DexScreener data (respecting shared rate limiter)
    // 3. Batch insert snapshots in a single transaction
    // 4. Prune snapshots older than 7 days (MUST run every cycle, not optional)
  }
}
```

**`service_state` table** for crash resilience:
```sql
CREATE TABLE service_state (
  service_name TEXT PRIMARY KEY,
  last_run_at  TEXT NOT NULL,
  metadata     TEXT -- JSON blob for service-specific state
);
```

#### 2.3 Derivative Computation API
`GET /api/metrics/:chain/:address/derivatives?window=1h`

Returns rate-of-change for each metric between now and N minutes/hours ago:
- `d(volume_24h)/dt`, `d(liquidity_usd)/dt`, `d(holder_count)/dt`, `d(buy_pressure)/dt`
- Both absolute change and percentage change
- Sign indicates direction (positive = growing, negative = declining)

#### 2.4 Historical Data via GeckoTerminal
Integrate GeckoTerminal for OHLCV candlestick data for DEX tokens. This fills the gap where DexScreener returns no historical data.

`GET /api/prices/history/:assetType/:symbol` should fall through to GeckoTerminal when DexScreener returns `unavailable: true`.

### Frontend Changes

#### 2.5 Metric Trend Sparklines
Mini sparkline charts for each metric over the last 24h-7d, rendered from snapshot data. Show inflection points where derivatives change sign.

#### 2.6 Derivative Indicators
Momentum arrows (up/down/flat) next to each metric. Color intensity reflects magnitude of change.

---

## Phase 3: Liquidity & Safety Analysis

### Goal
Monitor liquidity health, detect rug pull signals, and provide safety scoring. This is a defensive feature that protects capital and should be available before more complex features.

### Data Sources
- **DexScreener** — liquidity USD/base/quote (from Phase 1)
- **PumpPortal** — bonding curve data for Pump.fun tokens (free WebSocket)
- **RugCheck.xyz** — risk scoring, LP lock status, mint/freeze authority (free, requires API key)
- **Token snapshots** (Phase 2) — liquidity trends over time

### Backend Changes

#### 3.1 `token_safety` Table
```sql
CREATE TABLE token_safety (
  chain            TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  -- Pump.fun data (via PumpPortal)
  is_pump_token    BOOLEAN DEFAULT FALSE,
  bonding_curve_pct REAL,
  is_graduated     BOOLEAN,
  -- RugCheck data
  risk_score       REAL,   -- 0-100 (higher = riskier)
  mint_authority   TEXT,   -- 'revoked' | 'active' | 'unknown'
  freeze_authority TEXT,   -- 'revoked' | 'active' | 'unknown'
  lp_locked        BOOLEAN,
  lp_lock_expiry   TEXT,
  -- Computed from DexScreener + snapshots
  liquidity_mcap_ratio REAL,
  -- Position-level risk (computed on read, not stored)
  -- market_impact_pct = position_value_usd / liquidity_usd
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (chain, contract_address)
);
```

#### 3.2 Safety Check Service
Runs every 15-30 minutes (lower frequency than snapshots):
1. For each open memecoin position, check RugCheck for risk assessment
2. Check PumpPortal for bonding curve status (if applicable)
3. Compute liquidity/mcap ratio from latest DexScreener data
4. Compare liquidity against previous snapshots — flag sudden drops (>20% in 1h)

#### 3.3 Position-Level Risk Metrics
Compute on read (not stored): `market_impact_pct = position_value_usd / liquidity_usd`
- Surface as: "Your $500 position represents 25% of this token's liquidity — exiting would significantly impact price"

#### 3.4 Safety API Endpoints
- `GET /api/safety/:chain/:address` — full safety report
- `GET /api/safety/:chain/:address/flags` — active warning flags only

### Frontend Changes

#### 3.5 Safety Badge System
Color-coded indicator on each position:
- **Green**: LP locked, mint revoked, good liquidity ratio, graduated
- **Yellow**: Some concerns (mint active, low liquidity, early stage)
- **Red**: High risk (LP unlocked + high concentration, liquidity dropping, mint active)

#### 3.6 Safety Detail Panel
Expandable section with all safety checks as pass/fail indicators. Include market impact estimate for current position size.

---

## Phase 4: Alert System

### Goal
In-app notifications when tracked metrics cross thresholds. Start with simple threshold alerts on Phase 1-3 data, expand as new data sources come online.

### Backend Changes

#### 4.1 Alert Tables
```sql
CREATE TABLE alert_rules (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  enabled          BOOLEAN DEFAULT TRUE,
  -- Scope
  chain            TEXT,     -- NULL = all chains
  contract_address TEXT,     -- NULL = all watched tokens
  -- Trigger
  metric           TEXT NOT NULL, -- 'buy_pressure', 'volume_1h', 'liquidity_usd', etc.
  condition        TEXT NOT NULL CHECK(condition IN ('gt', 'lt', 'change_gt', 'change_lt', 'crosses_above', 'crosses_below')),
  threshold        REAL NOT NULL,
  window_minutes   INTEGER, -- lookback for rate-of-change conditions
  -- Notification
  cooldown_minutes INTEGER DEFAULT 60,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE alert_history (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id          TEXT REFERENCES alert_rules(id),
  chain            TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  token_symbol     TEXT,
  message          TEXT NOT NULL,
  metric_value     REAL,
  triggered_at     TEXT NOT NULL,
  read             BOOLEAN DEFAULT FALSE,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_alert_history_unread ON alert_history(read, triggered_at);
```

#### 4.2 Alert Evaluation Engine
Runs after each snapshot poll cycle:
1. Evaluate all enabled alert rules against current metrics
2. For `change_gt`/`change_lt`, compare against snapshot from `window_minutes` ago
3. Cooldown dedup: skip if same rule+token fired within `cooldown_minutes`
4. Insert triggered alerts into `alert_history`

**Built-in alert types** (pre-configured, always available):
- Liquidity drop >20% in 1h (safety)
- Volume spike >3x in 5m vs 1h average
- Buy pressure flip (crosses below 0.5 or above 0.5)

#### 4.3 Copy-Trade Signal Alerts (Phase 5 dependency)
When wallet tracking is live: "Watched wallet X bought a new token you don't hold" — surfaces as a first-class alert type.

#### 4.4 Alert API Endpoints
- `GET /api/alerts/rules` — list alert rules
- `POST /api/alerts/rules` — create rule
- `PUT /api/alerts/rules/:id` — update rule
- `DELETE /api/alerts/rules/:id` — delete rule
- `GET /api/alerts/history?unread=true` — triggered alerts
- `POST /api/alerts/history/:id/read` — mark as read
- `POST /api/alerts/history/read-all` — mark all as read

### Frontend Changes

#### 4.5 Alert Bell / Notification Center
- Bell icon in header with unread count badge
- Dropdown showing recent alerts with context
- Click to navigate to the relevant position

#### 4.6 Alert Rule Builder
Simple form: "Alert me when [metric] [condition] [threshold] for [token/all tokens]"
- Preset templates: "Volume spike", "Liquidity drop", "Buy pressure flip"

---

## Phase 5: Wallet Tracking

### Goal
Track Solana wallets (own wallets, smart money, dev wallets, KOLs) and surface their activity. Maximize wallet count on free tiers.

### Data Source Strategy (All Free)

| Source | Role | Wallets | Limitations |
|---|---|---|---|
| **Shyft** (primary) | Parsed wallet transaction history via `GET /transaction/history`. Pre-decoded DEX swaps | 50-100 at 10-min polling | 1 req/sec rate limit. History limited to ~3-4 days (fine for real-time tracking) |
| **PumpPortal** (real-time supplement) | WebSocket `subscribeAccountTrade` for instant Pump.fun trade detection | Unlimited on one connection | Only covers Pump.fun bonding curve + PumpSwap. Misses Jupiter/Raydium swaps |
| **Helius** (high-priority fallback) | Enhanced Transactions API for rich parsing of a few critical wallets | 2-4 wallets | 1M credits/month. Reserve for your own wallets or highest-priority targets |
| **Alchemy** (future scaling) | Raw RPC with 300M CU/month. Requires building custom swap parser | 200+ wallets | No pre-parsed data — significant engineering to decode Jupiter/Raydium/Pump.fun instruction layouts |

**Recommended approach**: Start with Shyft for 50 wallets + PumpPortal WebSocket for real-time Pump.fun alerts. If Shyft proves unreliable or rate limits are too tight, build custom parser on Alchemy's generous free tier.

### Backend Changes

#### 5.1 `watched_wallets` Table
```sql
CREATE TABLE watched_wallets (
  id              TEXT PRIMARY KEY,
  address         TEXT NOT NULL UNIQUE,
  label           TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'other'
                  CHECK(category IN ('own', 'smart_money', 'insider', 'dev', 'kol', 'other')),
  chain           TEXT NOT NULL DEFAULT 'solana',
  data_source     TEXT NOT NULL DEFAULT 'shyft'
                  CHECK(data_source IN ('shyft', 'helius', 'pumpportal')),
  notes           TEXT DEFAULT '',
  last_synced_sig TEXT, -- last processed tx signature for incremental sync
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### 5.2 `wallet_transactions` Table
```sql
CREATE TABLE wallet_transactions (
  id               TEXT PRIMARY KEY,
  wallet_id        TEXT NOT NULL REFERENCES watched_wallets(id) ON DELETE CASCADE,
  signature        TEXT NOT NULL UNIQUE,
  tx_type          TEXT NOT NULL CHECK(tx_type IN ('swap', 'transfer', 'lp_add', 'lp_remove', 'other')),
  token_address    TEXT,
  token_symbol     TEXT,
  side             TEXT CHECK(side IN ('buy', 'sell')),
  amount_raw       TEXT,    -- raw token amount as string (precision-safe)
  amount           REAL,    -- human-readable amount (may lose precision on very large numbers)
  value_usd        REAL,
  counterpart_token TEXT,
  pool_address     TEXT,    -- which DEX pool the swap went through
  timestamp        TEXT NOT NULL,
  raw_data         TEXT,    -- JSON blob of full parsed tx
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_wallet_tx_token ON wallet_transactions(token_address, timestamp);
CREATE INDEX idx_wallet_tx_wallet ON wallet_transactions(wallet_id, timestamp);
```

#### 5.3 Wallet Sync Service
Two parallel mechanisms:

**A) Shyft Polling (primary, every 10 minutes)**
1. For each watched wallet with `data_source = 'shyft'`, call `GET /transaction/history`
2. Filter for new transactions since `last_synced_sig`
3. Parse swap events, insert into `wallet_transactions`
4. Update `last_synced_sig`
5. Rate limit: 1 req/sec — stagger wallet fetches across the 10-minute window

**B) PumpPortal WebSocket (real-time supplement)**
1. On server start, open single WebSocket to `wss://pumpportal.fun/api/data`
2. Subscribe to all watched wallet addresses via `subscribeAccountTrade`
3. On trade event, insert into `wallet_transactions` with dedup on `signature`
4. Re-subscribe when wallets are added/removed

#### 5.4 Wallet API Endpoints
- `GET /api/wallets` — list watched wallets
- `POST /api/wallets` — add wallet to watch
- `PUT /api/wallets/:id` — update wallet label/category
- `DELETE /api/wallets/:id` — stop watching (cascades to transactions)
- `GET /api/wallets/:id/transactions?limit=50` — wallet's recent activity
- `GET /api/wallets/activity?token=<address>` — all watched wallet activity for a token
- `GET /api/wallets/signals` — new token buys by watched wallets (copy-trade signals)

### Frontend Changes

#### 5.5 Wallet Manager Page
New page in sidebar navigation:
- Add/remove watched wallets with labels and categories
- View each wallet's recent swap activity in a feed
- Filter by token to see who's trading tokens you care about

#### 5.6 Wallet Activity Overlay on Positions
On each open memecoin position, a section showing watched wallet activity for that token:
- Timeline of buys/sells from tracked wallets
- Badges: "KOL_name bought 2h ago", "Dev wallet sold 30m ago"

#### 5.7 Copy-Trade Signal Feed
Dedicated feed showing: "Watched wallet X just bought token Y (which you don't hold)"
- Filterable by wallet category (smart_money, kol, etc.)
- Links to DexScreener/GeckoTerminal for the token

---

## Phase 6: Automated Pattern Detection & Scoring

### Goal
Synthesize all collected metrics into composite scores and automatically detect known memecoin patterns. Weight signals by token lifecycle stage.

### Backend Changes

#### 6.1 Pattern Engine
Rule-based system evaluating current metrics + derivatives + safety data:

```typescript
interface Pattern {
  id: string;
  name: string;
  description: string;
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'danger';
  applicableStages: LifecycleStage[]; // which stages this pattern applies to
  evaluate: (ctx: PatternContext) => {
    detected: boolean;
    confidence: number; // 0-1
    detail: string;
  };
}

interface PatternContext {
  metrics: TokenMetrics;
  derivatives: Derivatives;
  safety: SafetyData;
  walletActivity: WalletActivity[];
  lifecycleStage: LifecycleStage;
}
```

**Patterns to implement:**

| Pattern | Logic | Sentiment | Lifecycle Stages |
|---|---|---|---|
| Whale Accumulation | volumeBuy >> volumeSell AND buyers < sellers | Bullish | Discovery, Momentum |
| Retail FOMO | buyers >> sellers AND avg_buy_size decreasing AND volume accelerating | Caution | Momentum, Established |
| Smart Money Exit | watched wallet sells AND volume_24h declining | Bearish | Any |
| Distribution Phase | volumeSell increasing while price stable/rising | Bearish | Momentum, Established |
| Volume Exhaustion | volume decelerating across all timeframes | Bearish | Momentum, Established |
| Liquidity Drain | d(liquidity_usd)/dt < -10% per hour | Danger | Any |
| Holder Exodus | d(holder_count)/dt < -5% per snapshot | Danger | Momentum, Established |
| Fresh Launch Momentum | pair_created < 24h AND volume/mcap > 0.5 AND buy_pressure > 60% | Bullish | Launch, Discovery |
| Dev Dump | dev_wallet_pct decreasing rapidly | Danger | Launch, Discovery |
| Organic Growth | holder_count growing AND liquidity growing AND volume steady | Bullish | Discovery, Momentum |
| Consolidation | volume low, price range tight, holder count stable | Neutral | Established |
| Breakout Setup | consolidation followed by volume spike + price move | Bullish | Established |

#### 6.2 `pattern_events` Table (for P&L attribution)
```sql
CREATE TABLE pattern_events (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  chain            TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  pattern_id       TEXT NOT NULL,
  pattern_name     TEXT NOT NULL,
  sentiment        TEXT NOT NULL,
  confidence       REAL NOT NULL,
  detail           TEXT,
  price_at_detection REAL,
  -- For P&L attribution: check price 1h, 6h, 24h later
  price_after_1h   REAL,
  price_after_6h   REAL,
  price_after_24h  REAL,
  detected_at      TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_pattern_events ON pattern_events(chain, contract_address, detected_at);
```

#### 6.3 Composite Momentum Score
0-100 score from weighted signals:
- Volume trend (20%): acceleration across timeframes
- Buy pressure (20%): volumeBuy/volumeSell ratio trend
- Holder growth (15%): rate of new holders
- Liquidity health (15%): stability and growth
- Smart money signal (15%): watched wallet activity alignment
- Safety score (15%): inverse of risk

Weights adjusted by lifecycle stage (e.g., volume matters more for Launch/Discovery, holder growth matters more for Established).

#### 6.4 Pattern & Score API
- `GET /api/patterns/:chain/:address` — detected patterns with confidence
- `GET /api/score/:chain/:address` — composite momentum score with breakdown
- `GET /api/patterns/history/:chain/:address` — historical pattern events with outcomes

### Frontend Changes

#### 6.5 Score Badge
Circular score indicator on each position card (0-100, color gradient red to green).

#### 6.6 Pattern Chips
Active patterns displayed as chips/badges on positions. Click to expand with explanation.

#### 6.7 Portfolio Heatmap
Grid view of all open positions colored by momentum score.

#### 6.8 Pattern P&L Report
"You saw 'Whale Accumulation' 5 times. When you held, the token averaged +30% in 24h."

---

## Phase 7: Holder Distribution Analysis (Optional / On-Demand)

### Goal
Deeper holder analysis beyond holder count. On-demand rather than scheduled, due to API cost constraints on free tiers.

### Data Sources
- **Helius** `getTokenAccounts` — full holder enumeration (expensive, use sparingly)
- **Token snapshots** (Phase 2) — holder count trends over time

### Backend Changes

#### 7.1 `holder_snapshots` Table
```sql
CREATE TABLE holder_snapshots (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  chain            TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  captured_at      TEXT NOT NULL,
  total_holders    INTEGER,
  top_10_pct       REAL,
  top_20_pct       REAL,
  top_50_pct       REAL,
  whales           INTEGER,
  large            INTEGER,
  medium           INTEGER,
  small            INTEGER,
  dev_wallet_pct   REAL,
  raw_top_holders  TEXT, -- JSON array of top 20 [{address, balance, pct}]
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_holder_snap ON holder_snapshots(chain, contract_address, captured_at);
```

#### 7.2 On-Demand Holder Analysis
Triggered manually (button click), not scheduled. Caches result for 30 minutes.
1. Fetch top N holders via Helius (paginate only as needed, cap at 100-200 holders)
2. Compute concentration metrics
3. Cross-reference with `watched_wallets`
4. Store snapshot

#### 7.3 Holder API Endpoints
- `GET /api/holders/:chain/:address` — latest holder distribution (triggers fetch if stale)
- `GET /api/holders/:chain/:address/history` — holder metric trends from snapshots

### Frontend Changes

#### 7.4 Holder Distribution Panel
- Pie/donut chart of supply concentration
- Top holders table (with labels for known wallets)
- Holder count trend sparkline (from Phase 2 snapshots)
- "Refresh" button for on-demand fetch

---

## Future Phases (Roadmap, Not Yet Scoped)

### Narrative / Sector Tagging
- Add `tags TEXT` column to `positions` (JSON array)
- Tag positions with narratives (AI, political, animal, celebrity)
- Analytics by narrative: "Your AI narrative trades returned +40% avg"

### Social Sentiment Integration
- LunarCrush / Santiment APIs for Twitter mention velocity
- At minimum: link to token's Twitter search from position detail page

### External Alert Channels
- Telegram bot for push notifications
- Discord webhook support
- Configurable per alert rule

### Auto-Import from Wallet
- Connect own wallet to auto-log trades as positions/executions
- Reconcile on-chain P&L with journal entries

### On-Chain Volume vs CEX Volume
- For tokens listed on both DEX and CEX (BONK, WIF, PEPE)
- DEX-heavy volume = on-chain natives; CEX-heavy = retail

---

## Implementation Priorities (Revised)

| Phase | Effort | Dependencies | Value | Status |
|---|---|---|---|---|
| **Phase 1**: Momentum Dashboard | Medium | None — extends existing DexScreener integration | High | Next |
| **Phase 2**: Time-Series Snapshots | Medium | Phase 1 | High | — |
| **Phase 3**: Safety Analysis | Medium | DexScreener + RugCheck + PumpPortal (free) | High (capital protection) | — |
| **Phase 4**: Alert System | Medium | Phases 1-3 data to alert on | High (transforms passive to active) | — |
| **Phase 5**: Wallet Tracking | High | Shyft + PumpPortal integration | High (alpha source) | — |
| **Phase 6**: Pattern Detection | High | Phases 1-3 + optional Phase 5 | High (synthesis) | — |
| **Phase 7**: Holder Distribution | Low-Medium | Helius (on-demand) | Low-Medium (nice to have) | Optional |

---

## API Key Requirements

| Service | Env Var | Status |
|---|---|---|
| DexScreener | None needed | Already integrated |
| Helius | `HELIUS_API_KEY` | Already have |
| Etherscan | `ETHERSCAN_API_KEY` | Already have |
| Shyft | `SHYFT_API_KEY` | Need to sign up (free) |
| RugCheck | `RUGCHECK_API_KEY` | Need to sign up (free) |
| GeckoTerminal | None needed | New integration |
| PumpPortal | None needed | New integration (WebSocket) |
| Alchemy | `ALCHEMY_API_KEY` | Future (free tier, for scaling wallet tracking) |

---

## Architecture Notes

### Polling Architecture
- **`SnapshotService`**: `setTimeout`-based recursive loop with `last_poll_at` persisted in `service_state` table. Crash-resilient.
- **`WalletSyncService`**: Same pattern for Shyft-based wallet polling (10-min interval).
- **`PumpPortalService`**: Persistent WebSocket connection, auto-reconnect.
- **`SafetyService`**: Lower-frequency polling (15-30 min).
- **`AlertEngine`**: Runs after each snapshot cycle, evaluates rules against fresh data.
- All services share the DexScreener rate limiter. Batch DB writes in transactions.

### Frontend State
Split into domain-specific Zustand stores:
- `useMetricsStore` — token metrics, snapshots, derivatives
- `useWalletsStore` — watched wallets, wallet transactions
- `useAlertsStore` — alert rules, alert history, unread count
- `useSafetyStore` — safety data, risk flags
- Keep existing `useStore` for positions, prices, portfolio

### Database
- SQLite with WAL mode (already enabled)
- Snapshot pruning runs every poll cycle (hard requirement, not optional) — 7-day retention
- Pattern events retained for 30 days (for P&L attribution backfill)

### Feature Flags
Env-var based feature flags for each module:
```
FEATURE_SNAPSHOTS=true
FEATURE_WALLETS=true
FEATURE_SAFETY=true
FEATURE_ALERTS=true
FEATURE_PATTERNS=true
```
Graceful degradation if required API keys are missing — disable the feature, don't crash.

### Integration with Existing Features
- **Reflections**: Add `metrics_snapshot TEXT` (JSON) column — snapshot token metrics when reflection is written
- **AI Analysis**: Extend `tradeDataSummary` prompt with momentum scores, safety flags, wallet activity for memecoin positions
- **Hypothesis Testing**: AI reflection suggestions reference whether hypothesis held up using snapshot data
- **Rules**: Alert system evaluates user-defined rules against live data; warn when entering positions that violate rules
- **New page**: Dedicated `/momentum` page for memecoin analytics (separate from existing Analytics page)
