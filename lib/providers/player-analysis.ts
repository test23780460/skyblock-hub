import { buildPlayerAnalysis } from "../analysis/profile";
import type { PlayerAnalysis } from "../models";
import { ProviderError } from "./errors";
import { normalizeMinecraftUsername } from "./guards";
import { hypixelProvider, type HypixelProvider } from "./hypixel";
import { mojangProvider, type MojangProvider } from "./mojang";

type PlayerAnalysisDependencies = {
  mojang?: MojangProvider;
  hypixel?: HypixelProvider;
};

export async function getPlayerAnalysis(
  username: string,
  requestedProfileId: string | null = null,
  dependencies: PlayerAnalysisDependencies = {},
): Promise<PlayerAnalysis> {
  const mojang = dependencies.mojang ?? mojangProvider;
  const hypixel = dependencies.hypixel ?? hypixelProvider;
  const validatedUsername = normalizeMinecraftUsername(username);
  if (!hypixel.isConfigured()) {
    throw new ProviderError({
      code: "missing_credentials",
      message: "Live Hypixel profile analysis is not configured.",
      status: 503,
      action:
        "An administrator must add a server-side Hypixel production API key.",
    });
  }
  const identity = await mojang.lookupUsername(validatedUsername);
  const [player, profiles] = await Promise.all([
    hypixel.getPlayer(identity.data.uuid),
    hypixel.getSkyBlockProfiles(identity.data.uuid),
  ]);

  if (player.data.uuid !== identity.data.uuid) {
    throw new ProviderError({
      code: "invalid_response",
      message: "The player identity returned by the game services did not match.",
      status: 502,
      action: "Try the lookup again later.",
      retryable: true,
    });
  }

  const cacheStatus = combineCacheStatus(
    player.cacheStatus,
    profiles.cacheStatus,
  );
  const oldestHypixelSnapshot = Math.min(player.storedAt, profiles.storedAt);

  return buildPlayerAnalysis({
    identity: identity.data,
    hypixelPlayer: player.data,
    profiles: profiles.data,
    requestedProfileId,
    fetchedAt: new Date(oldestHypixelSnapshot).toISOString(),
    cacheStatus,
  });
}

function combineCacheStatus(
  ...statuses: ("fresh" | "cached" | "stale")[]
): "fresh" | "cached" | "stale" {
  if (statuses.includes("stale")) return "stale";
  if (statuses.every((status) => status === "fresh")) return "fresh";
  return "cached";
}
