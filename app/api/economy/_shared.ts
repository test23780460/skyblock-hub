import { ProviderError, providerErrorResponse } from "@/lib/providers/errors";
import type {
  PublishedEconomyFeed,
  PublicEconomySnapshotStore,
} from "@/lib/repositories/economy-snapshots";

export async function publicEconomyStore(): Promise<PublicEconomySnapshotStore> {
  const [{ getDb }, { DrizzlePublicEconomySnapshotStore }] =
    await Promise.all([
      import("@/db"),
      import(
        "@/lib/repositories/drizzle/public-economy-snapshot.repository"
      ),
    ]);
  return new DrizzlePublicEconomySnapshotStore(getDb());
}

export function snapshotCacheStatus(
  state: PublishedEconomyFeed,
  now = new Date(),
): "snapshot" | "stale" {
  return state.expiresAt.getTime() > now.getTime() ? "snapshot" : "stale";
}

export function economyResponse(data: unknown): Response {
  return Response.json(
    { data },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
      },
    },
  );
}

export function economyNotReadyResponse(feed: string): Response {
  return providerErrorResponse(
    new ProviderError({
      code: "upstream_unavailable",
      message: `The ${feed} snapshot is not ready yet.`,
      status: 503,
      action:
        "Wait for the elected economy worker to publish its first complete snapshot.",
      retryable: true,
      retryAfterSeconds: 60,
    }),
  );
}

/** Prevents database or binding details from crossing the public API boundary. */
export function economyStorageErrorResponse(error: unknown): Response {
  if (error instanceof ProviderError) return providerErrorResponse(error);
  return providerErrorResponse(
    new ProviderError({
      code: "upstream_unavailable",
      message: "The durable public-economy snapshot is temporarily unavailable.",
      status: 503,
      action: "Try again after the next scheduled worker cycle.",
      retryable: true,
      cause: error,
    }),
  );
}

export function safeSearch(value: string | null): string {
  return (
    value
      ?.trim()
      .toLowerCase()
      .replaceAll("%", "")
      .replaceAll("\\", "")
      .slice(0, 64) ?? ""
  );
}

export function safeLimit(
  value: string | null,
  fallback: number,
  maximum: number,
): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? Math.min(parsed, maximum)
    : fallback;
}
