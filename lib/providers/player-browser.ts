import type { PlayerAnalysis } from "../models";
import { isJsonObject, normalizeMinecraftPlayerInput, optionalProfileId } from "./guards";
import { ProviderError } from "./errors";
import {
  parsePlayerGatewayPayload,
  playerGatewayFailure,
  type PlayerGatewayBrowserCapability,
} from "./player-gateway";
import { PLAYER_GATEWAY_PATH } from "./player-gateway-auth";
import type { PlayerGatewayProfileReceipt } from "./player-gateway-auth";

const MAX_CAPABILITY_RESPONSE_BYTES = 16_384;
const MAX_PLAYER_RESPONSE_BYTES = 6_000_000;
const PLAYER_REQUEST_TIMEOUT_MS = 30_000;
const CAPABILITY_HEADER_NAMES = new Set([
  "accept",
  "content-type",
  "x-skypilot-actor",
  "x-skypilot-nonce",
  "x-skypilot-signature",
  "x-skypilot-timestamp",
]);

type BrowserPlayerLookupOptions = {
  browserCapability: boolean;
  fetchImplementation?: typeof fetch;
  profileId?: string | null;
};

export type BrowserPlayerAnalysisResult = {
  analysis: PlayerAnalysis;
  saveReceipts: Readonly<Record<string, PlayerGatewayProfileReceipt>>;
};

export async function loadPlayerAnalysisForBrowser(
  playerInput: string,
  options: BrowserPlayerLookupOptions,
): Promise<PlayerAnalysis> {
  return (await loadPlayerAnalysisResultForBrowser(playerInput, options)).analysis;
}

