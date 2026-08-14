import type {
  ApiFailure,
  GearSnapshot,
  PlayerAnalysis,
  ProfileAccessorySummary,
  ProfileItemContainerSummary,
  ProfileItemData,
  ProfileItemSummary,
  ProfileStat,
  Recommendation,
  SkillSnapshot,
  SkyBlockProfile,
} from "../models";
import { ProviderError, type ProviderErrorCode } from "./errors";
import {
  isJsonObject,
  normalizeMinecraftPlayerInput,
  optionalProfileId,
} from "./guards";
import {
  opaquePlayerGatewayActor,
  PLAYER_GATEWAY_PATH,
  playerGatewayRequestAuth,
  signPlayerGatewayRequest,
  verifyPlayerGatewayResponse,
} from "./player-gateway-auth";

const MAX_GATEWAY_RESPONSE_BYTES = 6_000_000;
// Username resolution can consume one bounded Minecraft attempt followed by
// two parallel Hypixel reads; this remains below the outer 25-second budget.
const GATEWAY_TIMEOUT_MS = 25_000;

type GatewayFetch = typeof fetch;

type PlayerGatewayOptions = {
  actorSubject?: string;
  fetchImplementation?: GatewayFetch;
  gatewayUrl?: string;
  gatewaySecret?: string;
  now?: number;
  nonce?: string;
};

const PROVIDER_CODES = new Set<ProviderErrorCode>([
  "missing_credentials",
  "invalid_username",
  "invalid_uuid",
  "invalid_input",
  "player_not_found",
  "profile_not_found",
  "no_skyblock_profiles",
  "forbidden",
  "rate_limited",
  "upstream_unavailable",
  "upstream_timeout",
  "invalid_response",
  "network_error",
]);

export function isPlayerGatewayConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const secret = env.PLAYER_GATEWAY_SECRET?.trim();
  if (!secret || secret.length < 32) return false;
  try {
    configuredGatewayUrl(env.PLAYER_GATEWAY_URL);
    return true;
  } catch {
    return false;
  }
}

export function isPlayerGatewayRequired(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const value = env.REQUIRE_PLAYER_GATEWAY?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export async function getPlayerAnalysisFromGateway(
  playerInput: string,
  profileIdInput: string | null = null,
  options: PlayerGatewayOptions = {},
): Promise<PlayerAnalysis> {
  const selector = normalizeMinecraftPlayerInput(playerInput);
  const profileId = optionalProfileId(profileIdInput);
  const gatewayUrl = configuredGatewayUrl(
    options.gatewayUrl ?? process.env.PLAYER_GATEWAY_URL,
  );
  const secret = (options.gatewaySecret ?? process.env.PLAYER_GATEWAY_SECRET)?.trim();
  if (!secret || secret.length < 32) {
    throw missingGatewayConfiguration();
  }

  const player = selector.kind === "uuid" ? selector.uuid : selector.username;
  const body = JSON.stringify({ player, ...(profileId ? { profileId } : {}) });
  const actor = await opaquePlayerGatewayActor(
    secret,
    options.actorSubject?.trim() || "anonymous",
  );
  const authHeaders = await signPlayerGatewayRequest(secret, body, actor, {
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.nonce ? { nonce: options.nonce } : {}),
  });
  const requestAuth = playerGatewayRequestAuth(authHeaders);
  if (!requestAuth) throw invalidGatewayResponse();

  const headers = new Headers(authHeaders);
  headers.set("accept", "application/json");
  headers.set("content-type", "application/json; charset=utf-8");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GATEWAY_TIMEOUT_MS);
  let response: Response;
  let responseBody: string;
  try {
    const init: RequestInit = {
      method: "POST",
      headers,
      body,
      redirect: "error",
      signal: controller.signal,
    };
    response = options.fetchImplementation
      ? await options.fetchImplementation(gatewayUrl, init)
      : await globalThis.fetch(gatewayUrl, init);
    responseBody = await readBoundedGatewayBody(response);
  } catch (error) {
    if (controller.signal.aborted || isAbortError(error)) {
      throw new ProviderError({
        code: "upstream_timeout",
        message: "The SkyPilot player service took too long to respond.",
        status: 504,
        action: "Try the lookup again after a short wait.",
        retryable: true,
        cause: error,
      });
    }
    if (error instanceof ProviderError) throw error;
    throw new ProviderError({
      code: "network_error",
      message: "The SkyPilot player service could not be reached.",
      status: 503,
      action: "Try the lookup again after a short wait.",
      retryable: true,
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (
    !(await verifyPlayerGatewayResponse(
      secret,
      response.status,
      requestAuth.nonce,
      responseBody,
      response.headers,
    ))
  ) {
    throw invalidGatewayResponse();
  }

  const payload = parseJson(responseBody);
  if (!response.ok) throw gatewayFailure(payload, response.status, response.headers);
  return parsePlayerAnalysis(payload);
}

function configuredGatewayUrl(value: string | undefined): URL {
  if (!value?.trim()) throw missingGatewayConfiguration();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw missingGatewayConfiguration();
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw missingGatewayConfiguration();
  }
  url.pathname = PLAYER_GATEWAY_PATH;
  return url;
}

async function readBoundedGatewayBody(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_GATEWAY_RESPONSE_BYTES) {
    throw invalidGatewayResponse();
  }
  if (!response.body) throw invalidGatewayResponse();
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let total = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_GATEWAY_RESPONSE_BYTES) {
        await reader.cancel();
        throw invalidGatewayResponse();
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof ProviderError) throw error;
    throw invalidGatewayResponse(error);
  }
  if (!text) throw invalidGatewayResponse();
  return text;
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch (error) {
    throw invalidGatewayResponse(error);
  }
}

