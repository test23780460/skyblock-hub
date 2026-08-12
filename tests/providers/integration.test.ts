import assert from "node:assert/strict";
import test from "node:test";
import { normalizeApiFailure } from "../../lib/api-failure";
import { sameOriginMutationFailure } from "../../lib/auth/same-origin";
import { MemoryTtlCache } from "../../lib/cache/ttl-cache";
import { readBoundedJson } from "../../lib/http/bounded-json";
import {
  ProviderError,
  providerErrorResponse,
} from "../../lib/providers/errors";
import { HypixelProvider } from "../../lib/providers/hypixel";
import { normalizeMinecraftPlayerInput } from "../../lib/providers/guards";
import { MojangProvider } from "../../lib/providers/mojang";
import { getPlayerAnalysis } from "../../lib/providers/player-analysis";
import { HypixelRateLimitRegistry } from "../../lib/providers/rate-limit";
import { withBrowserSecurityHeaders } from "../../worker/security-headers";

test("authenticated Hypixel requests use the header and shared cache", async () => {
  const calls: { url: string; headers: Headers }[] = [];
  const provider = new HypixelProvider({
    apiKey: "fixture-credential",
    cache: new MemoryTtlCache(),
    fetchImplementation: async (input, init) => {
      calls.push({
        url: String(input),
        headers: new Headers(init?.headers),
      });
      return jsonResponse({
        success: true,
        player: {
          uuid: "00000000000000000000000000000001",
          displayname: "PilotFixture",
        },
      });
    },
  });

  const first = await provider.getPlayer(
    "00000000000000000000000000000001",
  );
  const second = await provider.getPlayer(
    "00000000000000000000000000000001",
  );

  assert.equal(first.data.displayName, "PilotFixture");
  assert.equal(first.cacheStatus, "fresh");
  assert.equal(second.cacheStatus, "cached");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.headers.get("API-Key"), "fixture-credential");
  assert.equal(new URL(calls[0]?.url ?? "https://invalid").searchParams.has("key"), false);
});

test("authenticated Hypixel username lookup is case-insensitively cached and identity-bound", async () => {
  const calls: { url: URL; headers: Headers }[] = [];
  const provider = new HypixelProvider({
    apiKey: "fixture-credential",
    cache: new MemoryTtlCache(),
    fetchImplementation: async (input, init) => {
      calls.push({
        url: new URL(String(input)),
        headers: new Headers(init?.headers),
      });
      return jsonResponse({
        success: true,
        player: {
          uuid: "00000000000000000000000000000001",
          displayname: "PilotFixture",
        },
      });
    },
  });

  const first = await provider.getPlayerByUsername("PilotFixture");
  const second = await provider.getPlayerByUsername("pilotfixture");

  assert.equal(first.data.uuid, "00000000000000000000000000000001");
  assert.equal(second.cacheStatus, "cached");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url.pathname, "/v2/player");
  assert.equal(calls[0]?.url.searchParams.get("name"), "PilotFixture");
  assert.equal(calls[0]?.url.searchParams.has("uuid"), false);
  assert.equal(calls[0]?.url.searchParams.has("key"), false);
  assert.equal(calls[0]?.headers.get("API-Key"), "fixture-credential");
});

test("Hypixel username lookup rejects a different returned display name", async () => {
  const provider = new HypixelProvider({
    apiKey: "fixture-credential",
    cache: new MemoryTtlCache(),
    fetchImplementation: async () => jsonResponse({
      success: true,
      player: {
        uuid: "00000000000000000000000000000001",
        displayname: "DifferentPilot",
      },
    }),
  });

  await assert.rejects(
    () => provider.getPlayerByUsername("PilotFixture"),
    (error: unknown) =>
      error instanceof ProviderError && error.code === "invalid_response",
  );
});

test("public Bazaar normalization never sends a configured API key", async () => {
  let observedHeaders = new Headers();
  const provider = new HypixelProvider({
    apiKey: "fixture-credential",
    cache: new MemoryTtlCache(),
    fetchImplementation: async (_input, init) => {
      observedHeaders = new Headers(init?.headers);
      return jsonResponse({
        success: true,
        lastUpdated: 1_786_248_000_000,
        products: {
          ENCHANTED_CARROT: {
            product_id: "ENCHANTED_CARROT",
            quick_status: {
              buyPrice: 412.5,
              sellPrice: 418.25,
              buyVolume: 125_000,
              sellVolume: 98_000,
              buyMovingWeek: 5_500_000,
              sellMovingWeek: 5_100_000,
              buyOrders: 84,
              sellOrders: 67,
            },
          },
        },
      });
    },
  });

  const result = await provider.getBazaar();
  assert.equal(observedHeaders.has("API-Key"), false);
  assert.equal(result.data.products[0]?.productId, "ENCHANTED_CARROT");
  assert.equal(result.data.products[0]?.spread, 5.75);
  assert.equal("quick_status" in (result.data.products[0] ?? {}), false);
});

