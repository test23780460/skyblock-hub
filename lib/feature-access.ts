import { featureFlags, type FeatureFlag } from "./config";

const labels: Readonly<Record<FeatureFlag, string>> = {
  aiAssistant: "AI assistant",
  chatGptAuth: "account authentication",
  playerLookup: "player lookup",
  publicEconomy: "public economy data",
  ads: "advertising",
  premium: "premium features",
  publicProfiles: "public profiles",
  guildTools: "guild tools",
  priceAlerts: "price alerts",
  experimental: "experimental features",
};

export function featureUnavailableResponse(flag: FeatureFlag): Response | null {
  if (featureFlags[flag]) return null;
  return Response.json(
    {
      error: {
        code: "feature_disabled",
        message: `SkyPilot ${labels[flag]} is not enabled in this environment.`,
      },
    },
    { status: 503, headers: { "cache-control": "no-store" } },
  );
}
