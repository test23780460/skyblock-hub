import { ProviderError } from "./errors";

export type HypixelRateScope = "authenticated" | "public";

export type RateLimitSnapshot = {
  limit: number | null;
  remaining: number | null;
  resetAt: number | null;
  blockedUntil: number | null;
  consecutiveThrottles: number;
};

type MutableRateLimitState = RateLimitSnapshot;

export class HypixelRateLimitRegistry {
  private readonly scopes: Record<HypixelRateScope, MutableRateLimitState> = {
    authenticated: emptyState(),
    public: emptyState(),
  };

  constructor(
    private readonly now: () => number = Date.now,
    private readonly random: () => number = Math.random,
  ) {}

  assertAvailable(scope: HypixelRateScope): void {
    const state = this.scopes[scope];
    const now = this.now();
    if (state.blockedUntil === null || state.blockedUntil <= now) {
      if (state.resetAt !== null && state.resetAt <= now) {
        state.remaining = null;
        state.resetAt = null;
        state.blockedUntil = null;
      }
      return;
    }

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((state.blockedUntil - now) / 1_000),
    );
    throw new ProviderError({
      code: "rate_limited",
      message: "Hypixel is temporarily rate limiting SkyPilot.",
      status: 429,
      action: "Use the cached data or try again after the cooldown.",
      retryable: true,
      retryAfterSeconds,
    });
  }

  reserve(scope: HypixelRateScope): void {
    this.assertAvailable(scope);
    const state = this.scopes[scope];
    if (state.remaining !== null && state.remaining > 0) {
      state.remaining -= 1;
    }
  }

  observe(scope: HypixelRateScope, headers: Headers, status: number): void {
    const state = this.scopes[scope];
    const now = this.now();
    const limit = parseHeaderNumber(headers.get("RateLimit-Limit"));
    const remaining = parseHeaderNumber(headers.get("RateLimit-Remaining"));
    const resetSeconds = parseHeaderNumber(headers.get("RateLimit-Reset"));

    if (limit !== null) state.limit = limit;
    if (remaining !== null) state.remaining = remaining;
    if (resetSeconds !== null) state.resetAt = now + resetSeconds * 1_000;

    if (remaining === 0 && state.resetAt !== null) {
      state.blockedUntil = Math.max(state.blockedUntil ?? 0, state.resetAt);
    }

    if (status === 429) {
      state.consecutiveThrottles += 1;
      const retryAfter = parseRetryAfter(headers.get("Retry-After"), now);
      const resetAt = state.resetAt ?? 0;
      const exponentialSeconds = Math.min(
        300,
        2 ** Math.min(state.consecutiveThrottles, 8),
      );
      const jitterMs = Math.floor(this.random() * 1_000);
      state.blockedUntil = Math.max(
        state.blockedUntil ?? 0,
        retryAfter ?? 0,
        resetAt,
        now + exponentialSeconds * 1_000 + jitterMs,
      );
      return;
    }

    if (status >= 200 && status < 400) {
      state.consecutiveThrottles = 0;
      if (state.blockedUntil !== null && state.blockedUntil <= now) {
        state.blockedUntil = null;
      }
    }
  }

  snapshot(): Record<HypixelRateScope, RateLimitSnapshot> {
    return {
      authenticated: { ...this.scopes.authenticated },
      public: { ...this.scopes.public },
    };
  }
}

export const hypixelRateLimits = new HypixelRateLimitRegistry();

function emptyState(): MutableRateLimitState {
  return {
    limit: null,
    remaining: null,
    resetAt: null,
    blockedUntil: null,
    consecutiveThrottles: 0,
  };
}

function parseHeaderNumber(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function parseRetryAfter(value: string | null, now: number): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return now + seconds * 1_000;
  const date = Date.parse(value);
  return Number.isFinite(date) && date > now ? date : null;
}
