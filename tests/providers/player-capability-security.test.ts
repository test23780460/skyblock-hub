import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  handlePlayerGatewayRequest,
  type PlayerGatewayEnv,
} from "../../cloudflare/player-gateway/index";
import { ProviderError } from "../../lib/providers/errors";
import {
  createPlayerGatewayBrowserCapability,
  type PlayerGatewayBrowserCapability,
} from "../../lib/providers/player-gateway";
import {
  signPlayerGatewayProfileReceipt,
  verifyPlayerGatewayProfileReceipt,
} from "../../lib/providers/player-gateway-auth";
import { loadPlayerAnalysisForBrowser } from "../../lib/providers/player-browser";
import { verifiedProfileFromReceipt } from "../../lib/saved-state/profile-receipt";

const execFileAsync = promisify(execFile);
const SECRET = "fixture-gateway-secret-that-is-at-least-thirty-two-characters";
const SITE_ORIGIN = "https://skypilot.example";
const NOW = 1_786_248_000_000;

test("profile save receipts verify only while exact and unexpired", async () => {
  const claims = {
    playerUuid: "0123456789abcdef0123456789abcdef",
    username: "PilotFixture",
    profileId: "abcdef0123456789abcdef0123456789",
    profileName: "Pineapple",
    gameMode: "normal",
    selected: true,
    dataState: "complete" as const,
    fetchedAt: new Date(NOW - 5_000).toISOString(),
  };
  const receipt = await signPlayerGatewayProfileReceipt(SECRET, claims, NOW);

  assert.deepEqual(
    await verifyPlayerGatewayProfileReceipt(SECRET, receipt, NOW),
    {
      expiresAt: Math.floor(NOW / 1_000) + 600,
      ...claims,
    },
  );
  assert.equal(
    await verifyPlayerGatewayProfileReceipt(
      SECRET,
      { ...receipt, selected: false },
      NOW,
    ),
    null,
  );
  assert.equal(
    await verifyPlayerGatewayProfileReceipt(
      SECRET,
      {
        ...receipt,
        signature: `${receipt.signature[0] === "A" ? "B" : "A"}${receipt.signature.slice(1)}`,
      },
      NOW,
    ),
    null,
  );
  assert.equal(
    await verifyPlayerGatewayProfileReceipt(SECRET, receipt, NOW + 606_000),
    null,
  );
  assert.equal(
    await verifyPlayerGatewayProfileReceipt(
      SECRET,
      { ...receipt, role: "admin" },
      NOW,
    ),
    null,
  );
});

test("saved profile verification accepts only a matching signed live receipt", async () => {
  const previousSecret = process.env.PLAYER_GATEWAY_SECRET;
  process.env.PLAYER_GATEWAY_SECRET = SECRET;
  const claims = {
    playerUuid: "0123456789abcdef0123456789abcdef",
    username: "PilotFixture",
    profileId: "abcdef0123456789abcdef0123456789",
    profileName: "Pineapple",
    gameMode: "normal",
    selected: true,
    dataState: "complete" as const,
    fetchedAt: new Date(NOW - 5_000).toISOString(),
  };
  try {
    const receipt = await signPlayerGatewayProfileReceipt(SECRET, claims, NOW);
    assert.deepEqual(await verifiedProfileFromReceipt({
      username: claims.username,
      profileId: claims.profileId,
      receipt,
    }, { now: NOW, secret: SECRET }), {
      minecraftUuid: claims.playerUuid,
      username: claims.username,
      profileName: claims.profileName,
      gameMode: claims.gameMode,
      selected: true,
      dataState: "complete",
      fetchedAt: claims.fetchedAt,
    });
    await assert.rejects(
      () => verifiedProfileFromReceipt({
        username: "DifferentPilot",
        profileId: claims.profileId,
        receipt,
      }, { now: NOW, secret: SECRET }),
      (error: unknown) => error instanceof ProviderError && error.code === "invalid_input",
    );
  } finally {
    if (previousSecret === undefined) delete process.env.PLAYER_GATEWAY_SECRET;
    else process.env.PLAYER_GATEWAY_SECRET = previousSecret;
  }
});

test("player capability route is exact-origin, strict-body, private, and secret-free", async () => {
  const fixture = fileURLToPath(new URL(
    "./fixtures/player-capability-route-fixture.mjs",
    import.meta.url,
  ));
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [fixture],
    {
      cwd: process.cwd(),
      timeout: 20_000,
      windowsHide: true,
    },
  );
  assert.equal(stdout, "");
  assert.equal(stderr, "");
});

test("gateway rejects a valid browser capability presented by a hostile actual origin", async () => {
  const capability = await browserCapability();
  const headers = new Headers(capability.headers);
  headers.set("origin", "https://preview.skypilot.example");
  let upstreamCalls = 0;

  const response = await handlePlayerGatewayRequest(new Request(capability.url, {
    method: "POST",
    headers,
    body: capability.body,
  }), gatewayEnv(), {
    fetchImplementation: async () => {
      upstreamCalls += 1;
      throw new Error("hostile-origin traffic must not reach an upstream provider");
    },
  });

  assert.equal(response.status, 403);
  assert.equal(response.headers.has("access-control-allow-origin"), false);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(upstreamCalls, 0);
});

