import { DataUnavailableError } from "./errors";

export type RateLimitState = {
  calls: number;
  tripped: boolean;
  tripReason: string | null;
  maxCalls: number;
  paceMs: number;
};

export const DEFAULT_MAX_PROVIDER_CALLS = 900;
export const DEFAULT_PACE_MS = 200;

/**
 * Rate-limit circuit breaker for provider calls during broad scans.
 * Trips on first rate_limit — remaining symbols get DATA_SKIP, not NO_TRADE.
 */
export class ProviderRateLimiter {
  private calls = 0;
  private tripped = false;
  private tripReason: string | null = null;
  private lastCallAt = 0;

  constructor(
    readonly maxCalls = DEFAULT_MAX_PROVIDER_CALLS,
    readonly paceMs = DEFAULT_PACE_MS,
  ) {}

  get state(): RateLimitState {
    return {
      calls: this.calls,
      tripped: this.tripped,
      tripReason: this.tripReason,
      maxCalls: this.maxCalls,
      paceMs: this.paceMs,
    };
  }

  canCall(): boolean {
    return !this.tripped && this.calls < this.maxCalls;
  }

  async beforeCall(): Promise<void> {
    if (this.tripped) {
      throw new DataUnavailableError("PROVIDER RATE LIMITED", {
        reason: "rate_limit",
      });
    }
    if (this.calls >= this.maxCalls) {
      this.trip("max_calls_per_run");
      throw new DataUnavailableError("PROVIDER CALL BUDGET EXCEEDED", {
        reason: "rate_limit",
      });
    }
    const now = Date.now();
    const wait = this.lastCallAt + this.paceMs - now;
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    this.lastCallAt = Date.now();
    this.calls += 1;
  }

  onError(error: unknown): void {
    if (
      error instanceof DataUnavailableError &&
      error.details?.reason === "rate_limit"
    ) {
      this.trip("provider_rate_limit");
    }
  }

  trip(reason: string): void {
    this.tripped = true;
    this.tripReason = reason;
  }
}
