import { summarizeBazaarHistory } from "../engines/bazaar-history.js";

type BazaarHistoryResolution = "hour" | "day";

type BazaarHistoryBucketInput = {
  bucketStartAt: Date;
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

export type BazaarHistoryView = {
  identity: {
    kind: "bazaar-product";
    productId: string;
    variantKey: null;
  };
  resolution: BazaarHistoryResolution;
  points: Array<{
    bucketStartAt: string;
    lastSourceUpdatedAt: string;
    sampleCount: number;
    buy: { open: number; high: number; low: number; close: number };
    sell: { open: number; high: number; low: number; close: number };
    averageBuyVolume: number | null;
    averageSellVolume: number | null;
    referenceClose: number;
  }>;
  summary: ReturnType<typeof summarizeBazaarHistory>;
};

export function buildBazaarHistoryView(input: {
  productId: string;
  resolution: BazaarHistoryResolution;
  buckets: readonly BazaarHistoryBucketInput[];
}): BazaarHistoryView {
  const ordered = [...input.buckets].sort(
    (left, right) => left.bucketStartAt.getTime() - right.bucketStartAt.getTime(),
  );
  const points = ordered.map((bucket) => ({
    bucketStartAt: bucket.bucketStartAt.toISOString(),
    lastSourceUpdatedAt: bucket.lastSourceUpdatedAt.toISOString(),
    sampleCount: bucket.sampleCount,
    buy: {
      open: bucket.buyOpen,
      high: bucket.buyHigh,
      low: bucket.buyLow,
      close: bucket.buyClose,
    },
    sell: {
      open: bucket.sellOpen,
      high: bucket.sellHigh,
      low: bucket.sellLow,
      close: bucket.sellClose,
    },
    averageBuyVolume: bucket.averageBuyVolume,
    averageSellVolume: bucket.averageSellVolume,
    referenceClose: (bucket.buyClose + bucket.sellClose) / 2,
  }));

  return {
    identity: {
      kind: "bazaar-product",
      productId: input.productId,
      variantKey: null,
    },
    resolution: input.resolution,
    points,
    summary: summarizeBazaarHistory(
      ordered.map((bucket) => ({
        at: bucket.bucketStartAt.getTime(),
        buyHigh: bucket.buyHigh,
        buyLow: bucket.buyLow,
        buyClose: bucket.buyClose,
        sellHigh: bucket.sellHigh,
        sellLow: bucket.sellLow,
        sellClose: bucket.sellClose,
        sampleCount: bucket.sampleCount,
      })),
    ),
  };
}
