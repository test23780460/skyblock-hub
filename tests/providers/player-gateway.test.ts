import assert from "node:assert/strict";
import test from "node:test";
import { configuredCapabilityOrigin } from "../../app/api/player/capability/route";
import { handlePlayerGatewayRequest, type PlayerGatewayEnv } from "../../cloudflare/player-gateway/index";
import { KvTtlCache } from "../../cloudflare/player-gateway/kv-cache";
import { MemoryTtlCache } from "../../lib/cache/ttl-cache";
import { demoPlayerAnalysis } from "../../lib/demo";
import { ProviderError } from "../../lib/providers/errors";
import { requestJson } from "../../lib/providers/http";
import {
  opaquePlayerGatewayActor,
  PLAYER_GATEWAY_PATH,
  playerGatewayRequestAuth,
  playerGatewayResponseSignatureHeader,
  signPlayerGatewayBrowserRequest,
  signPlayerGatewayRequest,
  signPlayerGatewayResponse,
  verifyPlayerGatewayBrowserRequest,
  verifyPlayerGatewayRequest,
  verifyPlayerGatewayResponse,
} from "../../lib/providers/player-gateway-auth";
import {
  createPlayerGatewayBrowserCapability,
  getPlayerAnalysisFromGateway,
  isPlayerGatewayConfigured,
  isPlayerGatewayRequired,
} from "../../lib/providers/player-gateway";
import { loadPlayerAnalysisForBrowser } from "../../lib/providers/player-browser";

const SECRET = "fixture-gateway-secret-that-is-at-least-thirty-two-characters";
const NOW = 1_786_248_000_000;

test("player gateway deployment flags are parsed explicitly and independently", () => {
  assert.equal(isPlayerGatewayConfigured({
    PLAYER_GATEWAY_URL: "https://gateway.example",
    PLAYER_GATEWAY_SECRET: SECRET,
  }), true);
  assert.equal(isPlayerGatewayConfigured({
    PLAYER_GATEWAY_URL: "https://gateway.example",
    PLAYER_GATEWAY_SECRET: "   ",
  }), false);
  assert.equal(isPlayerGatewayConfigured({
    PLAYER_GATEWAY_URL: "https://gateway.example",
    PLAYER_GATEWAY_SECRET: "too-short",
  }), false);
  for (const url of [
    "http://gateway.example",
    "not-a-url",
    "https://user:password@gateway.example",
    "https://gateway.example?secret=unsafe",
    "https://gateway.example#unsafe",
  ]) {
    assert.equal(isPlayerGatewayConfigured({
      PLAYER_GATEWAY_URL: url,
      PLAYER_GATEWAY_SECRET: SECRET,
    }), false);
  }
  for (const value of ["1", "true", "TRUE", " yes "]) {
    assert.equal(isPlayerGatewayRequired({ REQUIRE_PLAYER_GATEWAY: value }), true);
  }
  for (const value of [undefined, "", "0", "false", "on"]) {
    assert.equal(isPlayerGatewayRequired({ REQUIRE_PLAYER_GATEWAY: value }), false);
  }
  assert.equal(isPlayerGatewayRequired({
    REQUIRE_PLAYER_GATEWAY: "true",
    HYPIXEL_API_KEY: "fixture-direct-key",
  }), true, "a direct key must not disable the gateway-required deployment policy");
});

test("capability issuer accepts only the configured canonical application origin", () => {
  const previous = process.env.SITE_URL;
  process.env.SITE_URL = "https://skypilot.example";
  try {
    assert.equal(
      configuredCapabilityOrigin(new Request("https://skypilot.example/api/player/capability")),
      "https://skypilot.example",
    );
    assert.throws(
      () => configuredCapabilityOrigin(new Request("https://preview.skypilot.example/api/player/capability")),
      (error: unknown) => error instanceof ProviderError && error.code === "missing_credentials",
    );
    process.env.SITE_URL = "https://skypilot.example/";
    assert.throws(
      () => configuredCapabilityOrigin(new Request("https://skypilot.example/api/player/capability")),
      (error: unknown) => error instanceof ProviderError && error.code === "missing_credentials",
    );
  } finally {
    if (previous === undefined) Reflect.deleteProperty(process.env, "SITE_URL");
    else process.env.SITE_URL = previous;
  }
});

