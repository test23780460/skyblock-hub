export type CacheLookup<T> = {
  value: T;
  state: "fresh" | "stale";
  storedAt: number;
  expiresAt: number;
  staleUntil: number;
};

export type CacheStats = {
  entries: number;
  hits: number;
  staleHits: number;
  misses: number;
  writes: number;
  evictions: number;
};

export interface TtlCache {
  get<T>(key: string): Promise<CacheLookup<T> | null>;
  set<T>(
    key: string,
    value: T,
    options: { ttlMs: number; staleTtlMs?: number },
  ): Promise<void>;
  delete(key: string): Promise<void>;
  deleteByPrefix(prefix: string): Promise<number>;
  stats(): CacheStats;
}

type MemoryEntry = {
  value: unknown;
  storedAt: number;
  expiresAt: number;
  staleUntil: number;
  lastAccessedAt: number;
};

export class MemoryTtlCache implements TtlCache {
  private readonly entries = new Map<string, MemoryEntry>();
  private readonly counters = {
    hits: 0,
    staleHits: 0,
    misses: 0,
    writes: 0,
    evictions: 0,
  };
  private operationsSinceSweep = 0;

  constructor(
    private readonly maxEntries = 2_000,
    private readonly now: () => number = Date.now,
  ) {}

  async get<T>(key: string): Promise<CacheLookup<T> | null> {
    const now = this.now();
    this.maybePruneExpired(now);
    const entry = this.entries.get(key);
    if (!entry) {
      this.counters.misses += 1;
      return null;
    }
    if (entry.staleUntil <= now) {
      this.entries.delete(key);
      this.counters.evictions += 1;
      this.counters.misses += 1;
      return null;
    }

    entry.lastAccessedAt = now;
    const state = entry.expiresAt > now ? "fresh" : "stale";
    if (state === "fresh") this.counters.hits += 1;
    else this.counters.staleHits += 1;

    return {
      value: entry.value as T,
      state,
      storedAt: entry.storedAt,
      expiresAt: entry.expiresAt,
      staleUntil: entry.staleUntil,
    };
  }

  async set<T>(
    key: string,
    value: T,
    options: { ttlMs: number; staleTtlMs?: number },
  ): Promise<void> {
    const ttlMs = positiveDuration(options.ttlMs);
    const staleTtlMs = Math.max(
      ttlMs,
      positiveDuration(options.staleTtlMs ?? ttlMs),
    );
    const now = this.now();
    this.maybePruneExpired(now);

    if (!this.entries.has(key) && this.entries.size >= this.maxEntries) {
      this.evictLeastRecentlyUsed();
    }
    this.entries.set(key, {
      value,
      storedAt: now,
      expiresAt: now + ttlMs,
      staleUntil: now + staleTtlMs,
      lastAccessedAt: now,
    });
    this.counters.writes += 1;
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async deleteByPrefix(prefix: string): Promise<number> {
    let deleted = 0;
    for (const key of this.entries.keys()) {
      if (!key.startsWith(prefix)) continue;
      this.entries.delete(key);
      deleted += 1;
    }
    return deleted;
  }

  stats(): CacheStats {
    this.pruneExpired(this.now());
    return {
      entries: this.entries.size,
      ...this.counters,
    };
  }

  private maybePruneExpired(now: number): void {
    this.operationsSinceSweep += 1;
    if (this.operationsSinceSweep < 128 && this.entries.size < this.maxEntries) return;
    this.operationsSinceSweep = 0;
    this.pruneExpired(now);
  }

  private pruneExpired(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.staleUntil > now) continue;
      this.entries.delete(key);
      this.counters.evictions += 1;
    }
  }

  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Number.POSITIVE_INFINITY;
    for (const [key, entry] of this.entries) {
      if (entry.lastAccessedAt >= oldestAccess) continue;
      oldestKey = key;
      oldestAccess = entry.lastAccessedAt;
    }
    if (oldestKey !== null) {
      this.entries.delete(oldestKey);
      this.counters.evictions += 1;
    }
  }
}

export type CachedLoadResult<T> = {
  data: T;
  cacheStatus: "fresh" | "cached" | "stale";
  storedAt: number;
};

export async function cachedLoad<T>(
  cache: TtlCache,
  key: string,
  options: {
    ttlMs: number;
    staleTtlMs?: number;
    staleIfError?: boolean;
  },
  loader: () => Promise<T>,
): Promise<CachedLoadResult<T>> {
  const cached = await cache.get<T>(key);
  if (cached?.state === "fresh") {
    return { data: cached.value, cacheStatus: "cached", storedAt: cached.storedAt };
  }

  // Do not retain request-scoped I/O promises in module state. Cloudflare may
  // reuse an isolate concurrently, and a promise created in one invocation is
  // not a safe cross-request synchronization primitive. Shared KV plus the
  // deployment admission limiter bounds duplicate cold misses.
  try {
    const data = await loader();
    await cache.set(key, data, options);
    return { data, cacheStatus: "fresh", storedAt: Date.now() };
  } catch (error) {
    if (cached?.state === "stale" && options.staleIfError !== false) {
      return {
        data: cached.value,
        cacheStatus: "stale",
        storedAt: cached.storedAt,
      };
    }
    throw error;
  }
}

/** Shared by all requests in one runtime; replace through TtlCache for multi-node deployments. */
export const sharedProviderCache: TtlCache = new MemoryTtlCache();

function positiveDuration(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.floor(value);
}
