import { featureFlags } from "../../../lib/config";

export async function GET(): Promise<Response> {
  const checkedAt = new Date().toISOString();
  let bindings = {
    database: false,
    playerCache: false,
    playerAdmission: false,
    providerBudget: false,
    hypixelCredential: false,
    economyService: false,
  };
  try {
    const { env } = await import("cloudflare:workers");
    bindings = {
      database: Boolean(env.DB),
      playerCache: Boolean(env.PLAYER_CACHE),
      playerAdmission: Boolean(env.PLAYER_ACTOR_LIMITER && env.PLAYER_GLOBAL_LIMITER),
      providerBudget: Boolean(env.PROVIDER_BUDGET_DB),
      hypixelCredential: Boolean(env.HYPIXEL_API_KEY?.trim()),
      economyService: Boolean(env.ECONOMY_SERVICE),
    };
  } catch {
    // A non-Cloudflare process can still render the app with integrations off.
  }

  const playerConfigured = bindings.playerCache &&
    bindings.playerAdmission && bindings.providerBudget && bindings.hypixelCredential;
  const economyConfigured = bindings.database && bindings.economyService;
  const degraded = (featureFlags.playerLookup && !playerConfigured) ||
    (featureFlags.publicEconomy && !economyConfigured);

  return Response.json(
    {
      data: {
        status: degraded ? "degraded" : "ok",
        service: "skypilot",
        environment: process.env.SKYPILOT_ENVIRONMENT?.trim() || "development",
        checkedAt,
        dependencies: {
          playerAnalysis: {
            enabled: featureFlags.playerLookup,
            configured: playerConfigured,
            status: featureFlags.playerLookup
              ? playerConfigured ? "available" : "misconfigured"
              : "disabled",
            cache: bindings.playerCache ? "workers-kv" : "unavailable",
            admission: bindings.playerAdmission && bindings.providerBudget
              ? "location-filter-plus-durable-budget"
              : "unavailable",
          },
          publicEconomy: {
            enabled: featureFlags.publicEconomy,
            configured: economyConfigured,
            status: featureFlags.publicEconomy
              ? economyConfigured ? "private-service-bound" : "misconfigured"
              : "disabled",
          },
          database: {
            configured: bindings.database,
            status: bindings.database ? "bound" : "unavailable",
          },
        },
        notice: "Configuration only; this endpoint does not spend upstream quota or expose credentials.",
      },
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );
}