test("KV cold reads preserve the original snapshot freshness metadata", async () => {
  const namespace = memoryKvNamespace();
  await namespace.put("snapshot", JSON.stringify({
    value: { username: "PilotFixture" },
    storedAt: 1_000,
    expiresAt: 5_000,
    staleUntil: 10_000,
  }));
  const localNow = () => 2_000;
  const local = new MemoryTtlCache(10, localNow);
  const cache = new KvTtlCache(namespace, local, localNow);

  const first = await cache.get<{ username: string }>("snapshot");
  const second = await cache.get<{ username: string }>("snapshot");

  assert.equal(first?.storedAt, 1_000);
  assert.equal(first?.state, "fresh");
  assert.equal(second?.storedAt, 1_000);
  assert.equal(await local.get("snapshot"), null);
});

test("player gateway signatures are body-bound, short-lived, and response-bound", async () => {
  const body = JSON.stringify({ player: "PilotFixture" });
  const actor = await opaquePlayerGatewayActor(SECRET, "fixture-client");
  const headers = await signPlayerGatewayRequest(SECRET, body, actor, {
    now: NOW,
    nonce: "fixture_nonce_1234567890",
  });
  assert.deepEqual(
    await verifyPlayerGatewayRequest(SECRET, headers, body, NOW),
    { ok: true, nonce: "fixture_nonce_1234567890", actor },
  );
  assert.deepEqual(
    await verifyPlayerGatewayRequest(SECRET, headers, `${body} `, NOW),
    { ok: false },
  );
  assert.deepEqual(
    await verifyPlayerGatewayRequest(SECRET, headers, body, NOW + 31_000),
    { ok: false },
  );

  const responseBody = JSON.stringify({ data: { source: "hypixel" } });
  const signature = await signPlayerGatewayResponse(
    SECRET,
    200,
    "fixture_nonce_1234567890",
    responseBody,
  );
  assert.equal(
    await verifyPlayerGatewayResponse(
      SECRET,
      200,
      "fixture_nonce_1234567890",
      responseBody,
      playerGatewayResponseSignatureHeader(signature),
    ),
    true,
  );
  assert.equal(
    await verifyPlayerGatewayResponse(
      SECRET,
      429,
      "fixture_nonce_1234567890",
      responseBody,
      playerGatewayResponseSignatureHeader(signature),
    ),
    false,
  );
});

test("browser capabilities are body-bound, origin-bound, and short-lived", async () => {
  const body = JSON.stringify({ player: "PilotFixture" });
  const actor = await opaquePlayerGatewayActor(SECRET, "fixture-browser");
  const headers = await signPlayerGatewayBrowserRequest(
    SECRET,
    body,
    actor,
    "https://skypilot.example",
    { now: NOW, nonce: "browser_nonce_1234567890" },
  );
  assert.deepEqual(
    await verifyPlayerGatewayBrowserRequest(
      SECRET,
      headers,
      body,
      "https://skypilot.example",
      NOW,
    ),
    { ok: true, nonce: "browser_nonce_1234567890", actor },
  );
  assert.deepEqual(
    await verifyPlayerGatewayBrowserRequest(
      SECRET,
      headers,
      body,
      "https://preview.skypilot.example",
      NOW,
    ),
    { ok: false },
  );
  assert.deepEqual(
    await verifyPlayerGatewayBrowserRequest(
      SECRET,
      headers,
      `${body} `,
      "https://skypilot.example",
      NOW,
    ),
    { ok: false },
  );
  assert.deepEqual(
    await verifyPlayerGatewayBrowserRequest(
      SECRET,
      headers,
      body,
      "https://skypilot.example",
      NOW + 31_000,
    ),
    { ok: false },
  );
});

