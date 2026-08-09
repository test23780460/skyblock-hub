import { MemoryTtlCache } from "../cache/ttl-cache";
import {
  asProviderError,
  ProviderError,
  providerErrorResponse,
  type ProviderErrorCode,
} from "./errors";
import { getPlayerAnalysis } from "./player-analysis";

const WINDOW_MS = 60_000;
const REQUESTS_PER_WINDOW = 24;
const MAX_WINDOWS = 5_000;
const NEGATIVE_TTL_MS = 30_000;

// These are bounded per-isolate safeguards, not distributed quotas. The player
// feature remains default-off until deployment-level abuse controls are chosen.
const requestWindows = new Map<string, { count: number; resetsAt: number }>();
const negativeCache = new MemoryTtlCache(2_000);
let requestChecks = 0;

type NegativeResult = {
  code: ProviderErrorCode;
  message: string;
  status: number;
  action?: string;
  retryAfterSeconds?: number;
};

export function playerRequestLimitFailure(request: Request): Response | null {
  const now = Date.now();
  requestChecks += 1;
  if (requestChecks % 64 === 0 || requestWindows.size >= MAX_WINDOWS) {
    for (const [key, window] of requestWindows) {
      if (window.resetsAt <= now) requestWindows.delete(key);
    }
  }

  const key = request.headers.get("cf-connecting-ip")?.trim().slice(0, 80) || "anonymous";
  const existing = requestWindows.get(key);
  if (!existing || existing.resetsAt <= now) {
    if (!existing && requestWindows.size >= MAX_WINDOWS) {
      const oldest = requestWindows.keys().next().value as string | undefined;
      if (oldest) requestWindows.delete(oldest);
    }
    requestWindows.set(key, { count: 1, resetsAt: now + WINDOW_MS });
    return null;
  }
  if (existing.count < REQUESTS_PER_WINDOW) {
    existing.count += 1;
    return null;
  }

  return providerErrorResponse(new ProviderError({
    code: "rate_limited",
    message: "This client has reached the short-term player lookup limit.",
    status: 429,
    action: "Wait a moment before looking up another player.",
    retryable: true,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetsAt - now) / 1_000)),
  }));
}

export async function getPlayerAnalysisWithNegativeCache(
  username: string,
  profileId: string | null = null,
): Promise<Awaited<ReturnType<typeof getPlayerAnalysis>>> {
  const cacheKey = [
    "player-negative",
    username.trim().toLowerCase().slice(0, 64),
    profileId?.trim().toLowerCase().slice(0, 64) || "selected",
  ].join(":");
  const cached = await negativeCache.get<NegativeResult>(cacheKey);
  if (cached) throw fromNegative(cached.value);

  try {
    return await getPlayerAnalysis(username, profileId);
  } catch (error) {
    const classified = asProviderError(error);
    if (isNegativeCacheable(classified.code)) {
      await negativeCache.set<NegativeResult>(cacheKey, {
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
