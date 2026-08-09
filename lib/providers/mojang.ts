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

const LOOKUP_BASE_URL =
  "https://api.minecraftservices.com/minecraft/profile/lookup/name/";
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
        const url = new URL(
          `${LOOKUP_BASE_URL}${encodeURIComponent(username)}`,
        );
        const payload = await requestJson({
          provider: "Minecraft Services",
          url,
          fetchImplementation: this.fetchImplementation,
          timeoutMs: this.timeoutMs,
          maxResponseCharacters: 16_384,
          notFoundError: new ProviderError({
            code: "player_not_found",
            message: "No Minecraft Java player was found with that username.",
            status: 404,
            action: "Check the spelling and try again.",
          }),
        });
        return normalizeIdentity(payload);
      },
    );
  }
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

