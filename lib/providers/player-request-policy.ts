import { MemoryTtlCache, type TtlCache } from "../cache/ttl-cache";
import type { PlayerAnalysis } from "../models";
import {
  asProviderError,
  ProviderError,
  providerErrorResponse,
  type ProviderErrorCode,
} from "./errors";
import {
  normalizeMinecraftPlayerInput,
  optionalProfileId,
} from "./guards";
import { getPlayerAnalysis } from "./player-analysis";
import {
  getPlayerAnalysisFromGateway,
  isPlayerGatewayConfigured,
  isPlayerGatewayRequired,
} from "./player-gateway";

const NEGATIVE_TTL_MS = 30_000;

const negativeCache = new MemoryTtlCache(2_000);

type NegativeResult = {
  code: ProviderErrorCode;
  message: string;
  status: number;
  action?: string;
  retryAfterSeconds?: number;
};

export async function playerRequestLimitFailure(request: Request): Promise<Response | null> {
  try {
    const { env } = await import("cloudflare:workers");
    return playerRequestLimitFailureWithEnvironment(request, env);
  } catch (error) {
    return providerErrorResponse(playerGuardUnavailable(error));
  }
}

export async function playerRequestLimitFailureWithEnvironment(
  request: Request,
  environment: { PLAYER_ACTOR_LIMITER: RateLimit },
): Promise<Response | null> {
  try {
    const key = await opaqueRequestActor(playerRequestActorSubject(request));
    const result = await environment.PLAYER_ACTOR_LIMITER.limit({ key });
    return result.success ? null : providerErrorResponse(playerActorLimitError());
  } catch (error) {
    if (error instanceof ProviderError) return providerErrorResponse(error);
    return providerErrorResponse(playerGuardUnavailable(error));
  }
}

export function playerRequestActorSubject(request: Request): string {
  return request.headers.get("cf-connecting-ip")?.trim().slice(0, 80) || "anonymous";
}

async function opaqueRequestActor(subject: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(subject),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

export async function getPlayerAnalysisWithNegativeCache(
  playerInput: string,
  profileId: string | null = null,
  options: {
    actorSubject?: string;
    negativeCache?: TtlCache;
    load?: () => Promise<PlayerAnalysis>;
  } = {},
): Promise<Awaited<ReturnType<typeof getPlayerAnalysis>>> {
  // Reject untrusted selectors before touching KV or any provider transport.
  const selector = normalizeMinecraftPlayerInput(playerInput);
  const normalizedProfileId = optionalProfileId(profileId);
  const normalizedPlayerInput = selector.kind === "uuid"
    ? selector.uuid
    : selector.username;
  const cacheKey = [
    "player-negative",
    normalizedPlayerInput.toLowerCase(),
    normalizedProfileId ?? "selected",
  ].join(":");
  const effectiveNegativeCache = options.negativeCache ?? negativeCache;
  const cached = await effectiveNegativeCache.get<NegativeResult>(cacheKey);
  if (cached) throw fromNegative(cached.value);

  try {
    if (options.load) {
      return await options.load();
    }
    if (isPlayerGatewayConfigured()) {
      return await getPlayerAnalysisFromGateway(
        normalizedPlayerInput,
        normalizedProfileId,
        options,
      );
    }
    if (isPlayerGatewayRequired()) {
      throw new ProviderError({
        code: "missing_credentials",
        message: "Live player analysis is not configured for this deployment.",
        status: 503,
        action: "An administrator must configure SkyPilot's private player service.",
      });
    }
    return await getPlayerAnalysis(normalizedPlayerInput, normalizedProfileId);
  } catch (error) {
    const classified = asProviderError(error);
    if (isNegativeCacheable(classified.code)) {
      await effectiveNegativeCache.set<NegativeResult>(cacheKey, {
        code: classified.code,
        message: classified.message,
        status: classified.status,
        ...(classified.action ? { action: classified.action } : {}),
        ...(classified.retryAfterSeconds !== undefined
          ? { retryAfterSeconds: classified.retryAfterSeconds }
          : {}),
      }, { ttlMs: NEGATIVE_TTL_MS });
    }
    throw classified;
  }
}

function playerActorLimitError(): ProviderError {
  return new ProviderError({
    code: "rate_limited",
    message: "This client has reached the short-term player lookup limit.",
    status: 429,
    action: "Wait a moment before looking up another player.",
    retryable: true,
    retryAfterSeconds: 60,
  });
}

function playerGuardUnavailable(cause: unknown): ProviderError {
  return new ProviderError({
    code: "upstream_unavailable",
    message: "SkyPilot's lookup guard is temporarily unavailable.",
    status: 503,
    action: "Try the lookup again shortly.",
    retryable: true,
    cause,
  });
}

function isNegativeCacheable(code: ProviderErrorCode): boolean {
  return code === "invalid_username" ||
    code === "invalid_uuid" ||
    code === "player_not_found" ||
    code === "profile_not_found" ||
    code === "no_skyblock_profiles";
}

function fromNegative(value: NegativeResult): ProviderError {
  return new ProviderError({
    ...value,
    retryable: false,
  });
}