function parsePlayerAnalysis(payload: unknown): PlayerAnalysis {
  if (!isJsonObject(payload) || !isGatewayPlayerAnalysis(payload.data)) {
    throw invalidGatewayResponse();
  }
  return payload.data;
}

function isGatewayPlayerAnalysis(analysis: unknown): analysis is PlayerAnalysis {
  if (!isJsonObject(analysis)) return false;
  if (
    analysis.source !== "hypixel" ||
    !boundedDate(analysis.fetchedAt) ||
    !["fresh", "cached", "stale"].includes(String(analysis.cacheStatus)) ||
    !isJsonObject(analysis.player) ||
    typeof analysis.player.username !== "string" ||
    !/^[A-Za-z0-9_]{1,16}$/u.test(analysis.player.username) ||
    typeof analysis.player.uuid !== "string" ||
    !/^[a-f0-9]{32}$/u.test(analysis.player.uuid) ||
    !(analysis.player.avatarUrl === null || boundedString(analysis.player.avatarUrl, 500)) ||
    !Array.isArray(analysis.profiles) ||
    analysis.profiles.length === 0 ||
    analysis.profiles.length > 24 ||
    typeof analysis.selectedProfileId !== "string" ||
    !boundedStringArray(analysis.notices, 24, 500) ||
    !analysis.profiles.every(isGatewayProfile)
  ) {
    return false;
  }
  return analysis.profiles.some((profile) => profile.id === analysis.selectedProfileId);
}

function isGatewayProfile(value: unknown): value is SkyBlockProfile {
  if (!isJsonObject(value)) return false;
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    value.id.length <= 64 &&
    typeof value.name === "string" &&
    value.name.length <= 64 &&
    typeof value.gameMode === "string" &&
    value.gameMode.length <= 64 &&
    typeof value.selected === "boolean" &&
    (value.lastSave === null || typeof value.lastSave === "string") &&
    Array.isArray(value.stats) && value.stats.length <= 96 && value.stats.every(isProfileStat) &&
    Array.isArray(value.skills) && value.skills.length <= 24 && value.skills.every(isSkillSnapshot) &&
    Array.isArray(value.gear) && value.gear.length <= 64 && value.gear.every(isGearSnapshot) &&
    (value.itemData === undefined || isProfileItemData(value.itemData)) &&
    (value.accessories === undefined || (Array.isArray(value.accessories) && value.accessories.length <= 1_024 && value.accessories.every(isAccessorySummary))) &&
    Array.isArray(value.recommendations) && value.recommendations.length <= 128 && value.recommendations.every(isRecommendation) &&
    boundedStringArray(value.strengths, 64, 500) &&
    boundedStringArray(value.weaknesses, 64, 500) &&
    boundedStringArray(value.unavailable, 64, 500)
  );
}

function isProfileStat(value: unknown): value is ProfileStat {
  return isJsonObject(value) && boundedString(value.key, 100) &&
    boundedString(value.label, 160) && nullableFinite(value.value) &&
    (value.unit === undefined || ["coins", "level", "percent", "count", "xp"].includes(String(value.unit))) &&
    (value.note === undefined || boundedString(value.note, 500));
}

function isSkillSnapshot(value: unknown): value is SkillSnapshot {
  return isJsonObject(value) && boundedString(value.key, 100) &&
    boundedString(value.label, 160) && nullableFinite(value.level) &&
    nullableFinite(value.progress) && (value.xp === undefined || nullableFinite(value.xp));
}

function isGearSnapshot(value: unknown): value is GearSnapshot {
  return isJsonObject(value) && boundedString(value.slot, 100) &&
    boundedString(value.name, 300) && boundedString(value.rarity, 80) &&
    ["detected", "strong", "upgrade", "missing", "unavailable"].includes(String(value.status)) &&
    boundedString(value.note, 500);
}

