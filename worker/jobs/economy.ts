import { ProviderError } from "../../lib/providers/errors";
import {
  hypixelProvider,
  type HypixelProvider,
} from "../../lib/providers/hypixel";
import type { PublicEconomySnapshotStore } from "../../lib/repositories/economy-snapshots";
import { refreshActiveAuctions, refreshEndedAuctions } from "./auctions";
import { refreshBazaar } from "./bazaar";
import type { EconomyCycleResult, EconomyJobResult } from "./types";

export const ECONOMY_WORKER_LEASE_MS = 15 * 60_000;
const MAX_BACKOFF_MS = 15 * 60_000;

type EconomyCycleOptions = {
  store: PublicEconomySnapshotStore;
  provider?: HypixelProvider;
  owner?: string;
  now?: () => Date;
  random?: () => number;
};

export async function runPublicEconomyCycle(
  options: EconomyCycleOptions,
): Promise<EconomyCycleResult> {
  const provider = options.provider ?? hypixelProvider;
  const owner = options.owner ?? `economy_${crypto.randomUUID()}`;
  const now = options.now ?? (() => new Date());
  const random = options.random ?? Math.random;
  const claimedAt = now();
  const claim = await options.store.claimWorkerLease({
    owner,
    now: claimedAt,
    leaseMs: ECONOMY_WORKER_LEASE_MS,
  });

  if (!claim.claimed) {
    if (claim.reason === "backoff") {
      return {
        status: "backing-off",
        jobs: [],
        retryAfterSeconds: secondsUntil(claim.state.backoffUntil, claimedAt),
        errorCode: claim.state.lastErrorCode ?? "economy_circuit_open",
      };
    }
    return { status: "skipped", jobs: [] };
  }

  const lease = { owner, token: claim.state.leaseToken };
  const jobs: EconomyJobResult[] = [];
  try {
    const endedState = await options.store.getFeedState("ended-auctions");
    const ended = await refreshEndedAuctions({
      provider,
      sink: options.store,
      lease,
      previousLastUpdated: endedState?.sourceUpdatedAt.getTime() ?? null,
    });
    assertUsableResult(ended);
    jobs.push(ended);

    const bazaarState = await options.store.getFeedState("bazaar");
    const bazaar = await refreshBazaar({
      provider,
      sink: options.store,
      lease,
      previousLastUpdated: bazaarState?.sourceUpdatedAt.getTime() ?? null,
    });
    assertUsableResult(bazaar);
    jobs.push(bazaar);

    const activeState = await options.store.getFeedState("active-auctions");
    const active = await refreshActiveAuctions({
      provider,
      sink: options.store,
      lease,
      previousLastUpdated: activeState?.sourceUpdatedAt.getTime() ?? null,
    });
    assertUsableResult(active);
    jobs.push(active);

    await options.store.recordWorkerSuccess({ ...lease, at: now() });
    return { status: "completed", jobs };
  } catch (error) {
    const classified = classifyEconomyFailure(error);
    const failedAt = now();
    const backoffMs = computeEconomyBackoffMs({
      status: classified.status,
      consecutiveFailures: claim.state.consecutiveFailures,
      retryAfterSeconds: classified.retryAfterSeconds,
      random,
    });
    await options.store.recordWorkerFailure({
      owner,
      token: lease.token,
      at: failedAt,
      code: classified.code,
      status: classified.status,
      backoffUntil: new Date(failedAt.getTime() + backoffMs),
    });
    return {
      status: "failed",
      jobs,
      retryAfterSeconds: Math.max(1, Math.ceil(backoffMs / 1_000)),
      errorCode: classified.code,
    };
  } finally {
    await options.store.releaseWorkerLease(lease);
  }
}

export function computeEconomyBackoffMs(input: {
  status: number;
  consecutiveFailures: number;
  retryAfterSeconds?: number;
  random?: () => number;
}): number {
  const failureNumber = Math.max(1, Math.floor(input.consecutiveFailures) + 1);
  const exponent = Math.min(failureNumber - 1, 8);
  const baseMs = input.status === 429 ? 5_000 : input.status === 503 ? 15_000 : 10_000;
  const exponentialMs = Math.min(MAX_BACKOFF_MS, baseMs * 2 ** exponent);
  const retryAfterMs =
    input.retryAfterSeconds !== undefined &&
    Number.isFinite(input.retryAfterSeconds) &&
    input.retryAfterSeconds >= 0
      ? input.retryAfterSeconds * 1_000
      : 0;
  const jitterMs = Math.floor(Math.max(0, Math.min(1, (input.random ?? Math.random)())) * 5_000);
  return Math.min(
    MAX_BACKOFF_MS,
    Math.max(exponentialMs, retryAfterMs) + jitterMs,
  );
}

function assertUsableResult(result: EconomyJobResult): void {
  if (result.cacheStatus !== "stale") return;
  throw new ProviderError({
    code: "upstream_unavailable",
    message: "Hypixel public economy data could not be refreshed.",
    status: 503,
    action: "Keep serving the last durable snapshot while the global circuit backs off.",
    retryable: true,
  });
}

function classifyEconomyFailure(error: unknown): {
  code: string;
  status: number;
  retryAfterSeconds?: number;
} {
  if (error instanceof ProviderError) {
    return {
      code: error.code,
      status: error.status,
      ...(error.retryAfterSeconds === undefined
        ? {}
        : { retryAfterSeconds: error.retryAfterSeconds }),
    };
  }
  return { code: "economy_worker_failed", status: 503 };
}

function secondsUntil(value: Date | null, now: Date): number | undefined {
  if (!value || value.getTime() <= now.getTime()) return undefined;
  return Math.max(1, Math.ceil((value.getTime() - now.getTime()) / 1_000));
}
