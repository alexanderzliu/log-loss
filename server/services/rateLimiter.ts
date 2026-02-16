/**
 * Token-bucket rate limiter for DexScreener API (60 req/min).
 * Shared between price routes and future snapshot service.
 * Uses a queue to serialize acquisition and prevent race conditions.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private maxTokens: number;
  private refillPerSecond: number;
  private queue: (() => void)[] = [];
  private processing = false;

  constructor(maxTokens: number, refillPerSecond: number) {
    this.maxTokens = maxTokens;
    this.refillPerSecond = refillPerSecond;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillPerSecond);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
      this.processQueue();
    });
  }

  private processQueue() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      const next = this.queue.shift()!;
      this.processing = false;
      next();
      this.processQueue();
    } else {
      const waitMs = Math.ceil(((1 - this.tokens) / this.refillPerSecond) * 1000);
      setTimeout(() => {
        this.refill();
        this.tokens -= 1;
        const next = this.queue.shift()!;
        this.processing = false;
        next();
        this.processQueue();
      }, waitMs);
    }
  }
}

// 60 requests per minute = 1 request per second refill rate
export const dexScreenerLimiter = new RateLimiter(60, 1);