test("browser capability issuer chooses the fixed target, body, actor, and expiry", async () => {
  const capability = await createPlayerGatewayBrowserCapability(
    "PilotFixture",
    null,
    "https://skypilot.example",
    {
      actorSubject: "fixture-browser",
      gatewayUrl: "https://gateway.example",
      gatewaySecret: SECRET,
      now: NOW,
      nonce: "issued_nonce_12345678901",
    },
  );
  assert.equal(capability.url, `https://gateway.example${PLAYER_GATEWAY_PATH}`);
  assert.equal(capability.method, "POST");
  assert.equal(capability.body, JSON.stringify({ player: "PilotFixture" }));
  assert.equal(capability.expiresAt, new Date(NOW + 30_000).toISOString());
  assert.equal(JSON.stringify(capability).includes(SECRET), false);
  assert.deepEqual(
    await verifyPlayerGatewayBrowserRequest(
      SECRET,
      new Headers(capability.headers),
      capability.body,
      "https://skypilot.example",
      NOW,
    ),
    {
      ok: true,
      nonce: "issued_nonce_12345678901",
      actor: await opaquePlayerGatewayActor(SECRET, "fixture-browser"),
    },
  );
});

test("player gateway client accepts only a signed bounded analysis response", async () => {
  const liveAnalysis = {
    ...demoPlayerAnalysis,
    source: "hypixel" as const,
    cacheStatus: "fresh" as const,
    player: {
      ...demoPlayerAnalysis.player,
      uuid: "0123456789abcdef0123456789abcdef",
    },
  };
  const result = await getPlayerAnalysisFromGateway("PilotFixture", null, {
    actorSubject: "fixture-client",
    gatewayUrl: "https://gateway.example",
    gatewaySecret: SECRET,
    now: NOW,
    nonce: "client_nonce_12345678901",
    fetchImplementation: async (input, init) => {
      assert.equal(String(input), `https://gateway.example${PLAYER_GATEWAY_PATH}`);
      assert.equal(init?.method, "POST");
      assert.equal(new Headers(init?.headers).has("cookie"), false);
      const requestBody = String(init?.body);
      const requestHeaders = new Headers(init?.headers);
      const auth = await verifyPlayerGatewayRequest(SECRET, requestHeaders, requestBody, NOW);
      assert.equal(auth.ok, true);
      if (!auth.ok) throw new Error("expected valid request authentication");
      const responseBody = JSON.stringify({ data: liveAnalysis });
      const signature = await signPlayerGatewayResponse(
        SECRET,
        200,
        auth.nonce,
        responseBody,
      );
      return new Response(responseBody, {
        status: 200,
        headers: {
          "content-type": "application/json",
          ...Object.fromEntries(playerGatewayResponseSignatureHeader(signature)),
        },
      });
    },
  });
  assert.equal(result.source, "hypixel");
  assert.equal(result.player.username, demoPlayerAnalysis.player.username);
  assert.equal(result.profiles.length, demoPlayerAnalysis.profiles.length);
});