test("browser capability failures never fall back to the legacy player route", async () => {
  const requests: string[] = [];
  await assert.rejects(
    () => loadPlayerAnalysisForBrowser("PilotFixture", {
      browserCapability: true,
      fetchImplementation: async (input) => {
        requests.push(String(input));
        return Response.json({
          error: {
            code: "upstream_unavailable",
            message: "Capability issuance is unavailable.",
          },
        }, { status: 503 });
      },
    }),
    (error: unknown) =>
      error instanceof ProviderError &&
      error.code === "upstream_unavailable" &&
      error.status === 503 &&
      error.retryable,
  );
  assert.deepEqual(requests, ["/api/player/capability"]);
  assert.equal(requests.some((request) => request.startsWith("/api/player?")), false);
});

test("browser transport rejects and cancels an oversized capability response without fallback", async () => {
  const encoder = new TextEncoder();
  let cancelled = false;
  let calls = 0;
  const oversized = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode("x".repeat(9_000)));
    },
    pull(controller) {
      controller.enqueue(encoder.encode("x".repeat(9_000)));
    },
    cancel() {
      cancelled = true;
    },
  });

  await assert.rejects(
    () => loadPlayerAnalysisForBrowser("PilotFixture", {
      browserCapability: true,
      fetchImplementation: async () => {
        calls += 1;
        return new Response(oversized);
      },
    }),
    (error: unknown) =>
      error instanceof ProviderError && error.code === "invalid_response",
  );
  assert.equal(calls, 1);
  assert.equal(cancelled, true);
});

test("browser transport classifies capability and gateway aborts as retryable timeouts", async () => {
  let capabilityCalls = 0;
  await assert.rejects(
    () => loadPlayerAnalysisForBrowser("PilotFixture", {
      browserCapability: true,
      fetchImplementation: async () => {
        capabilityCalls += 1;
        throw new DOMException("aborted", "AbortError");
      },
    }),
    isTimeout,
  );
  assert.equal(capabilityCalls, 1);

  const capability = await browserCapability();
  const gatewayRequests: string[] = [];
  await assert.rejects(
    () => loadPlayerAnalysisForBrowser("PilotFixture", {
      browserCapability: true,
      fetchImplementation: async (input) => {
        gatewayRequests.push(String(input));
        if (String(input) === "/api/player/capability") {
          return Response.json({ data: capability });
        }
        throw new DOMException("aborted", "AbortError");
      },
    }),
    isTimeout,
  );
  assert.deepEqual(gatewayRequests, ["/api/player/capability", capability.url]);
});

test("browser transport enforces no-store and rejects an oversized gateway result", async () => {
  const capability = await browserCapability();
  const requests: Array<{ input: string; init?: RequestInit }> = [];

  await assert.rejects(
    () => loadPlayerAnalysisForBrowser("PilotFixture", {
      browserCapability: true,
      fetchImplementation: async (input, init) => {
        requests.push({ input: String(input), init });
        if (String(input) === "/api/player/capability") {
          return Response.json({ data: capability });
        }
        return new Response("{}", {
          headers: { "content-length": "6000001" },
        });
      },
    }),
    (error: unknown) =>
      error instanceof ProviderError && error.code === "invalid_response",
  );

  assert.equal(requests.length, 2);
  assert.equal(requests[0]?.init?.cache, "no-store");
  assert.equal(requests[0]?.init?.credentials, "same-origin");
  assert.equal(requests[1]?.init?.cache, "no-store");
  assert.equal(requests[1]?.init?.credentials, "omit");
  assert.equal(requests.some(({ input }) => input.startsWith("/api/player?")), false);
});

async function browserCapability(): Promise<PlayerGatewayBrowserCapability> {
  return createPlayerGatewayBrowserCapability(
    "PilotFixture",
    null,
    SITE_ORIGIN,
    {
      actorSubject: "fixture-browser",
      gatewayUrl: "https://gateway.example",
      gatewaySecret: SECRET,
      now: Date.now(),
      nonce: "security_browser_nonce_1234",
    },
  );
}

function isTimeout(error: unknown): boolean {
  return error instanceof ProviderError &&
    error.code === "upstream_timeout" &&
    error.status === 504 &&
    error.retryable;
}

function gatewayEnv(): PlayerGatewayEnv {
  const limiter = { limit: async () => ({ success: true }) } as RateLimit;
  return {
    HYPIXEL_API_KEY: "fixture-hypixel-key",
    PLAYER_GATEWAY_SECRET: SECRET,
    PLAYER_CACHE: memoryKvNamespace(),
    PLAYER_ACTOR_LIMITER: limiter,
    PLAYER_GLOBAL_LIMITER: limiter,
    SKYPILOT_GATEWAY_VERSION: "v1",
    SKYPILOT_SITE_ORIGIN: SITE_ORIGIN,
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
