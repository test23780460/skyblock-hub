import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { MemoryTtlCache } from "../lib/cache/ttl-cache";
import { HypixelProvider } from "../lib/providers/hypixel";
import { DrizzlePublicEconomySnapshotStore } from "../lib/repositories/drizzle/public-economy-snapshot.repository";
import { runPublicEconomyCycle } from "./jobs/economy";
import type { EconomyCycleResult } from "./jobs/types";

type CloudflareEconomyCycleOptions = {
  provider?: HypixelProvider;
  owner?: string;
  now?: () => Date;
  random?: () => number;
};

/**
 * Cloudflare composition for the portable economy cycle.
 *
 * The provider cache is invocation-local: D1 is the cross-invocation source of
 * truth and stale fallback, so no Promise or request-bound I/O is retained in a
 * reused Worker isolate. Public Hypixel endpoints never receive an API key.
 */
export async function runCloudflarePublicEconomyCycle(
  binding: D1Database,
  options: CloudflareEconomyCycleOptions = {},
): Promise<EconomyCycleResult> {
  const provider =
    options.provider ??
    new HypixelProvider({
      apiKey: null,
      cache: new MemoryTtlCache(512),
    });
  const db = drizzle(binding, { schema });
  const store = new DrizzlePublicEconomySnapshotStore(
    db,
    options.now === undefined ? {} : { now: options.now },
  );

  return runPublicEconomyCycle({
    store,
    provider,
    ...(options.owner === undefined ? {} : { owner: options.owner }),
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.random === undefined ? {} : { random: options.random }),
  });
}
