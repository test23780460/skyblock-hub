export const siteConfig = {
  name: process.env.SITE_NAME?.trim() || "SkyPilot",
  description:
    "A policy-conscious Hypixel SkyBlock companion for progression, gear, economy, and planning.",
  shortDescription: "Know your next move in SkyBlock.",
  url: process.env.SITE_URL?.trim() || "http://localhost:3000",
  repository: "test23780460/skyblock-hub",
} as const;

function envFlag(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export const featureFlags = {
  // Integrations that spend quota, expose user data, or trust platform-injected
  // identity stay off until the deployment explicitly enables them.
  aiAssistant: envFlag("ENABLE_AI_ASSISTANT", false),
  chatGptAuth: envFlag("ENABLE_CHATGPT_AUTH", false),
  playerLookup: envFlag("ENABLE_PLAYER_LOOKUP", false),
  publicEconomy: envFlag("ENABLE_PUBLIC_ECONOMY", false),
  ads: envFlag("ENABLE_ADS", false),
  premium: envFlag("ENABLE_PREMIUM", false),
  publicProfiles: envFlag("ENABLE_PUBLIC_PROFILES", false),
  guildTools: envFlag("ENABLE_GUILD_TOOLS", false),
  priceAlerts: envFlag("ENABLE_PRICE_ALERTS", false),
  experimental: envFlag("ENABLE_EXPERIMENTAL_FEATURES", false),
} as const;

export const rarity = {
  common: "#c9d1d9",
  uncommon: "#62e887",
  rare: "#56a8ff",
  epic: "#bd7cff",
  legendary: "#ffb84d",
  mythic: "#ff78cd",
  divine: "#61ecff",
  special: "#ff7373",
  verySpecial: "#ff7373",
} as const;

export type FeatureFlag = keyof typeof featureFlags;