test("default player gateway transport invokes globalThis.fetch as a qualified method", async () => {
  const originalFetch = globalThis.fetch;
  const liveAnalysis = {
    ...demoPlayerAnalysis,
    source: "hypixel" as const,
    cacheStatus: "fresh" as const,
    player: {
      ...demoPlayerAnalysis.player,
      uuid: "0123456789abcdef0123456789abcdef",
    },
  };
  let receiverWasGlobal = false;
  globalThis.fetch = async function receiverSensitiveGatewayFetch(
    this: typeof globalThis,
    _input: RequestInfo | URL,
    init?: RequestInit,
  ) {
    receiverWasGlobal = this === globalThis;
    if (!receiverWasGlobal) throw new TypeError("Illegal invocation");
    const auth = playerGatewayRequestAuth(new Headers(init?.headers));
    assert.ok(auth);
    const responseBody = JSON.stringify({ data: liveAnalysis });
    const signature = await signPlayerGatewayResponse(
      SECRET,
      200,
      auth.nonce,
      responseBody,
    );
    return new Response(responseBody, {
      status: 200,
      headers: {
        "content-type": "application/json",
        ...Object.fromEntries(playerGatewayResponseSignatureHeader(signature)),
      },
    });
  } as typeof fetch;

  try {
    const result = await getPlayerAnalysisFromGateway("PilotFixture", null, {
      gatewayUrl: "https://gateway.example",
      gatewaySecret: SECRET,
    });
    assert.equal(receiverWasGlobal, true);
    assert.equal(result.source, "hypixel");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("browser player transport preserves the signed body and omits credentials", async () => {
  const issuedAt = Date.now();
  const capability = await createPlayerGatewayBrowserCapability(
    "PilotFixture",
    null,
    "https://skypilot.example",
    {
      actorSubject: "fixture-browser",
      gatewayUrl: "https://gateway.example",
      gatewaySecret: SECRET,
      now: issuedAt,
      nonce: "client_browser_nonce_12345",
    },
  );
  const liveAnalysis = {
    ...demoPlayerAnalysis,
    source: "hypixel" as const,
    cacheStatus: "fresh" as const,
    player: {
      ...demoPlayerAnalysis.player,
      username: "PilotFixture",
      uuid: "0123456789abcdef0123456789abcdef",
    },
  };
  const requests: Array<{ input: string; init?: RequestInit }> = [];
  const result = await loadPlayerAnalysisForBrowser("PilotFixture", {
    browserCapability: true,
    fetchImplementation: async (input, init) => {
      requests.push({ input: String(input), init });
      if (String(input) === "/api/player/capability") {
        return Response.json({ data: capability }, {
          headers: { "cache-control": "private, no-store" },
        });
      }
      assert.equal(String(input), capability.url);
      assert.equal(init?.credentials, "omit");
      assert.equal(init?.redirect, "error");
      assert.equal(init?.referrerPolicy, "no-referrer");
      assert.equal(init?.body, capability.body);
      assert.deepEqual(
        Object.fromEntries(new Headers(init?.headers)),
        capability.headers,
      );
      return Response.json({ data: liveAnalysis });
    },
  });
  assert.equal(requests.length, 2);
  assert.equal(result.player.username, "PilotFixture");
});

test("player gateway client rejects an unsigned response", async () => {
  await assert.rejects(
    () => getPlayerAnalysisFromGateway("PilotFixture", null, {
      gatewayUrl: "https://gateway.example",
      gatewaySecret: SECRET,
      fetchImplementation: async () => Response.json({ data: demoPlayerAnalysis }),
    }),
    (error: unknown) => error instanceof ProviderError && error.code === "invalid_response",
  );
});

test("bounded provider JSON reads cancel an oversized chunked response", async () => {
  const encoder = new TextEncoder();
  let pullCount = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pullCount += 1;
      if (pullCount === 1) {
        controller.enqueue(encoder.encode('{"ok":'));
        return;
      }
      if (pullCount === 2) {
        controller.enqueue(encoder.encode('"response-is-too-large"}'));
        return;
      }
      controller.close();
    },
    cancel() {
      cancelled = true;
    },
  }, { highWaterMark: 0 });

  await assert.rejects(
    () => requestJson({
      provider: "Fixture upstream",
      url: new URL("https://upstream.example/data"),
      maxResponseCharacters: 12,
      fetchImplementation: async () => new Response(body, {
        headers: { "content-type": "application/json" },
      }),
    }),
    (error: unknown) =>
      error instanceof ProviderError && error.code === "invalid_response",
  );
  assert.equal(cancelled, true);
});

