import { buildPlayerAnalysis } from "../analysis/profile";
import type { PlayerAnalysis } from "../models";
import { ProviderError } from "./errors";
import {
  normalizeMinecraftPlayerInput,
  type MinecraftPlayerInput,
} from "./guards";
import { hypixelProvider, type HypixelProvider } from "./hypixel";
import { mojangProvider, type MojangProvider } from "./mojang";

type PlayerAnalysisDependencies = {
  mojang?: MojangProvider;
  hypixel?: HypixelProvider;
};

export async function getPlayerAnalysis(
  playerInput: string,
  requestedProfileId: string | null = null,
  dependencies: PlayerAnalysisDependencies = {},
): Promise<PlayerAnalysis> {
  const mojang = dependencies.mojang ?? mojangProvider;
  const hypixel = dependencies.hypixel ?? hypixelProvider;
  const selector = normalizeMinecraftPlayerInput(playerInput);
  if (!hypixel.isConfigured()) {
    throw new ProviderError({
      code: "missing_credentials",
      message: "Live Hypixel profile analysis is not configured.",
      status: 503,
      action:
        "An administrator must add a server-side Hypixel production API key.",
    });
  }
  const { identity, player, profiles } = await resolvePlayer(
    selector,
    mojang,
    hypixel,
  );

  if (player.data.uuid !== identity.uuid) {
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
    identity,
    hypixelPlayer: player.data,
    profiles: profiles.data,
    requestedProfileId,
    fetchedAt: new Date(oldestHypixelSnapshot).toISOString(),
    cacheStatus,
  });
}

async function resolvePlayer(
  selector: MinecraftPlayerInput,
  mojang: MojangProvider,
  hypixel: HypixelProvider,
) {
  if (selector.kind === "uuid") {
    const [player, profiles] = await Promise.all([
      hypixel.getPlayer(selector.uuid),
      hypixel.getSkyBlockProfiles(selector.uuid),
    ]);
    return {
      identity: {
        uuid: selector.uuid,
        username: player.data.displayName,
      },
      player,
      profiles,
    };
  }

  let identity;
  try {
    identity = await mojang.lookupUsername(selector.username);
  } catch (error) {
    if (!isTransportFailure(error)) throw error;
    return resolveUsernameThroughHypixel(selector.username, hypixel);
  }

  const [player, profiles] = await Promise.all([
    hypixel.getPlayer(identity.data.uuid),
    hypixel.getSkyBlockProfiles(identity.data.uuid),
  ]);
  return { identity: identity.data, player, profiles };
}

async function resolveUsernameThroughHypixel(
  username: string,
  hypixel: HypixelProvider,
) {
  let player;
  try {
    player = await hypixel.getPlayerByUsername(username);
  } catch (error) {
    if (!isTransportFailure(error)) throw error;
    throw new ProviderError({
      code: error.code,
      message: "Player identity services could not be reached.",
      status: error.status,
      action:
        "Try again after a short wait. If username resolution remains unavailable, enter the player's Java UUID.",
      retryable: true,
      cause: error,
    });
  }
  const profiles = await hypixel.getSkyBlockProfiles(player.data.uuid);
  return {
    identity: {
      uuid: player.data.uuid,
      username: player.data.displayName,
    },
    player,
    profiles,
  };
}

function isTransportFailure(error: unknown): error is ProviderError {
  return error instanceof ProviderError &&
    (error.code === "network_error" ||
      error.code === "upstream_timeout" ||
      error.code === "upstream_unavailable");
}

function combineCacheStatus(
  ...statuses: ("fresh" | "cached" | "stale")[]
): "fresh" | "cached" | "stale" {
  if (statuses.includes("stale")) return "stale";
  if (statuses.every((status) => status === "fresh")) return "fresh";
  return "cached";
}
