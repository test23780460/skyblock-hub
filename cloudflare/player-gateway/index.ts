import { MemoryTtlCache } from "../../lib/cache/ttl-cache";
import { ProviderError, providerErrorPayload } from "../../lib/providers/errors";
import type { FetchImplementation } from "../../lib/providers/http";
import { optionalProfileId } from "../../lib/providers/guards";
import { HypixelProvider } from "../../lib/providers/hypixel";
import { MojangProvider } from "../../lib/providers/mojang";
import { getPlayerAnalysis } from "../../lib/providers/player-analysis";
import {
  PLAYER_GATEWAY_PATH,
  playerGatewayResponseSignatureHeader,
  signPlayerGatewayProfileReceipt,
  signPlayerGatewayResponse,
  verifyPlayerGatewayBrowserRequest,
  verifyPlayerGatewayRequest,
} from "../../lib/providers/player-gateway-auth";
import { KvTtlCache } from "../../lib/platform/cloudflare/kv-ttl-cache";

const MAX_REQUEST_BYTES = 4_096;
const localCacheByNamespace = new WeakMap<KVNamespace, MemoryTtlCache>();
const fallbackProviderCache = new MemoryTtlCache(2_000);

export interface PlayerGatewaySecrets {
  HYPIXEL_API_KEY: string;
  PLAYER_GATEWAY_SECRET: string;
}

export type PlayerGatewayEnv = Pick<
  Env,
  "PLAYER_CACHE" | "PLAYER_ACTOR_LIMITER" | "PLAYER_GLOBAL_LIMITER"
> & PlayerGatewaySecrets & {
  SKYPILOT_GATEWAY_VERSION: string;
  SKYPILOT_SITE_ORIGIN: string;
};

type PlayerGatewayDependencies = {
  fetchImplementation?: FetchImplementation;
  now?: () => number;
};

export default {
  async fetch(request: Request, env: PlayerGatewayEnv): Promise<Response> {
    const startedAt = Date.now();
    let response: Response;
    try {
      response = await handlePlayerGatewayRequest(request, env);
    } catch {
      response = genericFailure();
    }
    console.info(JSON.stringify({
      event: "player_gateway_request",
      status: response.status,
      durationMs: Date.now() - startedAt,
    }));
    return response;
  },
} satisfies ExportedHandler<PlayerGatewayEnv>;

export async function handlePlayerGatewayRequest(
  request: Request,
  env: PlayerGatewayEnv,
  dependencies: PlayerGatewayDependencies = {},
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname !== PLAYER_GATEWAY_PATH || url.search) {
    return new Response(null, { status: 404, headers: noStoreHeaders() });
  }
  const browserOrigin = browserRequestOrigin(request, env);
  if (request.method === "OPTIONS") {
    return browserPreflight(request, browserOrigin);
  }
  if (request.headers.has("origin") && !browserOrigin) {
    return new Response(null, { status: 403, headers: noStoreHeaders() });
  }

  const response = await handlePlayerGatewayCore(
    request,
    env,
    dependencies,
    browserOrigin,
  );
  return browserOrigin ? withBrowserCors(response, browserOrigin) : response;
}