test("player gateway client classifies an aborted fetch as a retryable timeout", async () => {
  await assert.rejects(
    () => getPlayerAnalysisFromGateway("PilotFixture", null, {
      gatewayUrl: "https://gateway.example",
      gatewaySecret: SECRET,
      fetchImplementation: async () => {
        throw new DOMException("aborted", "AbortError");
      },
    }),
    (error: unknown) =>
      error instanceof ProviderError &&
      error.code === "upstream_timeout" &&
      error.status === 504 &&
      error.retryable,
  );
});

test("player gateway client classifies an aborted response stream as a retryable timeout", async () => {
  await assert.rejects(
    () => getPlayerAnalysisFromGateway("PilotFixture", null, {
      gatewayUrl: "https://gateway.example",
      gatewaySecret: SECRET,
      fetchImplementation: async () => new Response(
        new ReadableStream<Uint8Array>({
          pull(controller) {
            controller.error(new DOMException("aborted", "AbortError"));
          },
        }),
        { status: 200 },
      ),
    }),
    (error: unknown) =>
      error instanceof ProviderError &&
      error.code === "upstream_timeout" &&
      error.status === 504 &&
      error.retryable,
  );
});

test("player gateway client preserves a signed retryable provider failure", async () => {
  await assert.rejects(
    () => getPlayerAnalysisFromGateway("PilotFixture", null, {
      gatewayUrl: "https://gateway.example",
      gatewaySecret: SECRET,
      nonce: "failure_nonce_1234567890",
      fetchImplementation: async (_input, init) => {
        const auth = playerGatewayRequestAuth(new Headers(init?.headers));
        assert.ok(auth);
        const responseBody = JSON.stringify({
          error: {
            code: "rate_limited",
            message: "The live lookup budget is temporarily exhausted.",
            action: "Wait before trying another lookup.",
            retryAfterSeconds: 47,
          },
        });
        const signature = await signPlayerGatewayResponse(
          SECRET,
          429,
          auth.nonce,
          responseBody,
        );
        return new Response(responseBody, {
          status: 429,
          headers: {
            "content-type": "application/json",
            "retry-after": "60",
            ...Object.fromEntries(playerGatewayResponseSignatureHeader(signature)),
          },
        });
      },
    }),
    (error: unknown) =>
      error instanceof ProviderError &&
      error.code === "rate_limited" &&
      error.status === 429 &&
      error.retryable &&
      error.retryAfterSeconds === 47,
  );
});

test("private gateway rejects unsigned traffic and returns signed normalized analysis", async () => {
  let upstreamCalls = 0;
  const env = gatewayEnv();
  const unsigned = await handlePlayerGatewayRequest(
    new Request(`https://gateway.example${PLAYER_GATEWAY_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ player: "00000000000000000000000000000001" }),
    }),
    env,
    { fetchImplementation: async () => {
      upstreamCalls += 1;
      throw new Error("unsigned requests must not reach providers");
    } },
  );
  assert.equal(unsigned.status, 401);
  assert.equal(unsigned.headers.has("access-control-allow-origin"), false);
  assert.equal(upstreamCalls, 0);

  const body = JSON.stringify({ player: "00000000000000000000000000000001" });
  const actor = await opaquePlayerGatewayActor(SECRET, "fixture-client");
  const authHeaders = await signPlayerGatewayRequest(SECRET, body, actor, {
    nonce: "worker_nonce_12345678901",
  });
  authHeaders.set("content-type", "application/json");
  const requestAuth = playerGatewayRequestAuth(authHeaders);
  assert.ok(requestAuth);
  const response = await handlePlayerGatewayRequest(
    new Request(`https://gateway.example${PLAYER_GATEWAY_PATH}`, {
      method: "POST",
      headers: authHeaders,
      body,
    }),
    env,
    {
      fetchImplementation: async (input, init) => {
        upstreamCalls += 1;
        assert.equal(new Headers(init?.headers).get("API-Key"), "fixture-hypixel-key");
        const path = new URL(String(input)).pathname;
        if (path.endsWith("/player")) {
          return Response.json({
            success: true,
            player: {
              uuid: "00000000000000000000000000000001",
              displayname: "PilotFixture",
            },
          });
        }
        return Response.json({
          success: true,
          profiles: [{
            profile_id: "00000000000000000000000000000002",
            cute_name: "Pineapple",
            selected: true,
            members: {
              "00000000000000000000000000000001": {
                currencies: { coin_purse: 1_250_000 },
              },
            },
          }],
        });
      },
    },
  );
  const responseBody = await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.has("access-control-allow-origin"), false);
  assert.equal(
    await verifyPlayerGatewayResponse(
      SECRET,
      200,
      requestAuth.nonce,
      responseBody,
      response.headers,
    ),
    true,
  );
  const payload = JSON.parse(responseBody) as { data: { source: string; player: { username: string } } };
  assert.equal(payload.data.source, "hypixel");
  assert.equal(payload.data.player.username, "PilotFixture");
  assert.equal(upstreamCalls, 2);
  assert.equal(responseBody.includes("fixture-hypixel-key"), false);
});

