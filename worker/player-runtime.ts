import { MemoryTtlCache, type TtlCache } from "../lib/cache/ttl-cache";
import type { PlayerAnalysis } from "../lib/models";
import { KvTtlCache } from "../lib/platform/cloudflare/kv-ttl-cache";
import { reserveD1ProviderBudget } from "../lib/platform/cloudflare/d1-provider-budget";
import { ProviderError } from "../lib/providers/errors";
import { HypixelProvider } from "../lib/providers/hypixel";
import { MojangProvider } from "../lib/providers/mojang";
import { getPlayerAnalysis } from "../lib/providers/player-analysis";
import { getPlayerAnalysisWithNegativeCache } from "../lib/providers/player-request-policy";
import type { FetchImplementation } from "../lib/providers/http";

const localCacheByNamespace = new WeakMap<KVNamespace, MemoryTtlCache>();
const sharedCacheByNamespace = new WeakMap<KVNamespace, KvTtlCache>();
const PLAYER_PROVIDER_BUDGET = 20;
const PLAYER_ANALYSIS_RESERVATION = 2;

export async function getCloudflarePlayerAnalysis(
  playerInput: string,
  profileId: string | null,
): Promise<PlayerAnalysis> {
  const { env } = await import("cloudflare:workers");
  return getCloudflarePlayerAnalysisWithEnvironment(
    env,
    playerInput,
    profileId,
  );
}

type PlayerRuntimeEnvironment = Pick<
  Env,
  "PROVIDER_BUDGET_DB" | "PLAYER_CACHE" | "PLAYER_GLOBAL_LIMITER" | "HYPIXEL_API_KEY"
>;

export async function getCloudflarePlayerAnalysisWithEnvironment(
  environment: PlayerRuntimeEnvironment,
  playerInput: string,
  profileId: string | null,
  dependencies: {
    fetchImplementation?: FetchImplementation;
    reserveProviderBudget?: typeof reserveD1ProviderBudget;
  } = {},
): Promise<PlayerAnalysis> {
  const cache = playerCache(environment.PLAYER_CACHE);
  return getPlayerAnalysisWithNegativeCache(playerInput, profileId, {
    negativeCache: cache,
    load: async () => {
      const hypixelFetchImplementation = admittedHypixelFetch(
        environment,
        dependencies.fetchImplementation,
        dependencies.reserveProviderBudget,
      );
      const hypixel = new HypixelProvider({
        apiKey: environment.HYPIXEL_API_KEY,
        cache,
        fetchImplementation: hypixelFetchImplementation,
      });
      const mojang = new MojangProvider({
        cache,
        fetchImplementation: dependencies.fetchImplementation,
      });
      return getPlayerAnalysis(playerInput, profileId, { hypixel, mojang });
    },
  });
}

function admittedHypixelFetch(
  environment: PlayerRuntimeEnvironment,
  fetchImplementation: FetchImplementation | undefined,
  reserveProviderBudget: typeof reserveD1ProviderBudget | undefined,
): FetchImplementation {
  // Admission is request-scoped and begins only when a provider cache miss
  // reaches the outbound transport. Parallel player/profile misses share this
  // one promise; cached analyses spend no rate-limit allowance.
  let admission: Promise<void> | null = null;
  return async (input, init) => {
    admission ??= enforcePlayerAdmission(
      environment,
      reserveProviderBudget ?? reserveD1ProviderBudget,
    );
    await admission;
    return fetchImplementation
      ? fetchImplementation(input, init)
      : globalThis.fetch(input, init);
  };
}

function playerCache(namespace: KVNamespace): TtlCache {
  let cache = sharedCacheByNamespace.get(namespace);
  if (cache) return cache;
  let local = localCacheByNamespace.get(namespace);
  if (!local) {
    local = new MemoryTtlCache(2_000);
    localCacheByNamespace.set(namespace, local);
  }
  cache = new KvTtlCache(namespace, local);
  sharedCacheByNamespace.set(namespace, cache);
  return cache;
}

async function enforcePlayerAdmission(
  environment: PlayerRuntimeEnvironment,
  reserveProviderBudget: typeof reserveD1ProviderBudget,
): Promise<void> {
  try {
    const shared = await environment.PLAYER_GLOBAL_LIMITER.limit({
      key: "hypixel-player-analysis",
    });
    if (!shared.success) throw lookupLimitError();
    const reserved = await reserveProviderBudget(environment.PROVIDER_BUDGET_DB, {
      scope: "hypixel:authenticated",
      tokens: PLAYER_ANALYSIS_RESERVATION,
      limit: PLAYER_PROVIDER_BUDGET,
    });
    if (!reserved) throw lookupLimitError();
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError({
      code: "upstream_unavailable",
      message: "SkyPilot's lookup guard is temporarily unavailable.",
      status: 503,
      action: "Try the lookup again shortly.",
      retryable: true,
      cause: error,
    });
  }
}

function lookupLimitError(): ProviderError {
  return new ProviderError({
    code: "rate_limited",
    message: "SkyPilot has reached its short-term live lookup limit.",
    status: 429,
    action: "Wait about a minute before trying another player lookup.",
    retryable: true,
    retryAfterSeconds: 60,
  });
}
