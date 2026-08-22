import {
  cachedLoad,
  sharedProviderCache,
  type CachedLoadResult,
  type TtlCache,
} from "../cache/ttl-cache";
import { ProviderError } from "./errors";
import {
  boundedString,
  normalizeMinecraftUsername,
  normalizeUuid,
  requireObject,
} from "./guards";
import { requestJson, type FetchImplementation } from "./http";

const PRIMARY_LOOKUP_BASE_URL =
  "https://api.minecraftservices.com/minecraft/profile/lookup/name/";
const LEGACY_LOOKUP_BASE_URL =
  "https://api.mojang.com/users/profiles/minecraft/";
const PLAYERDB_LOOKUP_BASE_URL =
  "https://playerdb.co/api/player/minecraft/";
const PLAYERDB_USER_AGENT =
  "SkyPilot/0.1 (+https://skypilot.ptravis022.workers.dev)";
const USERNAME_TTL_MS = 24 * 60 * 60 * 1_000;
const USERNAME_STALE_TTL_MS = 7 * USERNAME_TTL_MS;

export type MinecraftIdentity = {
  uuid: string;
  username: string;
};

type MojangProviderOptions = {
  fetchImplementation?: FetchImplementation;
  cache?: TtlCache;
  timeoutMs?: number;
};

export class MojangProvider {
  private readonly fetchImplementation?: FetchImplementation;
  private readonly cache: TtlCache;
  private readonly timeoutMs: number;

  constructor(options: MojangProviderOptions = {}) {
    this.fetchImplementation = options.fetchImplementation;
    this.cache = options.cache ?? sharedProviderCache;
    this.timeoutMs = options.timeoutMs ?? 6_000;
  }

  async lookupUsername(
    input: string,
  ): Promise<CachedLoadResult<MinecraftIdentity>> {
    const username = normalizeMinecraftUsername(input);
    const cacheKey = `mojang:username:${username.toLowerCase()}`;

    return cachedLoad(
      this.cache,
      cacheKey,
      {
        ttlMs: USERNAME_TTL_MS,
        staleTtlMs: USERNAME_STALE_TTL_MS,
        staleIfError: true,
      },
      async () => {
        const payload = await this.requestIdentity(username);
        return normalizeIdentity(payload);
      },
    );
  }

  private async requestIdentity(username: string): Promise<unknown> {
    try {
      return await this.requestLookup(PRIMARY_LOOKUP_BASE_URL, username);
    } catch (error) {
      if (!isOfficialResolverUnavailable(error)) throw error;
    }

    try {
      return await this.requestLookup(LEGACY_LOOKUP_BASE_URL, username);
    } catch (error) {
      if (!isOfficialResolverUnavailable(error)) throw error;
    }

    const payload = await this.requestPlayerDbLookup(username);
    return normalizePlayerDbIdentity(payload, username);
  }

  private requestLookup(baseUrl: string, username: string): Promise<unknown> {
    const url = new URL(`${baseUrl}${encodeURIComponent(username)}`);
    return requestJson({
      provider: "Minecraft Services",
      url,
      fetchImplementation: this.fetchImplementation,
      timeoutMs: this.timeoutMs,
      maxResponseCharacters: 16_384,
      notFoundError: playerNotFoundError(),
    });
  }

  private requestPlayerDbLookup(username: string): Promise<unknown> {
    const url = new URL(
      `${PLAYERDB_LOOKUP_BASE_URL}${encodeURIComponent(username)}`,
    );
    return requestJson({
      provider: "PlayerDB",
      url,
      fetchImplementation: this.fetchImplementation,
      headers: { "User-Agent": PLAYERDB_USER_AGENT },
      timeoutMs: this.timeoutMs,
      maxResponseCharacters: 131_072,
      notFoundError: playerNotFoundError(),
      badRequestNotFoundCode: "minecraft.invalid_username",
    });
  }
}

function playerNotFoundError(): ProviderError {
  return new ProviderError({
    code: "player_not_found",
    message: "No Minecraft Java player was found with that username.",
    status: 404,
    action: "Check the spelling and try again.",
  });
}

function isOfficialResolverUnavailable(error: unknown): boolean {
  return error instanceof ProviderError &&
    (error.code === "network_error" ||
      error.code === "upstream_timeout" ||
      error.code === "upstream_unavailable" ||
      error.code === "forbidden");
}

function normalizePlayerDbIdentity(
  payload: unknown,
  expectedUsername: string,
): { id: string; name: string } {
  const root = requireObject(payload, "PlayerDB");
  const data = requireObject(root.data, "PlayerDB");
  const player = requireObject(data.player, "PlayerDB");
  const rawId = boundedString(player.raw_id, 64);
  const username = boundedString(player.username, 16);
  if (root.success !== true || root.code !== "player.found" || !rawId || !username) {
    throw invalidPlayerDbResponse();
  }

  try {
    const normalizedUsername = normalizeMinecraftUsername(username);
    if (normalizedUsername.toLowerCase() !== expectedUsername.toLowerCase()) {
      throw invalidPlayerDbResponse();
    }

    return {
      id: normalizeUuid(rawId),
      name: normalizedUsername,
    };
  } catch (error) {
    if (error instanceof ProviderError && error.code === "invalid_response") {
      throw error;
    }
    throw invalidPlayerDbResponse(error);
  }
}

function invalidPlayerDbResponse(cause?: unknown): ProviderError {
  return new ProviderError({
    code: "invalid_response",
    message: "PlayerDB returned an invalid Minecraft identity.",
    status: 502,
    action: "Try again later or enter the player's Java UUID.",
    retryable: true,
    cause,
  });
}

function normalizeIdentity(payload: unknown): MinecraftIdentity {
  const object = requireObject(payload, "Minecraft Services");
  const id = boundedString(object.id, 64);
  const name = boundedString(object.name, 16);
  if (!id || !name) {
    throw new ProviderError({
      code: "invalid_response",
      message: "Minecraft Services returned an incomplete player identity.",
      status: 502,
      action: "Try again later.",
      retryable: true,
    });
  }

  return {
    uuid: normalizeUuid(id),
    username: normalizeMinecraftUsername(name),
  };
}

export const mojangProvider = new MojangProvider();
