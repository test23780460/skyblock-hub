import { providerErrorResponse } from "../../../../lib/providers/errors";
import { hypixelProvider } from "../../../../lib/providers/hypixel";
import { featureUnavailableResponse } from "../../../../lib/feature-access";

export async function GET(request: Request): Promise<Response> {
  const unavailable = featureUnavailableResponse("publicEconomy");
  if (unavailable) return unavailable;
  try {
    const url = new URL(request.url);
    const query = safeSearch(url.searchParams.get("q"));
    const limit = safeLimit(url.searchParams.get("limit"), 100, 250);
    const result = await hypixelProvider.getBazaar();
    const products = result.data.products
      .filter((product) =>
        query ? product.productId.toLowerCase().includes(query) : true,
      )
      .slice(0, limit);

    return economyResponse({
      source: "hypixel",
      cacheStatus: result.cacheStatus,
      fetchedAt: new Date(result.storedAt).toISOString(),
      lastUpdated: new Date(result.data.lastUpdated).toISOString(),
      products,
      meta: {
        returned: products.length,
        available: result.data.products.length,
        skippedMalformed: result.data.skippedProducts,
      },
      notice:
        "Prices are Hypixel's computed Bazaar summary values, not guaranteed executable trades or profit.",
    });
  } catch (error) {
    return providerErrorResponse(error);
  }
}

function safeSearch(value: string | null): string {
  return value?.trim().toLowerCase().slice(0, 64) ?? "";
}

function safeLimit(value: string | null, fallback: number, maximum: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? Math.min(parsed, maximum)
    : fallback;
}

function economyResponse(data: unknown): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
