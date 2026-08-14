import { ProviderError } from "../../lib/providers/errors";
import {
  hypixelProvider,
  type ActiveAuction,
  type HypixelProvider,
} from "../../lib/providers/hypixel";
import type { EconomyJobResult, EconomySnapshotSink } from "./types";
import type { EconomyPublicationLease } from "../../lib/repositories/economy-snapshots";

export const ACTIVE_AUCTION_REFRESH_BASELINE_MS = 60_000;
export const ENDED_AUCTION_REFRESH_BASELINE_MS = 55_000;

const MAX_AUCTION_PAGES = 256;
const PAGE_CONCURRENCY = 2;

export async function refreshActiveAuctions(options: {
  provider?: HypixelProvider;
  sink?: EconomySnapshotSink;
  lease?: EconomyPublicationLease;
  previousLastUpdated?: number | null;
} = {}): Promise<EconomyJobResult> {
  const sink = requireSink(options.sink);
  const lease = requireLease(options.lease);
  const provider = options.provider ?? hypixelProvider;
  const first = await provider.getActiveAuctions(0);
  const snapshot = first.data;

  if (first.cacheStatus === "stale") {
    return {
      job: "active-auctions",
      status: "skipped",
      sourceUpdatedAt: snapshot.lastUpdated,
      records: snapshot.totalAuctions,
      cacheStatus: "stale",
      detail: "The upstream refresh failed; the stale cache was not published as a new active snapshot.",
    };
  }
  if (options.previousLastUpdated === snapshot.lastUpdated) {
    return {
      job: "active-auctions",
      status: "skipped",
      sourceUpdatedAt: snapshot.lastUpdated,
      records: snapshot.totalAuctions,
      cacheStatus: first.cacheStatus,
      detail: "The Hypixel lastUpdated value has not changed.",
    };
  }
  if (
    options.previousLastUpdated !== null &&
    options.previousLastUpdated !== undefined &&
    snapshot.lastUpdated < options.previousLastUpdated
  ) {
    throw olderSnapshotError("active-auction");
  }
  if (snapshot.totalPages < 1 || snapshot.totalPages > MAX_AUCTION_PAGES) {
    throw new ProviderError({
      code: "invalid_response",
      message: "Hypixel reported an unsafe active-auction page count.",
      status: 502,
      action: "Wait for the next scheduled snapshot instead of retrying immediately.",
      retryable: true,
    });
  }

  const auctions: ActiveAuction[] = [...snapshot.auctions];
  let skippedAuctions = snapshot.skippedAuctions;
  const pages = Array.from(
    { length: Math.max(0, snapshot.totalPages - 1) },
    (_, index) => index + 1,
  );
  let sawStaleCache = false;

  for (let index = 0; index < pages.length; index += PAGE_CONCURRENCY) {
    const batch = pages.slice(index, index + PAGE_CONCURRENCY);
    const results = await Promise.all(
      batch.map((page) => provider.getActiveAuctions(page)),
    );
    for (const result of results) {
      if (result.data.lastUpdated !== snapshot.lastUpdated) {
        throw new ProviderError({
          code: "upstream_unavailable",
          message: "The active-auction snapshot changed during ingestion.",
          status: 503,
          action: "Discard this partial cycle and wait for the next scheduled run.",
          retryable: true,
        });
      }
      sawStaleCache ||= result.cacheStatus === "stale";
      skippedAuctions += result.data.skippedAuctions;
      auctions.push(...result.data.auctions);
    }
  }

  if (sawStaleCache) {
    return {
      job: "active-auctions",
      status: "skipped",
      sourceUpdatedAt: snapshot.lastUpdated,
      records: auctions.length,
      cacheStatus: "stale",
      detail: "At least one page came from stale cache, so the partial snapshot was not published.",
    };
  }

  await sink.replaceActiveAuctionSnapshot({
    lastUpdated: snapshot.lastUpdated,
    auctions,
    skippedAuctions,
  }, lease);
  return {
    job: "active-auctions",
    status: "completed",
    sourceUpdatedAt: snapshot.lastUpdated,
    records: auctions.length,
    cacheStatus: sawStaleCache ? "stale" : first.cacheStatus,
  };
}

export async function refreshEndedAuctions(options: {
  provider?: HypixelProvider;
  sink?: EconomySnapshotSink;
  lease?: EconomyPublicationLease;
  previousLastUpdated?: number | null;
} = {}): Promise<EconomyJobResult> {
  const sink = requireSink(options.sink);
  const lease = requireLease(options.lease);
  const provider = options.provider ?? hypixelProvider;
  const result = await provider.getEndedAuctions();
  if (result.cacheStatus === "stale") {
    return {
      job: "ended-auctions",
      status: "skipped",
      sourceUpdatedAt: result.data.lastUpdated,
      records: result.data.auctions.length,
      cacheStatus: "stale",
      detail: "The upstream refresh failed; stale ended-auction data was not ingested again.",
    };
  }
  if (options.previousLastUpdated === result.data.lastUpdated) {
    return {
      job: "ended-auctions",
      status: "skipped",
      sourceUpdatedAt: result.data.lastUpdated,
      records: result.data.auctions.length,
      cacheStatus: result.cacheStatus,
      detail: "The Hypixel lastUpdated value has not changed.",
    };
  }
  if (
    options.previousLastUpdated !== null &&
    options.previousLastUpdated !== undefined &&
    result.data.lastUpdated < options.previousLastUpdated
  ) {
    throw olderSnapshotError("ended-auction");
  }

  await sink.saveEndedAuctionSnapshot(result.data, lease);
  return {
    job: "ended-auctions",
    status: "completed",
    sourceUpdatedAt: result.data.lastUpdated,
    records: result.data.auctions.length,
    cacheStatus: result.cacheStatus,
  };
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

function olderSnapshotError(feed: string): ProviderError {
  return new ProviderError({
    code: "invalid_response",
    message: `Hypixel returned an older ${feed} snapshot than the published version.`,
    status: 502,
    action: "Keep the current durable snapshot and wait for a newer worker cycle.",
    retryable: true,
  });
}