test("missing credentials and invalid usernames fail explicitly", async () => {
  const missing = new HypixelProvider({
    apiKey: null,
    cache: new MemoryTtlCache(),
    fetchImplementation: async () => {
      throw new Error("fetch must not run");
    },
  });
  await assert.rejects(
    () => missing.getSkyBlockProfiles("00000000000000000000000000000001"),
    (error: unknown) =>
      error instanceof ProviderError && error.code === "missing_credentials",
  );

  let calls = 0;
  const mojang = new MojangProvider({
    cache: new MemoryTtlCache(),
    fetchImplementation: async () => {
      calls += 1;
      return jsonResponse({});
    },
  });
  await assert.rejects(
    () => mojang.lookupUsername("bad name!"),
    (error: unknown) =>
      error instanceof ProviderError && error.code === "invalid_username",
  );
  assert.equal(calls, 0);
});

test("player selectors distinguish usernames from dashed and undashed UUIDs", () => {
  assert.deepEqual(normalizeMinecraftPlayerInput("PilotFixture"), {
    kind: "username",
    username: "PilotFixture",
  });
  assert.deepEqual(
    normalizeMinecraftPlayerInput("00000000000000000000000000000001"),
    { kind: "uuid", uuid: "00000000000000000000000000000001" },
  );
  assert.deepEqual(
    normalizeMinecraftPlayerInput("00000000-0000-0000-0000-000000000001"),
    { kind: "uuid", uuid: "00000000000000000000000000000001" },
  );
  assert.throws(
    () => normalizeMinecraftPlayerInput("not-a-valid-player-identifier"),
    (error: unknown) =>
      error instanceof ProviderError && error.code === "invalid_input",
  );
});

test("Minecraft identity lookup falls back to the official Mojang endpoint after a transport failure", async () => {
  const calls: string[] = [];
  const mojang = new MojangProvider({
    cache: new MemoryTtlCache(),
    fetchImplementation: async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.startsWith("https://api.minecraftservices.com/")) {
        throw new TypeError("simulated worker transport failure");
      }
      return jsonResponse({
        id: "82f8e698500d46c792ee93cd1ca7ad7a",
        name: "Justiwantdreams",
      });
    },
  });

  const result = await mojang.lookupUsername("Justiwantdreams");

  assert.equal(result.data.uuid, "82f8e698500d46c792ee93cd1ca7ad7a");
  assert.equal(result.data.username, "Justiwantdreams");
  assert.equal(calls.length, 2);
  assert.match(calls[1] || "", /^https:\/\/api\.mojang\.com\/users\/profiles\/minecraft\//);
});

test("Minecraft identity lookup does not bypass authoritative not-found responses", async () => {
  const calls: string[] = [];
  const mojang = new MojangProvider({
    cache: new MemoryTtlCache(),
    fetchImplementation: async (input) => {
      calls.push(String(input));
      return new Response(null, { status: 404 });
    },
  });

  await assert.rejects(
    () => mojang.lookupUsername("MissingPilot"),
    (error: unknown) =>
      error instanceof ProviderError && error.code === "player_not_found",
  );
  assert.equal(calls.length, 1);
});

test("player analysis never bypasses authoritative Mojang 404, 403, or 429 responses", async () => {
  for (const [status, expectedCode] of [
    [404, "player_not_found"],
    [403, "forbidden"],
    [429, "rate_limited"],
  ] as const) {
    let hypixelCalls = 0;
    const mojang = new MojangProvider({
      cache: new MemoryTtlCache(),
      fetchImplementation: async () => new Response(null, { status }),
    });
    const hypixel = new HypixelProvider({
      apiKey: "fixture-credential",
      cache: new MemoryTtlCache(),
      fetchImplementation: async () => {
        hypixelCalls += 1;
        return jsonResponse({ success: true });
      },
    });

    await assert.rejects(
      () => getPlayerAnalysis("PilotFixture", null, { mojang, hypixel }),
      (error: unknown) =>
        error instanceof ProviderError && error.code === expectedCode,
    );
    assert.equal(hypixelCalls, 0, `Mojang ${status} must remain authoritative`);
  }
});

