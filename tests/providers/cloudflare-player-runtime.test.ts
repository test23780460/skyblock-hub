import assert from "node:assert/strict";
import test from "node:test";
import { reserveD1ProviderBudget } from "../../lib/platform/cloudflare/d1-provider-budget";
import { ProviderError } from "../../lib/providers/errors";
import { playerRequestLimitFailureWithEnvironment } from "../../lib/providers/player-request-policy";
import { getCloudflarePlayerAnalysisWithEnvironment } from "../../worker/player-runtime";
import { createTestDatabase } from "./d1-fixture";

test("Cloudflare authenticated transport checks the coarse guard before durable budget", async () => {
  let globalCalls = 0;
  let budgetCalls = 0;
  let fetchCalls = 0;
  const environment = runtimeEnvironment(async () => {
    globalCalls += 1;
    return { success: false };
  });

  await assert.rejects(
    getCloudflarePlayerAnalysisWithEnvironment(
      environment,
      "82f8e698500d46c792ee93cd1ca7ad7a",
      null,
      {
        fetchImplementation: async () => {
          fetchCalls += 1;
          throw new Error("transport must not run");
        },
        reserveProviderBudget: async () => {
          budgetCalls += 1;
          return true;
        },
      },
    ),
    (error: unknown) =>
      error instanceof ProviderError && error.code === "rate_limited",
  );
  assert.equal(globalCalls, 1);
  assert.equal(budgetCalls, 0);
  assert.equal(fetchCalls, 0);
});

test("invalid player selectors touch neither KV nor provider admission", async () => {
  let globalCalls = 0;
  let budgetCalls = 0;
  let fetchCalls = 0;
  const cacheMetrics = { gets: 0, puts: 0 };
  const environment = runtimeEnvironment(async () => {
    globalCalls += 1;
    return { success: true };
  }, cacheMetrics);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await assert.rejects(
      getCloudflarePlayerAnalysisWithEnvironment(environment, "bad-name", null, {
        fetchImplementation: async () => {
          fetchCalls += 1;
          throw new Error("transport must not run");
        },
        reserveProviderBudget: async () => {
          budgetCalls += 1;
          return true;
        },
      }),
      (error: unknown) =>
        error instanceof ProviderError && error.code === "invalid_username",
    );
  }
  assert.deepEqual(cacheMetrics, { gets: 0, puts: 0 });
  assert.equal(globalCalls, 0);
  assert.equal(budgetCalls, 0);
  assert.equal(fetchCalls, 0);
});

test("a nonexistent username uses Mojang without reserving Hypixel credentials", async () => {
  let globalCalls = 0;
  let budgetCalls = 0;
  const providerHosts: string[] = [];
  const environment = runtimeEnvironment(async () => {
    globalCalls += 1;
    return { success: true };
  });

  await assert.rejects(
    getCloudflarePlayerAnalysisWithEnvironment(environment, "NobodyHere", null, {
      fetchImplementation: async (input) => {
        const url = new URL(String(input));
        providerHosts.push(url.hostname);
        return new Response(null, { status: 404 });
      },
      reserveProviderBudget: async () => {
        budgetCalls += 1;
        return true;
      },
    }),
    (error: unknown) =>
      error instanceof ProviderError && error.code === "player_not_found",
  );

  assert.deepEqual(providerHosts, ["api.minecraftservices.com"]);
  assert.equal(globalCalls, 0);
  assert.equal(budgetCalls, 0);
});

test("Cloudflare player cache hits skip another provider admission check", async () => {
  let globalCalls = 0;
  let fetchCalls = 0;
  let budgetCalls = 0;
  const environment = runtimeEnvironment(async () => {
    globalCalls += 1;
    return { success: true };
  });
  const uuid = "82f8e698500d46c792ee93cd1ca7ad7a";
  const fetchImplementation = async (input: RequestInfo | URL) => {
    fetchCalls += 1;
    const url = new URL(String(input));
    if (url.pathname.endsWith("/player")) {
      return Response.json({
        success: true,
        player: { uuid, displayname: "Justiwantdreams" },
      });
    }
    if (url.pathname.endsWith("/skyblock/profiles")) {
      return Response.json({
        success: true,
        profiles: [{
          profile_id: "11111111111111111111111111111111",
          cute_name: "Kiwi",
          selected: true,
          members: { [uuid]: { profile: { last_save: 1 } } },
        }],
      });
    }
    throw new Error(`Unexpected fixture URL: ${url.pathname}`);
  };
  const dependencies = {
    fetchImplementation,
    reserveProviderBudget: async () => {
      budgetCalls += 1;
      return true;
    },
  };

  const first = await getCloudflarePlayerAnalysisWithEnvironment(
    environment,
    uuid,
    null,
    dependencies,
  );
  const second = await getCloudflarePlayerAnalysisWithEnvironment(
    environment,
    uuid,
    null,
    dependencies,
  );

  assert.equal(first.player.username, "Justiwantdreams");
  assert.equal(second.cacheStatus, "cached");
  assert.equal(fetchCalls, 2);
  assert.equal(globalCalls, 1);
  assert.equal(budgetCalls, 1);
});