test("browser gateway CORS accepts only the configured origin and fixed headers", async () => {
  const env = gatewayEnv();
  const requestedHeaders = [
    "content-type",
    "x-skypilot-actor",
    "x-skypilot-nonce",
    "x-skypilot-signature",
    "x-skypilot-timestamp",
  ].join(", ");
  const preflight = await handlePlayerGatewayRequest(new Request(
    `https://gateway.example${PLAYER_GATEWAY_PATH}`,
    {
      method: "OPTIONS",
      headers: {
        origin: "https://skypilot.example",
        "access-control-request-method": "POST",
        "access-control-request-headers": requestedHeaders,
      },
    },
  ), env);
  assert.equal(preflight.status, 204);
  assert.equal(
    preflight.headers.get("access-control-allow-origin"),
    "https://skypilot.example",
  );
  assert.equal(preflight.headers.has("access-control-allow-credentials"), false);
  assert.match(preflight.headers.get("vary") ?? "", /Origin/u);

  const hostilePreflight = await handlePlayerGatewayRequest(new Request(
    `https://gateway.example${PLAYER_GATEWAY_PATH}`,
    {
      method: "OPTIONS",
      headers: {
        origin: "https://preview.skypilot.example",
        "access-control-request-method": "POST",
        "access-control-request-headers": requestedHeaders,
      },
    },
  ), env);
  assert.equal(hostilePreflight.status, 403);
  assert.equal(hostilePreflight.headers.has("access-control-allow-origin"), false);

  const unknownHeaderPreflight = await handlePlayerGatewayRequest(new Request(
    `https://gateway.example${PLAYER_GATEWAY_PATH}`,
    {
      method: "OPTIONS",
      headers: {
        origin: "https://skypilot.example",
        "access-control-request-method": "POST",
        "access-control-request-headers": `${requestedHeaders}, authorization`,
      },
    },
  ), env);
  assert.equal(unknownHeaderPreflight.status, 403);

  const capability = await createPlayerGatewayBrowserCapability(
    "00000000000000000000000000000001",
    null,
    "https://skypilot.example",
    {
      actorSubject: "fixture-browser",
      gatewayUrl: "https://gateway.example",
      gatewaySecret: SECRET,
    },
  );
  const headers = new Headers(capability.headers);
  headers.set("origin", "https://skypilot.example");
  const response = await handlePlayerGatewayRequest(new Request(capability.url, {
    method: "POST",
    headers,
    body: capability.body,
  }), env, {
    fetchImplementation: async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/player")) {
        return Response.json({
          success: true,
          player: {
            uuid: "00000000000000000000000000000001",
            displayname: "PilotFixture",
          },
        });
      }
      return Response.json({
        success: true,
        profiles: [{
          profile_id: "00000000000000000000000000000002",
          cute_name: "Pineapple",
          selected: true,
          members: {
            "00000000000000000000000000000001": {
              currencies: { coin_purse: 1_250_000 },
            },
          },
        }],
      });
    },
  });
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("access-control-allow-origin"),
    "https://skypilot.example",
  );
  assert.equal(response.headers.has("access-control-allow-credentials"), false);

  const unsignedHeaders = new Headers({
    origin: "https://skypilot.example",
    "content-type": "application/json",
  });
  const visibleError = await handlePlayerGatewayRequest(new Request(
    `https://gateway.example${PLAYER_GATEWAY_PATH}`,
    { method: "POST", headers: unsignedHeaders, body: capability.body },
  ), env);
  assert.equal(visibleError.status, 401);
  assert.equal(
    visibleError.headers.get("access-control-allow-origin"),
    "https://skypilot.example",
  );
});

