import { db } from '../database';
import { fetchDexScreenerFullMetrics } from '../routes/prices';
import { fetchHolderCount } from '../routes/holders';

const DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const RETENTION_DAYS = 7;
const SERVICE_NAME = 'snapshot_service';

interface PositionRow {
  chain: string;
  contract_address: string;
}

interface ServiceStateRow {
  service_name: string;
  last_run_at: string;
  metadata: string | null;
}

export class SnapshotService {
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pollIntervalMs: number;

  constructor() {
    const envInterval = process.env.SNAPSHOT_INTERVAL_MS;
    this.pollIntervalMs = envInterval ? parseInt(envInterval, 10) : DEFAULT_POLL_INTERVAL_MS;
    if (isNaN(this.pollIntervalMs) || this.pollIntervalMs < 30000) {
      this.pollIntervalMs = DEFAULT_POLL_INTERVAL_MS;
    }
  }

  async start() {
    if (this.running) return;
    this.running = true;
    console.log(`[SnapshotService] Starting with ${this.pollIntervalMs / 1000}s interval`);

    // Check last poll time to determine initial delay
    const lastRun = this.getLastRunTime();
    if (lastRun) {
      const elapsed = Date.now() - new Date(lastRun).getTime();
      const remaining = this.pollIntervalMs - elapsed;
      if (remaining > 0) {
        console.log(`[SnapshotService] Last poll was ${Math.round(elapsed / 1000)}s ago, waiting ${Math.round(remaining / 1000)}s`);
        this.timer = setTimeout(() => this.loop(), remaining);
        return;
      }
    }

    // Poll immediately
    this.loop();
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log('[SnapshotService] Stopped');
  }

  private async loop() {
    if (!this.running) return;

    try {
      await this.poll();
    } catch (e) {
      console.error('[SnapshotService] Poll failed:', e);
    }

    if (this.running) {
      this.timer = setTimeout(() => this.loop(), this.pollIntervalMs);
    }
  }

  private async poll() {
    // 1. Get all open positions with chain + contract_address
    const positions = db.prepare(`
      SELECT DISTINCT chain, contract_address
      FROM positions
      WHERE status = 'open' AND chain IS NOT NULL AND contract_address IS NOT NULL
    `).all() as PositionRow[];

    if (positions.length === 0) {
      console.log('[SnapshotService] No open positions with chain data, skipping poll');
      this.updateServiceState();
      this.pruneOldSnapshots();
      return;
    }

    console.log(`[SnapshotService] Polling ${positions.length} tokens...`);

    // 2. Fetch data for each position (rate limiter is built into fetchDexScreenerFullMetrics)
    const snapshots: {
      chain: string;
      contractAddress: string;
      capturedAt: string;
      price: number | null;
      volume24h: number | null;
      volumeBuy24h: number | null;
      volumeSell24h: number | null;
      buys24h: number | null;
      sells24h: number | null;
      liquidityUsd: number | null;
      holderCount: number | null;
      marketCap: number | null;
      buyPressure: number | null;
      rawMetrics: string | null;
    }[] = [];

    const now = new Date().toISOString();

    for (const pos of positions) {
      try {
        const result = await fetchDexScreenerFullMetrics(pos.chain, pos.contract_address);
        if (!result) {
          console.warn(`[SnapshotService] No data for ${pos.chain}/${pos.contract_address}`);
          continue;
        }

        const { metrics } = result;
        const volumeBuy24h = metrics.volumeBuy.h24;
        const volumeSell24h = metrics.volumeSell.h24;
        const hasVolumeSplit = volumeBuy24h > 0 || volumeSell24h > 0;

        let buyPressure: number | null = null;
        if (hasVolumeSplit) {
          const totalVol = volumeBuy24h + volumeSell24h;
          buyPressure = totalVol > 0 ? volumeBuy24h / totalVol : null;
        } else {
          // Fall back to txn count ratio when volume split is unavailable
          const totalTxns = metrics.txns.h24.buys + metrics.txns.h24.sells;
          buyPressure = totalTxns > 0 ? metrics.txns.h24.buys / totalTxns : null;
        }

        // Fetch holder count (best-effort, non-blocking per token)
        let holderCount: number | null = null;
        try {
          holderCount = await fetchHolderCount(pos.chain, pos.contract_address);
        } catch {
          // ignore holder count errors
        }

        snapshots.push({
          chain: pos.chain,
          contractAddress: pos.contract_address,
          capturedAt: now,
          price: result.priceData.price,
          volume24h: metrics.volume.h24,
          volumeBuy24h,
          volumeSell24h,
          buys24h: metrics.txns.h24.buys,
          sells24h: metrics.txns.h24.sells,
          liquidityUsd: metrics.liquidity.usd,
          holderCount,
          marketCap: result.marketCap,
          buyPressure,
          rawMetrics: JSON.stringify(metrics),
        });
      } catch (e) {
        console.error(`[SnapshotService] Error fetching ${pos.chain}/${pos.contract_address}:`, e);
      }
    }

    // 3. Batch insert snapshots in a single transaction
    if (snapshots.length > 0) {
      const insertStmt = db.prepare(`
        INSERT INTO token_snapshots
        (chain, contract_address, captured_at, price, volume_24h, volume_buy_24h, volume_sell_24h,
         buys_24h, sells_24h, liquidity_usd, holder_count, market_cap, buy_pressure, raw_metrics)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertAll = db.transaction(() => {
        for (const s of snapshots) {
          insertStmt.run(
            s.chain, s.contractAddress, s.capturedAt,
            s.price, s.volume24h, s.volumeBuy24h, s.volumeSell24h,
            s.buys24h, s.sells24h, s.liquidityUsd, s.holderCount,
            s.marketCap, s.buyPressure, s.rawMetrics,
          );
        }
      });

      insertAll();
      console.log(`[SnapshotService] Inserted ${snapshots.length} snapshots`);
    }

    // 4. Prune old snapshots (MUST run every cycle)
    this.pruneOldSnapshots();

    // 5. Update service state
    this.updateServiceState();
  }

  private pruneOldSnapshots() {
    try {
      const result = db.prepare(`
        DELETE FROM token_snapshots
        WHERE datetime(captured_at) < datetime('now', '-' || ? || ' days')
      `).run(RETENTION_DAYS);
      if (result.changes > 0) {
        console.log(`[SnapshotService] Pruned ${result.changes} old snapshots`);
      }
    } catch (e) {
      console.error('[SnapshotService] Prune failed:', e);
    }
  }

  private getLastRunTime(): string | null {
    const row = db.prepare(
      'SELECT last_run_at FROM service_state WHERE service_name = ?'
    ).get(SERVICE_NAME) as ServiceStateRow | undefined;
    return row?.last_run_at ?? null;
  }

  private updateServiceState() {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO service_state (service_name, last_run_at, metadata)
      VALUES (?, ?, NULL)
    `).run(SERVICE_NAME, now);
  }
}

// Singleton instance
export const snapshotService = new SnapshotService();
