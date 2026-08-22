import { ProviderError } from "../../../../lib/providers/errors";
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
    return await activeAuctionSnapshotResponse(
      request,
      await publicEconomyStore(),
    );
  } catch (error) {
    return economyStorageErrorResponse(error);
  }
}

export async function activeAuctionSnapshotResponse(
  request: Request,
  store: Pick<PublicEconomySnapshotStore, "readActiveAuctionSnapshot">,
): Promise<Response> {
  const url = new URL(request.url);
  const page = parsePage(url.searchParams.get("page"));
  const query = safeSearch(url.searchParams.get("q"));
  const limit = safeLimit(url.searchParams.get("limit"), 100, 250);
  const result = await store.readActiveAuctionSnapshot({ query, page, limit });
  if (!result) return economyNotReadyResponse("active-auction");
  const totalPages = Math.max(1, Math.ceil(result.matchingAuctions / limit));

  return economyResponse({
    source: "hypixel-public-snapshot",
    cacheStatus: snapshotCacheStatus(result.state),
    fetchedAt: result.state.publishedAt.toISOString(),
    lastUpdated: result.state.sourceUpdatedAt.toISOString(),
    page,
    totalPages,
    totalAuctions: result.state.recordCount,
    auctions: result.auctions,
    meta: {
      returned: result.auctions.length,
      pageAvailable: result.auctions.length,
      matchingAuctions: result.matchingAuctions,
      skippedMalformed: result.state.skippedMalformed,
    },
    notice:
      "This is a normalized SkyPilot listing view; bidder, seller, profile, lore, and raw item payloads are intentionally omitted.",
  });
}

function parsePage(value: string | null): number {
  if (!value) return 0;
  const page = Number(value);
  if (Number.isSafeInteger(page) && page >= 0 && page <= 10_000) return page;
  throw new ProviderError({
    code: "invalid_input",
    message: "The requested auction page is invalid.",
    status: 400,
    action: "Choose a non-negative page number.",
  });
}