test("actor throttling cannot consume the shared credential budget", async () => {
  let globalChecks = 0;
  const body = JSON.stringify({ player: "PilotFixture" });
  const actor = await opaquePlayerGatewayActor(SECRET, "blocked-client");
  const headers = await signPlayerGatewayRequest(SECRET, body, actor);
  headers.set("content-type", "application/json");
  const env: PlayerGatewayEnv = {
    ...gatewayEnv(),
    PLAYER_ACTOR_LIMITER: {
      limit: async () => ({ success: false }),
    } as RateLimit,
    PLAYER_GLOBAL_LIMITER: {
      limit: async () => {
        globalChecks += 1;
        return { success: true };
      },
    } as RateLimit,
  };
  const response = await handlePlayerGatewayRequest(
    new Request(`https://gateway.example${PLAYER_GATEWAY_PATH}`, {
      method: "POST",
      headers,
      body,
    }),
    env,
  );
  assert.equal(response.status, 429);
  assert.equal(globalChecks, 0);
});

function gatewayEnv(): PlayerGatewayEnv {
  const limiter = { limit: async () => ({ success: true }) } as RateLimit;
  return {
    HYPIXEL_API_KEY: "fixture-hypixel-key",
    PLAYER_GATEWAY_SECRET: SECRET,
    PLAYER_CACHE: memoryKvNamespace(),
    PLAYER_ACTOR_LIMITER: limiter,
    PLAYER_GLOBAL_LIMITER: limiter,
    SKYPILOT_GATEWAY_VERSION: "v1",
    SKYPILOT_SITE_ORIGIN: "https://skypilot.example",
  };
}

function memoryKvNamespace(): KVNamespace {
  const values = new Map<string, string>();
  return {
    async get(key: string, type?: string) {
      const value = values.get(key) ?? null;
      if (value === null || type !== "json") return value;
      return JSON.parse(value) as unknown;
    },
    async put(key: string, value: string) {
      values.set(key, value);
    },
    async delete(key: string) {
      values.delete(key);
    },
  } as KVNamespace;
}

test("default provider transport qualifies fetch and blocks automatic redirects", async () => {
  const originalFetch = globalThis.fetch;
  let receiverWasGlobal = false;
  let redirectMode: RequestRedirect | undefined;
  globalThis.fetch = function receiverSensitiveFetch(
    this: typeof globalThis,
    _input: RequestInfo | URL,
    init?: RequestInit,
  ) {
    receiverWasGlobal = this === globalThis;
    if (!receiverWasGlobal) throw new TypeError("Illegal invocation");
    redirectMode = init?.redirect;
    return Promise.resolve(Response.json({ ok: true }));
  } as typeof fetch;

  try {
    const payload = await requestJson({
      provider: "receiver fixture",
      url: new URL("https://example.com/provider-fixture"),
      maxResponseCharacters: 1_024,
    });
    assert.deepEqual(payload, { ok: true });
    assert.equal(receiverWasGlobal, true);
    assert.equal(redirectMode, "manual");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
