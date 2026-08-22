import { featureUnavailableResponse } from "../../../../../lib/feature-access";
import type { PublicEconomySnapshotStore } from "../../../../../lib/repositories/economy-snapshots";
import {
  economyNotReadyResponse,
  economyResponse,
  economyStorageErrorResponse,
  publicEconomyStore,
  safeLimit,
  snapshotCacheStatus,
} from "../../_shared";

export async function GET(request: Request): Promise<Response> {
  const unavailable = featureUnavailableResponse("publicEconomy");
  if (unavailable) return unavailable;
  try {
    return await endedAuctionSnapshotResponse(
      request,
      await publicEconomyStore(),
    );
  } catch (error) {
    return economyStorageErrorResponse(error);
  }
}

export async function endedAuctionSnapshotResponse(
  request: Request,
  store: Pick<PublicEconomySnapshotStore, "readEndedAuctionSnapshot">,
): Promise<Response> {
  const url = new URL(request.url);
  const limit = safeLimit(url.searchParams.get("limit"), 100, 500);
  const result = await store.readEndedAuctionSnapshot({ limit });
  if (!result) return economyNotReadyResponse("ended-auction");

  return economyResponse({
    source: "hypixel-public-snapshot",
    cacheStatus: snapshotCacheStatus(result.state),
    fetchedAt: result.state.publishedAt.toISOString(),
    lastUpdated: result.state.sourceUpdatedAt.toISOString(),
    auctions: result.auctions,
    meta: {
      returned: result.auctions.length,
      available: result.available,
      skippedMalformed: result.state.skippedMalformed,
    },
    notice:
      "Buyer, seller, profile, and raw item data are deliberately omitted from this minimal sale feed.",
  });
}
