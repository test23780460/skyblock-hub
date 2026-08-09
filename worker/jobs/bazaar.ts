import {
  hypixelProvider,
  type HypixelProvider,
} from "../../lib/providers/hypixel";
import type { EconomyJobResult, EconomySnapshotSink } from "./types";

export const BAZAAR_REFRESH_BASELINE_MS = 60_000;

export async function refreshBazaar(options: {
  provider?: HypixelProvider;
  sink?: EconomySnapshotSink;
  previousLastUpdated?: number | null;
} = {}): Promise<EconomyJobResult> {
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
    return {
      job: "bazaar",
      status: "skipped",
      sourceUpdatedAt: result.data.lastUpdated,
      records: result.data.products.length,
      cacheStatus: result.cacheStatus,
      detail: "The Hypixel lastUpdated value has not changed.",
    };
  }

  if (options.sink) await options.sink.saveBazaarSnapshot(result.data);
  return {
    job: "bazaar",
    status: "completed",
    sourceUpdatedAt: result.data.lastUpdated,
    records: result.data.products.length,
    cacheStatus: result.cacheStatus,
  };
}