export async function loadPlayerAnalysisResultForBrowser(
  playerInput: string,
  options: BrowserPlayerLookupOptions,
): Promise<BrowserPlayerAnalysisResult> {
  const selector = normalizeMinecraftPlayerInput(playerInput);
  const profileId = optionalProfileId(options.profileId ?? null);
  const player = selector.kind === "uuid" ? selector.uuid : selector.username;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PLAYER_REQUEST_TIMEOUT_MS);

  try {
    if (!options.browserCapability) {
      const parameters = new URLSearchParams({ username: player });
      if (profileId) parameters.set("profile", profileId);
      const response = await invokeFetch(
        `/api/player?${parameters.toString()}`,
        {
          headers: { accept: "application/json" },
          cache: "no-store",
          signal: controller.signal,
        },
        options.fetchImplementation,
      );
      return {
        analysis: parsePlayerResponse(
          response,
          await readBoundedResponse(response, MAX_PLAYER_RESPONSE_BYTES),
        ),
        saveReceipts: {},
      };
    }

    const capabilityResponse = await invokeFetch(
      "/api/player/capability",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ player, ...(profileId ? { profileId } : {}) }),
        cache: "no-store",
        credentials: "same-origin",
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      },
      options.fetchImplementation,
    );
    const capabilityBody = await readBoundedResponse(
      capabilityResponse,
      MAX_CAPABILITY_RESPONSE_BYTES,
    );
    const capabilityPayload = parseJson(capabilityBody);
    if (!capabilityResponse.ok) {
      throw playerGatewayFailure(
        capabilityPayload,
        capabilityResponse.status,
        capabilityResponse.headers,
      );
    }
    const capability = parseCapability(
      capabilityPayload,
      player,
      profileId,
    );

    const gatewayResponse = await invokeFetch(
      capability.url,
      {
        method: capability.method,
        headers: capability.headers,
        body: capability.body,
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      },
      options.fetchImplementation,
    );
    if (gatewayResponse.status === 401) {
      throw new ProviderError({
        code: "forbidden",
        message: "The short-lived player capability expired or was rejected.",
        status: 401,
        action: "Run the player lookup again to request a new capability.",
        retryable: true,
      });
    }
    if (gatewayResponse.status === 403) {
      throw new ProviderError({
        code: "forbidden",
        message: "This SkyPilot origin is not allowed to use the player service.",
        status: 403,
        action: "An administrator must verify the Sites and gateway origin settings.",
      });
    }
    const gatewayBody = await readBoundedResponse(
      gatewayResponse,
      MAX_PLAYER_RESPONSE_BYTES,
    );
    const analysis = parsePlayerResponse(gatewayResponse, gatewayBody);
    const payload = parseJson(gatewayBody);
    return {
      analysis,
      saveReceipts: parseSaveReceipts(payload, analysis),
    };
  } catch (error) {
    if (error instanceof ProviderError) throw error;
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
    throw new ProviderError({
      code: "network_error",
      message: "The SkyPilot player service could not be reached.",
      status: 503,
      action: "Check your connection and try the lookup again.",
      retryable: true,
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function parseSaveReceipts(
  payload: unknown,
  analysis: PlayerAnalysis,
): Readonly<Record<string, PlayerGatewayProfileReceipt>> {
  if (!isJsonObject(payload)) {
    throw invalidCapability();
  }
  if (payload.saveReceipts === undefined) return {};
  if (!Array.isArray(payload.saveReceipts)) throw invalidCapability();
  if (
    payload.saveReceipts.length !== analysis.profiles.length ||
    payload.saveReceipts.length > 24
  ) {
    throw invalidCapability();
  }
  const profileIds = new Set(analysis.profiles.map((profile) => profile.id));
  const receipts: Record<string, PlayerGatewayProfileReceipt> = {};
  for (const value of payload.saveReceipts) {
    const profile = isBrowserProfileReceipt(value)
      ? analysis.profiles.find((candidate) => candidate.id === value.profileId)
      : undefined;
    if (
      !isBrowserProfileReceipt(value) ||
      !profile ||
      !profileIds.has(value.profileId) ||
      receipts[value.profileId] ||
      value.playerUuid !== analysis.player.uuid ||
      value.username.toLowerCase() !== analysis.player.username.toLowerCase() ||
      value.profileName !== profile.name ||
      value.gameMode !== profile.gameMode ||
      value.selected !== (value.profileId === analysis.selectedProfileId) ||
      value.dataState !== (profile.unavailable.length ? "partial" : "complete") ||
      value.fetchedAt !== analysis.fetchedAt
    ) {
      throw invalidCapability();
    }
    receipts[value.profileId] = value;
  }
  return receipts;
}

function isBrowserProfileReceipt(value: unknown): value is PlayerGatewayProfileReceipt {
  if (!isJsonObject(value)) return false;
  const keys = [
    "version",
    "expiresAt",
    "playerUuid",
    "username",
    "profileId",
    "profileName",
    "gameMode",
    "selected",
    "dataState",
    "fetchedAt",
    "signature",
  ];
  return Object.keys(value).length === keys.length &&
    keys.every((key) => key in value) &&
    value.version === "skypilot-profile-receipt-v1" &&
    Number.isSafeInteger(value.expiresAt) &&
    (value.expiresAt as number) >= Math.floor(Date.now() / 1_000) - 5 &&
    (value.expiresAt as number) <= Math.floor(Date.now() / 1_000) + 900 &&
    typeof value.playerUuid === "string" && /^[a-f0-9]{32}$/u.test(value.playerUuid) &&
    typeof value.username === "string" && /^[A-Za-z0-9_]{1,16}$/u.test(value.username) &&
    typeof value.profileId === "string" && /^[a-f0-9]{32}$/u.test(value.profileId) &&
    boundedReceiptText(value.profileName, 64) &&
    boundedReceiptText(value.gameMode, 32) &&
    typeof value.selected === "boolean" &&
    (value.dataState === "complete" || value.dataState === "partial") &&
    typeof value.fetchedAt === "string" && value.fetchedAt.length <= 40 &&
    Number.isFinite(Date.parse(value.fetchedAt)) &&
    typeof value.signature === "string" && /^[A-Za-z0-9_-]{40,96}$/u.test(value.signature);
}

function boundedReceiptText(value: unknown, max: number): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > max) {
    return false;
  }
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 32 || code === 127) return false;
  }
  return true;
}