async function handlePlayerGatewayCore(
  request: Request,
  env: PlayerGatewayEnv,
  dependencies: PlayerGatewayDependencies,
  browserOrigin: string | null,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(null, {
      status: 405,
      headers: { ...noStoreHeaders(), Allow: "POST" },
    });
  }
  if (
    !env.HYPIXEL_API_KEY?.trim() ||
    !env.PLAYER_GATEWAY_SECRET?.trim() ||
    env.PLAYER_GATEWAY_SECRET.trim().length < 32
  ) {
    return genericFailure();
  }

  let body: string;
  try {
    body = await readBoundedRequestBody(request);
  } catch {
    return new Response(null, { status: 400, headers: noStoreHeaders() });
  }
  const now = dependencies.now?.() ?? Date.now();
  const auth = browserOrigin
    ? await verifyPlayerGatewayBrowserRequest(
        env.PLAYER_GATEWAY_SECRET,
        request.headers,
        body,
        browserOrigin,
        now,
      )
    : await verifyPlayerGatewayRequest(
        env.PLAYER_GATEWAY_SECRET,
        request.headers,
        body,
        now,
      );
  if (!auth.ok) {
    return new Response(null, { status: 401, headers: noStoreHeaders() });
  }

  try {
    const actorLimit = await env.PLAYER_ACTOR_LIMITER.limit({ key: auth.actor });
    if (!actorLimit.success) {
      return signedError(
        env.PLAYER_GATEWAY_SECRET,
        auth.nonce,
        lookupLimitError(),
      );
    }
    const globalLimit = await env.PLAYER_GLOBAL_LIMITER.limit({
      key: "hypixel-player-credential",
    });
    if (!globalLimit.success) {
      return signedError(
        env.PLAYER_GATEWAY_SECRET,
        auth.nonce,
        lookupLimitError(),
      );
    }
  } catch {
    return signedError(
      env.PLAYER_GATEWAY_SECRET,
      auth.nonce,
      new ProviderError({
        code: "upstream_unavailable",
        message: "SkyPilot's lookup guard is temporarily unavailable.",
        status: 503,
        action: "Try the lookup again shortly.",
        retryable: true,
      }),
    );
  }

  try {
    const input = parsePlayerRequest(body);
    const providerCache = env.PLAYER_CACHE
      ? layeredProviderCache(env.PLAYER_CACHE)
      : fallbackProviderCache;
    const hypixel = new HypixelProvider({
      apiKey: env.HYPIXEL_API_KEY,
      cache: providerCache,
      fetchImplementation: dependencies.fetchImplementation,
    });
    const mojang = new MojangProvider({
      cache: providerCache,
      fetchImplementation: dependencies.fetchImplementation,
    });
    const data = await getPlayerAnalysis(input.player, input.profileId, {
      hypixel,
      mojang,
    });
    const saveReceipts = await Promise.all(data.profiles.map((profile) =>
      signPlayerGatewayProfileReceipt(env.PLAYER_GATEWAY_SECRET, {
        playerUuid: data.player.uuid,
        username: data.player.username,
        profileId: profile.id,
        profileName: profile.name,
        gameMode: profile.gameMode,
        selected: profile.id === data.selectedProfileId,
        dataState: profile.unavailable.length ? "partial" : "complete",
        fetchedAt: data.fetchedAt,
      }, now)
    ));
    return signedJson(
      env.PLAYER_GATEWAY_SECRET,
      auth.nonce,
      { data, saveReceipts },
      200,
    );
  } catch (error) {
    if (!(error instanceof ProviderError) || error.status >= 500) {
      console.error(JSON.stringify({
        event: "player_gateway_provider_failure",
        code: error instanceof ProviderError ? error.code : "unclassified",
        transportCause: transportCauseKind(error),
      }));
    }
    return signedError(env.PLAYER_GATEWAY_SECRET, auth.nonce, error);
  }
}

