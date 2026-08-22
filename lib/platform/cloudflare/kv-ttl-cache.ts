import type { CacheLookup, CacheStats, TtlCache } from "../../cache/ttl-cache";

type KvCacheEnvelope<T> = {
  value: T;
  storedAt: number;
  expiresAt: number;
  staleUntil: number;
};

export class KvTtlCache implements TtlCache {
  private readonly counters: CacheStats = {
    entries: 0,
    hits: 0,
    staleHits: 0,
    misses: 0,
    writes: 0,
    evictions: 0,
  };

  constructor(
    private readonly namespace: KVNamespace,
    private readonly local?: TtlCache,
    private readonly now: () => number = Date.now,
  ) {}

  async get<T>(key: string): Promise<CacheLookup<T> | null> {
    const local = await this.local?.get<T>(key);
    if (local) return local;
    const envelope = await this.namespace.get<KvCacheEnvelope<T>>(key, "json");
    if (!envelope || !validEnvelope(envelope)) {
      this.counters.misses += 1;
      return null;
    }
    const now = this.now();
    if (envelope.staleUntil <= now) {
      await this.namespace.delete(key);
      this.counters.evictions += 1;
      this.counters.misses += 1;
      return null;
    }
    const state = envelope.expiresAt > now ? "fresh" : "stale";
    if (state === "fresh") this.counters.hits += 1;
    else this.counters.staleHits += 1;
    return {
      value: envelope.value,
      state,
      storedAt: envelope.storedAt,
      expiresAt: envelope.expiresAt,
      staleUntil: envelope.staleUntil,
    };
  }

  async set<T>(
    key: string,
    value: T,
    options: { ttlMs: number; staleTtlMs?: number },
  ): Promise<void> {
    const ttlMs = positiveDuration(options.ttlMs);
    const staleTtlMs = Math.max(ttlMs, positiveDuration(options.staleTtlMs ?? ttlMs));
    const now = this.now();
    const envelope: KvCacheEnvelope<T> = {
      value,
      storedAt: now,
      expiresAt: now + ttlMs,
      staleUntil: now + staleTtlMs,
    };
    await this.namespace.put(key, JSON.stringify(envelope), {
      expirationTtl: Math.max(60, Math.ceil(staleTtlMs / 1_000)),
    });
    await this.local?.set(key, value, options);
    this.counters.writes += 1;
  }

  async delete(key: string): Promise<void> {
    await Promise.all([
      this.namespace.delete(key),
      this.local?.delete(key) ?? Promise.resolve(),
    ]);
  }

  async deleteByPrefix(): Promise<number> {
    // Broad KV scans turn a bounded request into an unbounded operation. Cache
    // records instead expire through their explicit TTLs.
    return 0;
  }

  stats(): CacheStats {
    return { ...this.counters };
  }
}

function validEnvelope(value: KvCacheEnvelope<unknown>): boolean {
  return Number.isFinite(value.storedAt) &&
    Number.isFinite(value.expiresAt) &&
    Number.isFinite(value.staleUntil) &&
    value.expiresAt >= value.storedAt &&
    value.staleUntil >= value.expiresAt;
}

function positiveDuration(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.floor(value);
}