function parsePlayerResponse(response: Response, body: string): PlayerAnalysis {
  const payload = parseJson(body);
  if (!response.ok) {
    throw playerGatewayFailure(payload, response.status, response.headers);
  }
  return parsePlayerGatewayPayload(payload);
}

function parseCapability(
  payload: unknown,
  expectedPlayer: string,
  expectedProfileId: string | null,
): PlayerGatewayBrowserCapability {
  if (!isJsonObject(payload) || !isJsonObject(payload.data)) {
    throw invalidCapability();
  }
  const value = payload.data;
  if (
    value.method !== "POST" ||
    typeof value.url !== "string" ||
    typeof value.body !== "string" ||
    value.body.length > 4_096 ||
    typeof value.expiresAt !== "string" ||
    !isJsonObject(value.headers)
  ) {
    throw invalidCapability();
  }

  let url: URL;
  try {
    url = new URL(value.url);
  } catch {
    throw invalidCapability();
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== PLAYER_GATEWAY_PATH ||
    url.search ||
    url.hash
  ) {
    throw invalidCapability();
  }

  const expiresAt = Date.parse(value.expiresAt);
  const now = Date.now();
  if (!Number.isFinite(expiresAt) || expiresAt < now - 5_000 || expiresAt > now + 60_000) {
    throw invalidCapability();
  }

  const headerEntries = Object.entries(value.headers);
  if (
    headerEntries.length !== CAPABILITY_HEADER_NAMES.size ||
    headerEntries.some(([name, headerValue]) =>
      !CAPABILITY_HEADER_NAMES.has(name.toLowerCase()) ||
      typeof headerValue !== "string" ||
      headerValue.length === 0 ||
      headerValue.length > 256
    )
  ) {
    throw invalidCapability();
  }
  const headers = new Headers(value.headers as Record<string, string>);
  if (
    headers.get("accept") !== "application/json" ||
    headers.get("content-type") !== "application/json; charset=utf-8" ||
    !boundedToken(headers.get("x-skypilot-actor"), 24, 96) ||
    !boundedToken(headers.get("x-skypilot-nonce"), 16, 64) ||
    !boundedToken(headers.get("x-skypilot-signature"), 40, 96) ||
    !/^\d{10,12}$/u.test(headers.get("x-skypilot-timestamp") ?? "")
  ) {
    throw invalidCapability();
  }

  const signedBody = parseJson(value.body);
  if (!isJsonObject(signedBody)) throw invalidCapability();
  const expectedKeys = expectedProfileId ? ["player", "profileId"] : ["player"];
  if (
    Object.keys(signedBody).length !== expectedKeys.length ||
    !expectedKeys.every((key) => key in signedBody) ||
    signedBody.player !== expectedPlayer ||
    (expectedProfileId ? signedBody.profileId !== expectedProfileId : "profileId" in signedBody)
  ) {
    throw invalidCapability();
  }

  return {
    url: url.toString(),
    method: "POST",
    headers: Object.fromEntries(headers),
    body: value.body,
    expiresAt: value.expiresAt,
  };
}

async function readBoundedResponse(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw invalidResponse();
  if (!response.body) throw invalidResponse();
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let total = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw invalidResponse();
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    if (error instanceof ProviderError || isAbortError(error)) throw error;
    throw invalidResponse(error);
  }
  if (!text) throw invalidResponse();
  return text;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch (error) {
    throw invalidResponse(error);
  }
}

function boundedToken(value: string | null, min: number, max: number): boolean {
  return Boolean(value && value.length >= min && value.length <= max && /^[A-Za-z0-9_-]+$/u.test(value));
}

function invalidCapability(): ProviderError {
  return new ProviderError({
    code: "invalid_response",
    message: "SkyPilot returned an invalid player capability.",
    status: 502,
    action: "Try the lookup again later.",
    retryable: true,
  });
}

function invalidResponse(cause?: unknown): ProviderError {
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

function invokeFetch(
  input: RequestInfo | URL,
  init: RequestInit,
  implementation?: typeof fetch,
): Promise<Response> {
  return implementation
    ? implementation(input, init)
    : globalThis.fetch(input, init);
}
