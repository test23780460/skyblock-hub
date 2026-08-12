import { featureUnavailableResponse } from "../../../../lib/feature-access";
import type { PublicEconomySnapshotStore } from "../../../../lib/repositories/economy-snapshots";
import {
  economyNotReadyResponse,
  economyResponse,
  economyStorageErrorResponse,
  publicEconomyStore,
  safeLimit,
  safeSearch,
  snapshotCacheStatus,
} from "../_shared";

export async function GET(request: Request): Promise<Response> {
  const unavailable = featureUnavailableResponse("publicEconomy");
  if (unavailable) return unavailable;
  try {
    return await bazaarSnapshotResponse(request, await publicEconomyStore());
  } catch (error) {
    return economyStorageErrorResponse(error);
  }
}

export async function bazaarSnapshotResponse(
  request: Request,
  store: Pick<PublicEconomySnapshotStore, "readBazaarSnapshot">,
): Promise<Response> {
  const url = new URL(request.url);
  const query = safeSearch(url.searchParams.get("q"));
  const limit = safeLimit(url.searchParams.get("limit"), 100, 250);
  const result = await store.readBazaarSnapshot({ query, limit });
  if (!result) return economyNotReadyResponse("Bazaar");

  return economyResponse({
    source: "hypixel-public-snapshot",
    cacheStatus: snapshotCacheStatus(result.state),
    fetchedAt: result.state.publishedAt.toISOString(),
    lastUpdated: result.state.sourceUpdatedAt.toISOString(),
    products: result.products,
    meta: {
      returned: result.products.length,
      available: result.state.recordCount,
      skippedMalformed: result.state.skippedMalformed,
    },
    notice:
      "Prices are Hypixel's computed Bazaar summary values, not guaranteed executable trades or profit.",
  });
}
