import { featureUnavailableResponse } from "../../../../../lib/feature-access";
import { ProviderError } from "../../../../../lib/providers/errors";
import type {
  BazaarHistoryResolution,
  PublicEconomySnapshotStore,
} from "../../../../../lib/repositories/economy-snapshots";
import { buildBazaarHistoryView } from "../../../../../lib/services/bazaar-history";
import {
  economyNotReadyResponse,
  economyResponse,
  economyStorageErrorResponse,
  publicEconomyStore,
  safeLimit,
  snapshotCacheStatus,
} from "../../_shared";

const MAX_BUCKETS: Record<BazaarHistoryResolution, number> = {
  hour: 90 * 24,
  day: 3 * 365,
};

export async function GET(request: Request): Promise<Response> {
  const unavailable = featureUnavailableResponse("publicEconomy");
  if (unavailable) return unavailable;
  try {
    return await bazaarHistoryResponse(request, await publicEconomyStore());
  } catch (error) {
    return economyStorageErrorResponse(error);
  }
}

export async function bazaarHistoryResponse(
  request: Request,
  store: Pick<PublicEconomySnapshotStore, "readBazaarHistory">,
): Promise<Response> {
  const url = new URL(request.url);
  const productId = parseProductId(url.searchParams.get("product"));
  const resolution = parseResolution(url.searchParams.get("resolution"));
  const limit = safeLimit(
    url.searchParams.get("limit"),
    resolution === "hour" ? 24 : 30,
    MAX_BUCKETS[resolution],
  );
  const result = await store.readBazaarHistory({ productId, resolution, limit });
  if (!result) return economyNotReadyResponse("Bazaar");
  const view = buildBazaarHistoryView({
    productId,
    resolution,
    buckets: result.buckets,
  });
  const aggregatedThrough = view.points.at(-1)?.lastSourceUpdatedAt ?? null;
  const collectionStatus = aggregatedThrough === null
    ? "collecting"
    : new Date(aggregatedThrough).getTime() < result.state.sourceUpdatedAt.getTime()
      ? "lagging"
      : "ready";

  return economyResponse({
    source: "hypixel-public-aggregate",
    cacheStatus: snapshotCacheStatus(result.state),
    fetchedAt: result.state.publishedAt.toISOString(),
    lastUpdated: result.state.sourceUpdatedAt.toISOString(),
    collectionStatus,
    aggregatedThrough,
    ...view,
    meta: {
      returned: view.points.length,
      retentionDays: resolution === "hour" ? 90 : 3 * 365,
    },
    notice:
      "History contains worker-built OHLC buckets from Hypixel Bazaar summary prices. It is not exact trade history, a guaranteed executable quote, or an item appraisal.",
  });
}

function parseProductId(value: string | null): string {
  const productId = value?.trim().toUpperCase() ?? "";
  if (!productId || productId.length > 128 || !/^[A-Z0-9_:.-]+$/.test(productId)) {
    throw new ProviderError({
      code: "invalid_input",
      message: "A valid Bazaar product ID is required.",
      status: 400,
      action: "Choose a product from the current Bazaar snapshot.",
    });
  }
  return productId;
}

function parseResolution(value: string | null): BazaarHistoryResolution {
  if (!value || value === "hour") return "hour";
  if (value === "day") return "day";
  throw new ProviderError({
    code: "invalid_input",
    message: "The requested Bazaar history resolution is invalid.",
    status: 400,
    action: "Use hour or day buckets.",
  });
}