test("direct UUID player analysis skips Minecraft Services and trusts only the matching Hypixel identity", async () => {
  const cache = new MemoryTtlCache();
  let mojangCalls = 0;
  const mojang = new MojangProvider({
    cache,
    fetchImplementation: async () => {
      mojangCalls += 1;
      throw new Error("Minecraft Services must not run for a UUID selector");
    },
  });
  const hypixelCalls: URL[] = [];
  const hypixel = new HypixelProvider({
    apiKey: "fixture-credential",
    cache,
    fetchImplementation: async (input) => {
      const url = new URL(String(input));
      hypixelCalls.push(url);
      if (url.pathname.endsWith("/player")) {
        return jsonResponse({
          success: true,
          player: {
            uuid: "00000000000000000000000000000001",
            displayname: "PilotFixture",
          },
        });
      }
      return jsonResponse({
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

  const analysis = await getPlayerAnalysis(
    ["00000000", "0000", "0000", "0000", "000000000001"].join("-"),
    null,
    { mojang, hypixel },
  );

  assert.equal(mojangCalls, 0);
  assert.equal(analysis.player.uuid, "00000000000000000000000000000001");
  assert.equal(analysis.player.username, "PilotFixture");
  assert.equal(hypixelCalls.length, 2);
  assert.equal(
    hypixelCalls.every((url) =>
      url.searchParams.get("uuid") === "00000000000000000000000000000001"
    ),
    true,
  );
});

test("direct UUID player analysis rejects a mismatched Hypixel identity", async () => {
  const hypixel = new HypixelProvider({
    apiKey: "fixture-credential",
    cache: new MemoryTtlCache(),
    fetchImplementation: async (input) => {
      const url = new URL(String(input));
      return url.pathname.endsWith("/player")
        ? jsonResponse({
          success: true,
          player: {
            uuid: "00000000000000000000000000000009",
            displayname: "WrongFixture",
          },
        })
        : jsonResponse({ success: true, profiles: null });
    },
  });

  await assert.rejects(
    () => getPlayerAnalysis(
      "00000000000000000000000000000001",
      null,
      { hypixel },
    ),
    (error: unknown) =>
      error instanceof ProviderError && error.code === "invalid_response",
  );
});

test("username transport failures resolve through Hypixel name lookup without a duplicate player call", async () => {
  let mojangCalls = 0;
  const hypixelCalls: URL[] = [];
  const mojang = new MojangProvider({
    cache: new MemoryTtlCache(),
    fetchImplementation: async () => {
      mojangCalls += 1;
      throw new TypeError("simulated blocked Minecraft transport");
    },
  });
  const hypixel = new HypixelProvider({
    apiKey: "fixture-credential",
    cache: new MemoryTtlCache(),
    fetchImplementation: async (input) => {
      const url = new URL(String(input));
      hypixelCalls.push(url);
      if (url.pathname.endsWith("/player")) {
        return jsonResponse({
          success: true,
          player: {
            uuid: "00000000000000000000000000000001",
            displayname: "PilotFixture",
          },
        });
      }
      return jsonResponse({
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

  const analysis = await getPlayerAnalysis(
    "PilotFixture",
    null,
    { mojang, hypixel },
  );

  assert.equal(mojangCalls, 2);
  assert.equal(analysis.player.uuid, "00000000000000000000000000000001");
  assert.equal(analysis.player.username, "PilotFixture");
  assert.equal(hypixelCalls.length, 2);
  assert.equal(
    hypixelCalls.filter((url) => url.pathname.endsWith("/player")).length,
    1,
  );
  assert.equal(hypixelCalls[0]?.searchParams.get("name"), "PilotFixture");
  assert.equal(hypixelCalls[0]?.searchParams.has("uuid"), false);
  assert.equal(
    hypixelCalls[1]?.searchParams.get("uuid"),
    "00000000000000000000000000000001",
  );
});

test("Mojang timeouts and upstream outages also use the bounded Hypixel username fallback", async () => {
  for (const failure of ["timeout", "unavailable"] as const) {
    const hypixelCalls: URL[] = [];
    const mojang = new MojangProvider({
      cache: new MemoryTtlCache(),
      timeoutMs: 1,
      fetchImplementation: async (_input, init) => {
        if (failure === "unavailable") {
          return new Response(null, { status: 503 });
        }
        return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) {
            reject(new Error("expected a bounded request signal"));
            return;
          }
          const abort = () => reject(new DOMException("aborted", "AbortError"));
          if (signal.aborted) abort();
          else signal.addEventListener("abort", abort, { once: true });
        });
      },
    });
    const hypixel = new HypixelProvider({
      apiKey: "fixture-credential",
      cache: new MemoryTtlCache(),
      fetchImplementation: async (input) => {
        const url = new URL(String(input));
        hypixelCalls.push(url);
        return url.pathname.endsWith("/player")
          ? jsonResponse({
            success: true,
            player: {
              uuid: "00000000000000000000000000000001",
              displayname: "PilotFixture",
            },
          })
          : jsonResponse({ success: true, profiles: null });
      },
    });

    await assert.rejects(
      () => getPlayerAnalysis("PilotFixture", null, { mojang, hypixel }),
      (error: unknown) =>
        error instanceof ProviderError && error.code === "no_skyblock_profiles",
    );
    assert.equal(hypixelCalls.length, 2);
    assert.equal(hypixelCalls[0]?.searchParams.get("name"), "PilotFixture");
  }
});

test("failed first-party username transports retain the direct UUID recovery action", async () => {
  const mojang = new MojangProvider({
    cache: new MemoryTtlCache(),
    fetchImplementation: async () => {
      throw new TypeError("simulated blocked Minecraft transport");
    },
  });
  const hypixel = new HypixelProvider({
    apiKey: "fixture-credential",
    cache: new MemoryTtlCache(),
    fetchImplementation: async () => {
      throw new TypeError("simulated blocked Hypixel name transport");
    },
  });

  await assert.rejects(
    () => getPlayerAnalysis("PilotFixture", null, { mojang, hypixel }),
    (error: unknown) =>
      error instanceof ProviderError &&
      error.code === "network_error" &&
      /Java UUID/i.test(error.action || ""),
  );
});

test("player analysis is normalized and never exposes upstream member data", async () => {
  const cache = new MemoryTtlCache();
  const mojang = new MojangProvider({
    cache,
    fetchImplementation: async () =>
      jsonResponse({
        id: "00000000000000000000000000000001",
        name: "PilotFixture",
      }),
  });
  const hypixel = new HypixelProvider({
    apiKey: "fixture-credential",
    cache,
    fetchImplementation: async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/player")) {
        return jsonResponse({
          success: true,
          player: {
            uuid: "00000000000000000000000000000001",
            displayname: "PilotFixture",
          },
        });
      }
      return jsonResponse({
        success: true,
        profiles: [
          {
            profile_id: "00000000000000000000000000000002",
            cute_name: "Pineapple",
            selected: true,
            banking: {
              balance: 4_200_000,
              transactions: [{ initiator_name: "MustBeDiscarded" }],
            },
            members: {
              "00000000000000000000000000000001": {
                currencies: { coin_purse: 1_250_000 },
                leveling: { experience: 12_345 },
                accessory_bag_storage: { highest_magical_power: 287 },
                inv_contents: { data: "RAW_NBT_MUST_BE_DISCARDED" },
                unrelated_field: "MUST_BE_DISCARDED",
                player_data: {
                  experience: {
                    SKILL_FARMING: 1_800_000,
                    SKILL_FORAGING: 450_000,
                  },
                },
              },
              "00000000000000000000000000000009": {
                profile: { last_save: 1_786_248_000_000 },
              },
            },
          },
        ],
      });
    },
  });

  const analysis = await getPlayerAnalysis("PilotFixture", null, {
    mojang,
    hypixel,
  });
  assert.equal(analysis.source, "hypixel");
  assert.equal(analysis.selectedProfileId, "00000000000000000000000000000002");
  assert.equal(analysis.profiles[0]?.stats.find((stat) => stat.key === "mp")?.value, 287);
  assert.ok(
    analysis.profiles[0]?.recommendations.some(
      (recommendation) => recommendation.id === "accessory-efficiency",
    ),
  );
  assert.equal("members" in (analysis.profiles[0] ?? {}), false);
  assert.equal(JSON.stringify(analysis).includes("accessory_bag_storage"), false);

  const cachedProfiles = await hypixel.getSkyBlockProfiles(
    "00000000000000000000000000000001",
  );
  const cachedJson = JSON.stringify(cachedProfiles.data);
  assert.equal(cachedJson.includes("RAW_NBT_MUST_BE_DISCARDED"), false);
  assert.equal(cachedJson.includes("MustBeDiscarded"), false);
  assert.equal(cachedJson.includes("unrelated_field"), false);
  assert.equal(cachedJson.includes("00000000000000000000000000000009"), false);
  assert.equal(cachedJson.includes('"data":"present"'), false);
  assert.equal(cachedJson.includes('"version":"skyblock-items-v1"'), true);
  assert.equal(cachedJson.includes('"state":"malformed"'), true);
});

test("rate-limit state blocks until the observed reset", () => {
  let now = 1_000_000;
  const limits = new HypixelRateLimitRegistry(() => now, () => 0);
  limits.observe(
    "authenticated",
    new Headers({
      "RateLimit-Limit": "120",
      "RateLimit-Remaining": "0",
      "RateLimit-Reset": "30",
    }),
    200,
  );
  assert.throws(
    () => limits.assertAvailable("authenticated"),
    (error: unknown) =>
      error instanceof ProviderError &&
      error.code === "rate_limited" &&
      error.retryAfterSeconds === 30,
  );
  now += 30_000;
  assert.doesNotThrow(() => limits.assertAvailable("authenticated"));
});

test("classified failures use the public API error contract", async () => {
  const response = providerErrorResponse(
    new ProviderError({
      code: "missing_credentials",
      message: "Live Hypixel profile analysis is not configured.",
      status: 503,
      action: "Configure a server-side credential.",
    }),
  );
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: {
      code: "missing_credentials",
      message: "Live Hypixel profile analysis is not configured.",
      action: "Configure a server-side credential.",
    },
  });
});

test("malformed client errors cannot crash the dashboard error contract", () => {
  assert.deepEqual(normalizeApiFailure(new TypeError("socket failed")), {
    code: "network_error",
    message: "The profile service did not respond.",
    action: "Check your connection and try again.",
  });
  assert.deepEqual(normalizeApiFailure({ code: "player_not_found", message: "Player not found." }), {
    code: "player_not_found",
    message: "Player not found.",
  });
});

test("browser mutation guard compares the exact request origin", async () => {
  assert.equal(sameOriginMutationFailure(new Request("https://skypilot.example/api/goals", {
    method: "POST",
    headers: { origin: "https://skypilot.example" },
  })), null);

  const mismatched = sameOriginMutationFailure(new Request("https://skypilot.example/api/goals", {
    method: "POST",
    headers: { origin: "https://attacker.example" },
  }));
  assert.equal(mismatched?.status, 403);

  const crossSite = sameOriginMutationFailure(new Request("https://skypilot.example/api/goals", {
    method: "POST",
    headers: { "sec-fetch-site": "cross-site" },
  }));
  assert.equal(crossSite?.status, 403);

  const missingOrigin = sameOriginMutationFailure(new Request("https://skypilot.example/api/goals", {
    method: "POST",
  }));
  assert.equal(missingOrigin?.status, 403);
});

test("bounded JSON reader rejects declared and streamed oversized bodies", async () => {
  const declared = await readBoundedJson(new Request("https://skypilot.example/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": "9999" },
    body: "{}",
  }), 32);
  assert.equal(declared.ok, false);
  if (!declared.ok) assert.equal(declared.response.status, 413);

  const streamed = await readBoundedJson(new Request("https://skypilot.example/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: "x".repeat(100) }),
  }), 32);
  assert.equal(streamed.ok, false);
  if (!streamed.ok) assert.equal(streamed.response.status, 413);
});

