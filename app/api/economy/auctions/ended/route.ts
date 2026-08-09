import { providerErrorResponse } from "../../../../../lib/providers/errors";
import { hypixelProvider } from "../../../../../lib/providers/hypixel";
import { featureUnavailableResponse } from "../../../../../lib/feature-access";

export async function GET(request: Request): Promise<Response> {
  const unavailable = featureUnavailableResponse("publicEconomy");
  if (unavailable) return unavailable;
  try {
    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get("limit"));
    const result = await hypixelProvider.getEndedAuctions();
    const auctions = [...result.data.auctions]
      .sort((left, right) => (right.endedAt ?? 0) - (left.endedAt ?? 0))
      .slice(0, limit);

    return new Response(
      JSON.stringify({
        data: {
          source: "hypixel",
          cacheStatus: result.cacheStatus,
          fetchedAt: new Date(result.storedAt).toISOString(),
          lastUpdated: new Date(result.data.lastUpdated).toISOString(),
          auctions,
          meta: {
            returned: auctions.length,
            available: result.data.auctions.length,
            skippedMalformed: result.data.skippedAuctions,
          },
          notice:
            "Buyer, seller, profile, and raw item data are deliberately omitted from this minimal sale feed.",
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

function parseLimit(value: string | null): number {
  if (!value) return 100;
  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 500) : 100;
}
