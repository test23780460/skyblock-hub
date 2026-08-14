export type {
  EconomySnapshotSink,
  PublicEconomySnapshotStore,
} from "../../lib/repositories/economy-snapshots";

export type EconomyJobResult = {
  job: "bazaar" | "active-auctions" | "ended-auctions";
  status: "completed" | "skipped";
  sourceUpdatedAt: number;
  records: number;
  cacheStatus: "fresh" | "cached" | "stale";
  detail?: string;
};

export type EconomyCycleResult = {
  status: "completed" | "skipped" | "backing-off" | "failed";
  jobs: EconomyJobResult[];
  retryAfterSeconds?: number;
  errorCode?: string;
};
