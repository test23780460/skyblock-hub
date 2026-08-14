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
  signPlayerGatewayResponse,
  verifyPlayerGatewayRequest,
} from "../../lib/providers/player-gateway-auth";
import { KvTtlCache } from "./kv-cache";

const MAX_REQUEST_BYTES = 4_096;
const localCacheByNamespace = new WeakMap<KVNamespace, MemoryTtlCache>();
const fallbackProviderCache = new MemoryTtlCache(2_000);

export interface PlayerGatewaySecrets {
  HYPIXEL_API_KEY: string;
  PLAYER_GATEWAY_SECRET: string;
}

export type PlayerGatewayEnv = Env & PlayerGatewaySecrets;

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
  const auth = await verifyPlayerGatewayRequest(
    env.PLAYER_GATEWAY_SECRET,
    request.headers,
    body,
    dependencies.now?.() ?? Date.now(),
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
    return signedJson(
      env.PLAYER_GATEWAY_SECRET,
      auth.nonce,
      { data },
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
