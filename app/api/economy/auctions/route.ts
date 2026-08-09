import { ProviderError, providerErrorResponse } from "../../../../lib/providers/errors";
import { hypixelProvider } from "../../../../lib/providers/hypixel";
import { featureUnavailableResponse } from "../../../../lib/feature-access";

export async function GET(request: Request): Promise<Response> {
  const unavailable = featureUnavailableResponse("publicEconomy");
  if (unavailable) return unavailable;
  try {
    const url = new URL(request.url);
    const page = parsePage(url.searchParams.get("page"));
    const query = url.searchParams.get("q")?.trim().toLowerCase().slice(0, 64) ?? "";
    const limit = parseLimit(url.searchParams.get("limit"));
    const result = await hypixelProvider.getActiveAuctions(page);
    const auctions = result.data.auctions
      .filter((auction) =>
        query ? auction.itemName.toLowerCase().includes(query) : true,
      )
      .slice(0, limit);

    return new Response(
      JSON.stringify({
        data: {
          source: "hypixel",
          cacheStatus: result.cacheStatus,
          fetchedAt: new Date(result.storedAt).toISOString(),
          lastUpdated: new Date(result.data.lastUpdated).toISOString(),
          page: result.data.page,
          totalPages: result.data.totalPages,
          totalAuctions: result.data.totalAuctions,
          auctions,
          meta: {
            returned: auctions.length,
            pageAvailable: result.data.auctions.length,
            skippedMalformed: result.data.skippedAuctions,
          },
          notice:
            "This is a normalized SkyPilot listing view; bidder, seller, profile, lore, and raw item payloads are intentionally omitted.",
        },
      }),
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  } catch (error) {
    return providerErrorResponse(error);
  }
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

function parseLimit(value: string | null): number {
  if (!value) return 100;
  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 250) : 100;
}
