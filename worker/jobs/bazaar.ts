import {
  hypixelProvider,
  type HypixelProvider,
} from "../../lib/providers/hypixel";
import { ProviderError } from "../../lib/providers/errors";
import type { EconomyPublicationLease } from "../../lib/repositories/economy-snapshots";
import type { EconomyJobResult, EconomySnapshotSink } from "./types";

export const BAZAAR_REFRESH_BASELINE_MS = 60_000;

export async function refreshBazaar(options: {
  provider?: HypixelProvider;
  sink?: EconomySnapshotSink;
  lease?: EconomyPublicationLease;
  previousLastUpdated?: number | null;
} = {}): Promise<EconomyJobResult> {
  const sink = requireSink(options.sink);
  const lease = requireLease(options.lease);
  const provider = options.provider ?? hypixelProvider;
  const result = await provider.getBazaar();
  if (result.cacheStatus === "stale") {
    return {
      job: "bazaar",
      status: "skipped",
      sourceUpdatedAt: result.data.lastUpdated,
      records: result.data.products.length,
      cacheStatus: "stale",
      detail: "The upstream refresh failed; the stale cache remains readable but was not persisted as a new snapshot.",
    };
  }
  if (options.previousLastUpdated === result.data.lastUpdated) {
    // Repair-safe: a prior cycle may have published the current generation and
    // then failed before both aggregate resolutions completed. The aggregate
    // upsert is source-timestamp idempotent, so checking again is safe.
    await sink.aggregateBazaarHistory(result.data.lastUpdated, lease);
    return {
      job: "bazaar",
      status: "skipped",
      sourceUpdatedAt: result.data.lastUpdated,
      records: result.data.products.length,
      cacheStatus: result.cacheStatus,
      detail: "The Hypixel lastUpdated value has not changed; aggregate history was verified idempotently.",
    };
  }
  if (
    options.previousLastUpdated !== null &&
    options.previousLastUpdated !== undefined &&
    result.data.lastUpdated < options.previousLastUpdated
  ) {
    throw new ProviderError({
      code: "invalid_response",
      message: "Hypixel returned an older Bazaar snapshot than the published version.",
      status: 502,
      action: "Keep the current durable snapshot and wait for a newer worker cycle.",
      retryable: true,
    });
  }

  await sink.saveBazaarSnapshot(result.data, lease);
  await sink.aggregateBazaarHistory(result.data.lastUpdated, lease);
  return {
    job: "bazaar",
    status: "completed",
    sourceUpdatedAt: result.data.lastUpdated,
    records: result.data.products.length,
    cacheStatus: result.cacheStatus,
  };
}

function requireLease(
  lease: EconomyPublicationLease | undefined,
): EconomyPublicationLease {
  if (lease) return lease;
  throw new ProviderError({
    code: "upstream_unavailable",
    message: "Public economy publication requires an elected worker lease.",
    status: 503,
    action: "Run this job through the elected economy worker.",
  });
}

function requireSink(sink: EconomySnapshotSink | undefined): EconomySnapshotSink {
  if (sink) return sink;
  throw new ProviderError({
    code: "upstream_unavailable",
    message: "Public economy ingestion requires durable snapshot storage.",
    status: 503,
    action: "Run this job through the elected economy worker.",
  });
}