function isRecommendation(value: unknown): value is Recommendation {
  return isJsonObject(value) && boundedString(value.id, 160) &&
    boundedString(value.title, 300) && boundedString(value.reason, 1_000) &&
    boundedString(value.category, 120) &&
    ["critical", "very-high", "high", "medium", "long-term"].includes(String(value.priority)) &&
    nullableFinite(value.estimatedCost) && boundedString(value.estimatedBenefit, 500) &&
    boundedStringArray(value.prerequisites, 24, 300) &&
    ["BEST VALUE", "CHEAP UPGRADE", "HIGH IMPACT", "LONG TERM", "REQUIRES GRIND", "MARKET DEPENDENT"].includes(String(value.badge)) &&
    boundedString(value.href, 300) && value.href.startsWith("/");
}

function isProfileItemData(value: unknown): value is ProfileItemData {
  return isJsonObject(value) && value.version === "skyblock-items-v1" &&
    Array.isArray(value.containers) && value.containers.length <= 5 &&
    value.containers.every(isItemContainer);
}

function isItemContainer(value: unknown): value is ProfileItemContainerSummary {
  return isJsonObject(value) &&
    ["inventory", "armor", "equipment", "accessories", "wardrobe"].includes(String(value.key)) &&
    boundedString(value.label, 100) &&
    ["parsed", "hidden", "malformed", "oversized", "unsupported"].includes(String(value.state)) &&
    boundedInteger(value.itemCount, 0, 100_000) &&
    boundedInteger(value.skippedItemCount, 0, 100_000) &&
    Array.isArray(value.items) && value.items.length <= 1_024 && value.items.every(isItemSummary) &&
    typeof value.truncated === "boolean" && boundedString(value.note, 500);
}

function isItemSummary(value: unknown): value is ProfileItemSummary {
  return isJsonObject(value) && (value.slot === null || boundedInteger(value.slot, 0, 100_000)) &&
    (value.id === null || boundedString(value.id, 160)) && boundedString(value.name, 300) &&
    boundedInteger(value.count, 0, 100_000) &&
    ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC", "DIVINE", "SUPREME", "SPECIAL", "VERY SPECIAL", "UNKNOWN"].includes(String(value.rarity)) &&
    ["helmet", "chestplate", "leggings", "boots", "weapon", "tool", "equipment", "accessory", "item"].includes(String(value.category)) &&
    boundedInteger(value.stars, 0, 100) && typeof value.recombobulated === "boolean";
}

function isAccessorySummary(value: unknown): value is ProfileAccessorySummary {
  return isJsonObject(value) && boundedString(value.id, 160) &&
    boundedString(value.name, 300) && boundedString(value.familyId, 160) &&
    ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC", "DIVINE", "SUPREME", "SPECIAL", "VERY SPECIAL", "UNKNOWN"].includes(String(value.rarity)) &&
    boundedInteger(value.count, 0, 100_000);
}

function nullableFinite(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function boundedInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function boundedDate(value: unknown): value is string {
  return boundedString(value, 64) && Number.isFinite(Date.parse(value));
}

function boundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function boundedStringArray(value: unknown, max: number, maxLength: number): boolean {
  return Array.isArray(value) &&
    value.length <= max &&
    value.every((item) => typeof item === "string" && item.length <= maxLength);
}

function gatewayFailure(payload: unknown, status: number, headers: Headers): ProviderError {
  if (!isJsonObject(payload) || !isJsonObject(payload.error)) {
    throw invalidGatewayResponse();
  }
  const error = payload.error as ApiFailure["error"];
  if (
    typeof error.code !== "string" ||
    !PROVIDER_CODES.has(error.code as ProviderErrorCode) ||
    typeof error.message !== "string" ||
    error.message.length === 0 ||
    error.message.length > 500 ||
    (error.action !== undefined &&
      (typeof error.action !== "string" || error.action.length > 500))
  ) {
    throw invalidGatewayResponse();
  }
  const retryAfter = safeRetryAfter(error.retryAfterSeconds, headers);
  return new ProviderError({
    code: error.code as ProviderErrorCode,
    message: error.message,
    status: safeGatewayStatus(status),
    ...(error.action ? { action: error.action } : {}),
    ...(retryAfter === undefined ? {} : { retryAfterSeconds: retryAfter }),
    retryable: status === 429 || status >= 500,
  });
}

function safeGatewayStatus(value: number): number {
  return [400, 403, 404, 429, 502, 503, 504].includes(value) ? value : 502;
}

function safeRetryAfter(value: unknown, headers: Headers): number | undefined {
  const header = Number(headers.get("retry-after"));
  const candidate = typeof value === "number" ? value : header;
  if (!Number.isFinite(candidate) || candidate < 1 || candidate > 300) return undefined;
  return Math.ceil(candidate);
}

function missingGatewayConfiguration(): ProviderError {
  return new ProviderError({
    code: "missing_credentials",
    message: "Live player analysis is not configured for this deployment.",
    status: 503,
    action: "An administrator must configure SkyPilot's private player service.",
  });
}

function invalidGatewayResponse(cause?: unknown): ProviderError {
  return new ProviderError({
    code: "invalid_response",
    message: "The SkyPilot player service returned an invalid response.",
    status: 502,
    action: "Try the lookup again later.",
    retryable: true,
    cause,
  });
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}