test("request-level actor limiter receives only an opaque actor key", async () => {
  let observedKey = "";
  const allowed = await playerRequestLimitFailureWithEnvironment(
    new Request("https://skypilot.example/api/player?username=test", {
      headers: { "cf-connecting-ip": "203.0.113.7" },
    }),
    {
      PLAYER_ACTOR_LIMITER: {
        async limit({ key }) {
          observedKey = key;
          return { success: true };
        },
      } as RateLimit,
    },
  );
  assert.equal(allowed, null);
  assert.match(observedKey, /^[0-9a-f]{64}$/u);
  assert.notEqual(observedKey, "203.0.113.7");

  const blocked = await playerRequestLimitFailureWithEnvironment(
    new Request("https://skypilot.example/api/player"),
    {
      PLAYER_ACTOR_LIMITER: {
        async limit() {
          return { success: false };
        },
      } as RateLimit,
    },
  );
  assert.equal(blocked?.status, 429);
  assert.equal(blocked?.headers.get("Retry-After"), "60");
});

test("request-level actor limiter fails closed when its binding errors", async () => {
  const response = await playerRequestLimitFailureWithEnvironment(
    new Request("https://skypilot.example/api/player"),
    {
      PLAYER_ACTOR_LIMITER: {
        async limit() {
          throw new Error("binding unavailable");
        },
      } as RateLimit,
    },
  );
  assert.equal(response?.status, 503);
});

test("D1 provider budget atomically caps the shared Hypixel key across callers", async () => {
  const fixture = createTestDatabase();
  const binding = fixture.binding as unknown as D1Database;
  const now = 3_000_000;
  const reservations = await Promise.all(
    Array.from({ length: 11 }, () => reserveD1ProviderBudget(binding, {
      scope: "hypixel:authenticated",
      tokens: 2,
      limit: 20,
      now,
    })),
  );
  assert.equal(reservations.filter(Boolean).length, 10);
  assert.equal(reservations.filter((value) => !value).length, 1);
  assert.equal(await reserveD1ProviderBudget(binding, {
    scope: "hypixel:authenticated",
    tokens: 2,
    limit: 20,
    now: now + 60_000,
  }), true);
});

test("D1 provider budget performs top-of-hour retention cleanup only once per window", async () => {
  const fixture = createTestDatabase();
  const binding = fixture.binding as unknown as D1Database;
  const now = 3_600_000;

  fixture.resetMetrics();
  assert.equal(await reserveD1ProviderBudget(binding, {
    scope: "hypixel:authenticated",
    tokens: 2,
    limit: 20,
    now,
  }), true);
  assert.equal(fixture.metrics.standaloneQueries, 2);

  fixture.resetMetrics();
  assert.equal(await reserveD1ProviderBudget(binding, {
    scope: "hypixel:authenticated",
    tokens: 2,
    limit: 20,
    now,
  }), true);
  assert.equal(fixture.metrics.standaloneQueries, 1);
});

function runtimeEnvironment(
  global: () => Promise<{ success: boolean }>,
  metrics: { gets: number; puts: number } = { gets: 0, puts: 0 },
) {
  const values = new Map<string, string>();
  const namespace = {
    async get(key: string) {
      metrics.gets += 1;
      const value = values.get(key);
      return value === undefined ? null : JSON.parse(value) as unknown;
    },
    async put(key: string, value: string) {
      metrics.puts += 1;
      values.set(key, value);
    },
    async delete(key: string) {
      values.delete(key);
    },
  } as unknown as KVNamespace;
  return {
    PROVIDER_BUDGET_DB: {} as D1Database,
    PLAYER_CACHE: namespace,
    PLAYER_GLOBAL_LIMITER: { limit: global } as unknown as RateLimit,
    HYPIXEL_API_KEY: "fixture-hypixel-key",
  };
}
