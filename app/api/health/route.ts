import { sharedProviderCache } from "../../../lib/cache/ttl-cache";
import { hypixelProvider } from "../../../lib/providers/hypixel";
import { hypixelRateLimits } from "../../../lib/providers/rate-limit";
import { featureFlags } from "../../../lib/config";

export async function GET(): Promise<Response> {
  const configured = hypixelProvider.isConfigured();
  const rateLimits = hypixelRateLimits.snapshot();
  const now = Date.now();
  const status = featureFlags.playerLookup && !configured ? "degraded" : "ok";

  return new Response(
    JSON.stringify({
      data: {
        status,
        checkedAt: new Date(now).toISOString(),
        dependencies: {
          hypixelAuthenticated: {
            enabled: featureFlags.playerLookup,
            configured,
            status: featureFlags.playerLookup && configured ? cooldownStatus(rateLimits.authenticated, now) : "disabled",
            backoff: publicBackoffState(rateLimits.authenticated, now),
          },
          hypixelPublicEconomy: {
            enabled: featureFlags.publicEconomy,
            configured: featureFlags.publicEconomy,
            status: featureFlags.publicEconomy ? cooldownStatus(rateLimits.public, now) : "disabled",
            backoff: publicBackoffState(rateLimits.public, now),
          },
          minecraftIdentity: { configured: true, status: "available" },
        },
        cache: sharedProviderCache.stats(),
        notice:
          "This health route reports local configuration and backoff state without making an upstream probe or exposing credentials.",
      },
    }),
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );
}

function cooldownStatus(
  state: ReturnType<typeof hypixelRateLimits.snapshot>["authenticated"],
  now: number,
): "available" | "backing_off" {
  return state.blockedUntil !== null && state.blockedUntil > now
    ? "backing_off"
    : "available";
}

function publicBackoffState(
  state: ReturnType<typeof hypixelRateLimits.snapshot>["authenticated"],
  now: number,
) {
  const retryAfterSeconds =
    state.blockedUntil !== null && state.blockedUntil > now
      ? Math.ceil((state.blockedUntil - now) / 1_000)
      : null;
  return {
    active: retryAfterSeconds !== null,
    retryAfterSeconds,
  };
}