function browserRequestOrigin(
  request: Request,
  env: PlayerGatewayEnv,
): string | null {
  const requestOrigin = request.headers.get("origin")?.trim();
  const configured = env.SKYPILOT_SITE_ORIGIN?.trim();
  if (!requestOrigin || !configured || requestOrigin !== configured) return null;
  try {
    const url = new URL(configured);
    return url.protocol === "https:" &&
      !url.username && !url.password && url.pathname === "/" &&
      !url.search && !url.hash && configured === url.origin
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

const PREFLIGHT_HEADERS = new Set([
  "accept",
  "content-type",
  "x-skypilot-actor",
  "x-skypilot-nonce",
  "x-skypilot-signature",
  "x-skypilot-timestamp",
]);
const REQUIRED_PREFLIGHT_HEADERS = [
  "content-type",
  "x-skypilot-actor",
  "x-skypilot-nonce",
  "x-skypilot-signature",
  "x-skypilot-timestamp",
] as const;

function browserPreflight(request: Request, origin: string | null): Response {
  if (!origin || request.headers.get("access-control-request-method") !== "POST") {
    return new Response(null, { status: 403, headers: noStoreHeaders() });
  }
  const requested = new Set(
    (request.headers.get("access-control-request-headers") ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  if (
    [...requested].some((name) => !PREFLIGHT_HEADERS.has(name)) ||
    REQUIRED_PREFLIGHT_HEADERS.some((name) => !requested.has(name))
  ) {
    return new Response(null, { status: 403, headers: noStoreHeaders() });
  }
  const headers = new Headers(noStoreHeaders());
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "POST");
  headers.set("Access-Control-Allow-Headers", [...PREFLIGHT_HEADERS].join(", "));
  headers.set("Access-Control-Max-Age", "600");
  headers.set(
    "Vary",
    "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
  );
  return new Response(null, { status: 204, headers });
}

function withBrowserCors(response: Response, origin: string): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Expose-Headers", "Retry-After");
  headers.set("Vary", appendVary(headers.get("Vary"), "Origin"));
  headers.delete("Access-Control-Allow-Credentials");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function appendVary(current: string | null, value: string): string {
  const values = new Set(
    (current ?? "").split(",").map((item) => item.trim()).filter(Boolean),
  );
  values.add(value);
  return [...values].join(", ");
}

function transportCauseKind(error: unknown): string {
  let current = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    const value = current instanceof Error
      ? `${current.name} ${current.message}`.toLowerCase()
      : "";
    if (value.includes("illegal invocation")) return "illegal_invocation";
    if (value.includes("network connection lost")) return "connection_lost";
    if (value.includes("fetch failed")) return "fetch_failed";
    if (value.includes("enotfound") || value.includes("dns")) return "dns";
    if (value.includes("certificate") || value.includes("tls")) return "tls";
    if (value.includes("redirect")) return "redirect_rejected";
    if (value.includes("abort") || value.includes("timeout")) return "aborted";
    current = current instanceof Error ? current.cause : undefined;
  }
  return "unknown";
}

function layeredProviderCache(namespace: KVNamespace): KvTtlCache {
  let local = localCacheByNamespace.get(namespace);
  if (!local) {
    local = new MemoryTtlCache(2_000);
    localCacheByNamespace.set(namespace, local);
  }
  return new KvTtlCache(namespace, local);
}

function parsePlayerRequest(body: string): { player: string; profileId: string | null } {
  let value: unknown;
  try {
    value = JSON.parse(body) as unknown;
  } catch {
    throw invalidInput();
  }
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !("player" in value) ||
    typeof value.player !== "string" ||
    value.player.length > 36 ||
    ("profileId" in value &&
      value.profileId !== undefined &&
      typeof value.profileId !== "string") ||
    Object.keys(value).some((key) => key !== "player" && key !== "profileId")
  ) {
    throw invalidInput();
  }
  return {
    player: value.player,
    profileId: optionalProfileId(
      "profileId" in value && typeof value.profileId === "string"
        ? value.profileId
        : null,
    ),
  };
}

async function readBoundedRequestBody(request: Request): Promise<string> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) throw invalidInput();
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    throw invalidInput();
  }
  if (!request.body) throw invalidInput();
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let total = 0;
  let body = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_REQUEST_BYTES) {
      await reader.cancel();
      throw invalidInput();
    }
    body += decoder.decode(value, { stream: true });
  }
  body += decoder.decode();
  if (!body) throw invalidInput();
  return body;
}

async function signedError(
  secret: string,
  nonce: string,
  error: unknown,
): Promise<Response> {
  const classified = error instanceof ProviderError
    ? error
    : new ProviderError({
      code: "upstream_unavailable",
      message: "A required game-data service is temporarily unavailable.",
      status: 503,
      action: "Try again after a short wait.",
      retryable: true,
      cause: error,
    });
  return signedJson(
    secret,
    nonce,
    providerErrorPayload(classified),
    classified.status,
    classified.retryAfterSeconds === undefined
      ? undefined
      : { "Retry-After": String(classified.retryAfterSeconds) },
  );
}

async function signedJson(
  secret: string,
  nonce: string,
  payload: unknown,
  status: number,
  extraHeaders?: HeadersInit,
): Promise<Response> {
  const body = JSON.stringify(payload);
  const signature = await signPlayerGatewayResponse(secret, status, nonce, body);
  const headers = new Headers(noStoreHeaders());
  headers.set("Content-Type", "application/json; charset=utf-8");
  for (const [key, value] of playerGatewayResponseSignatureHeader(signature)) {
    headers.set(key, value);
  }
  for (const [key, value] of new Headers(extraHeaders)) headers.set(key, value);
  return new Response(body, { status, headers });
}

function noStoreHeaders(): Record<string, string> {
  return {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  };
}

function genericFailure(): Response {
  return Response.json(
    {
      error: {
        code: "upstream_unavailable",
        message: "SkyPilot's private player service is unavailable.",
      },
    },
    { status: 503, headers: noStoreHeaders() },
  );
}

function invalidInput(): ProviderError {
  return new ProviderError({
    code: "invalid_input",
    message: "The player lookup request is invalid.",
    status: 400,
    action: "Enter a valid Minecraft username or Java UUID and try again.",
  });
}

function lookupLimitError(): ProviderError {
  return new ProviderError({
    code: "rate_limited",
    message: "SkyPilot has reached its short-term live lookup limit.",
    status: 429,
    action: "Wait about a minute before trying another player lookup.",
    retryable: true,
    retryAfterSeconds: 60,
  });
}
