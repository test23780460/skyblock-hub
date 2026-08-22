import type {
  ActiveAuction,
  BazaarProduct,
  BazaarSnapshot,
  EndedAuction,
  EndedAuctionSnapshot,
} from "../providers/hypixel.js";

export const PUBLIC_ECONOMY_PROVIDER = "hypixel-public" as const;

export type PublicEconomyFeed =
  | "bazaar"
  | "active-auctions"
  | "ended-auctions";

export type BazaarHistoryResolution = "hour" | "day";

export type PublicBazaarHistoryBucket = {
  productId: string;
  resolution: BazaarHistoryResolution;
  bucketStartAt: Date;
  firstSourceUpdatedAt: Date;
  lastSourceUpdatedAt: Date;
  sampleCount: number;
  buyOpen: number;
  buyHigh: number;
  buyLow: number;
  buyClose: number;
  sellOpen: number;
  sellHigh: number;
  sellLow: number;
  sellClose: number;
  averageBuyVolume: number | null;
  averageSellVolume: number | null;
};

export type PublicEconomyWorkerState = {
  provider: typeof PUBLIC_ECONOMY_PROVIDER;
  leaseOwner: string | null;
  leaseUntil: Date | null;
  leaseToken: number;
  backoffUntil: Date | null;
  consecutiveFailures: number;
  lastAttemptAt: Date | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  lastErrorCode: string | null;
  lastErrorStatus: number | null;
};

export type EconomyPublicationLease = {
  owner: string;
  token: number;
};

export type EconomyLeaseClaim = {
  claimed: boolean;
  reason: "acquired" | "leased" | "backoff";
  state: PublicEconomyWorkerState;
};

export type PublishedEconomyFeed = {
  feed: PublicEconomyFeed;
  sourceUpdatedAt: Date;
  publishedAt: Date;
  expiresAt: Date;
  recordCount: number;
  skippedMalformed: number;
};

export interface EconomySnapshotSink {
  saveBazaarSnapshot(
    snapshot: BazaarSnapshot,
    lease: EconomyPublicationLease,
  ): Promise<void>;
  aggregateBazaarHistory(
    sourceUpdatedAt: number,
    lease: EconomyPublicationLease,
  ): Promise<void>;
  replaceActiveAuctionSnapshot(snapshot: {
    lastUpdated: number;
    auctions: ActiveAuction[];
    skippedAuctions?: number;
  }, lease: EconomyPublicationLease): Promise<void>;
  saveEndedAuctionSnapshot(
    snapshot: EndedAuctionSnapshot,
    lease: EconomyPublicationLease,
  ): Promise<void>;
}

export interface PublicEconomySnapshotStore extends EconomySnapshotSink {
  claimWorkerLease(input: {
    owner: string;
    now: Date;
    leaseMs: number;
  }): Promise<EconomyLeaseClaim>;
  recordWorkerSuccess(input: EconomyPublicationLease & { at: Date }): Promise<void>;
  recordWorkerFailure(input: {
    owner: string;
    token: number;
    at: Date;
    code: string;
    status: number;
    backoffUntil: Date;
  }): Promise<void>;
  releaseWorkerLease(lease: EconomyPublicationLease): Promise<void>;
  getFeedState(feed: PublicEconomyFeed): Promise<PublishedEconomyFeed | null>;
  readBazaarSnapshot(input: {
    query: string;
    limit: number;
  }): Promise<{
    state: PublishedEconomyFeed;
    products: BazaarProduct[];
  } | null>;
  readBazaarHistory(input: {
    productId: string;
    resolution: BazaarHistoryResolution;
    limit: number;
  }): Promise<{
    state: PublishedEconomyFeed;
    buckets: PublicBazaarHistoryBucket[];
  } | null>;
  readActiveAuctionSnapshot(input: {
    query: string;
    page: number;
    limit: number;
  }): Promise<{
    state: PublishedEconomyFeed;
    auctions: ActiveAuction[];
    matchingAuctions: number;
  } | null>;
  readEndedAuctionSnapshot(input: { limit: number }): Promise<{
    state: PublishedEconomyFeed;
    auctions: EndedAuction[];
    available: number;
  } | null>;
}