test("cache stats prune expired entries that were never read again", async () => {
  let now = 1_000;
  const cache = new MemoryTtlCache(10, () => now);
  await cache.set("expired", { value: true }, { ttlMs: 10 });
  assert.equal(cache.stats().entries, 1);
  now = 1_011;
  const stats = cache.stats();
  assert.equal(stats.entries, 0);
  assert.equal(stats.evictions, 1);
});

test("worker security headers preserve responses and add HTTPS-only HSTS", async () => {
  const secured = withBrowserSecurityHeaders(new Response("image-or-page", {
    status: 202,
    headers: { "content-type": "text/plain", "x-existing": "preserved" },
  }), new URL("https://skypilot.example/_vinext/image"));

  assert.equal(secured.status, 202);
  assert.equal(await secured.text(), "image-or-page");
  assert.equal(secured.headers.get("x-existing"), "preserved");
  assert.equal(secured.headers.get("content-security-policy"), "base-uri 'self'; frame-ancestors 'none'; object-src 'none'");
  assert.equal(secured.headers.get("cross-origin-opener-policy"), "same-origin");
  assert.equal(secured.headers.get("permissions-policy"), "camera=(), geolocation=(), microphone=()");
  assert.equal(secured.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(secured.headers.get("x-content-type-options"), "nosniff");
  assert.equal(secured.headers.get("x-frame-options"), "DENY");
  assert.equal(secured.headers.get("strict-transport-security"), "max-age=31536000");

  const local = withBrowserSecurityHeaders(new Response(null, {
    headers: { "strict-transport-security": "max-age=999" },
  }), new URL("http://localhost:3000/status"));
  assert.equal(local.headers.has("strict-transport-security"), false);
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
