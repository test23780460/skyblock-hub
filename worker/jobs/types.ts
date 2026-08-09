import type {
  ActiveAuction,
  BazaarSnapshot,
  EndedAuctionSnapshot,
} from "../../lib/providers/hypixel";

export interface EconomySnapshotSink {
  saveBazaarSnapshot(snapshot: BazaarSnapshot): Promise<void>;
  replaceActiveAuctionSnapshot(snapshot: {
    lastUpdated: number;
    auctions: ActiveAuction[];
  }): Promise<void>;
  saveEndedAuctionSnapshot(snapshot: EndedAuctionSnapshot): Promise<void>;
}

export type EconomyJobResult = {
  job: "bazaar" | "active-auctions" | "ended-auctions";
  status: "completed" | "skipped";
  sourceUpdatedAt: number;
  records: number;
  cacheStatus: "fresh" | "cached" | "stale";
  detail?: string;
};

