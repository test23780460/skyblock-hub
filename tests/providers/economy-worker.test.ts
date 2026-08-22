import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../db/schema";
import { bazaarSnapshotResponse } from "../../app/api/economy/bazaar/route";
import { MemoryTtlCache } from "../../lib/cache/ttl-cache";
import { ProviderError } from "../../lib/providers/errors";
import { HypixelProvider } from "../../lib/providers/hypixel";
import type {
  EconomyPublicationLease,
  PublicEconomySnapshotStore,
  PublicEconomyWorkerState,
} from "../../lib/repositories/economy-snapshots";
import { DrizzlePublicEconomySnapshotStore } from "../../lib/repositories/drizzle/public-economy-snapshot.repository";
import { runCloudflarePublicEconomyCycle } from "../../worker/economy-runtime";
import { refreshBazaar } from "../../worker/jobs/bazaar";
import {
  computeEconomyBackoffMs,
  runPublicEconomyCycle,
} from "../../worker/jobs/economy";
import { createTestDatabase } from "./d1-fixture";

const workerState: PublicEconomyWorkerState = {
  provider: "hypixel-public",
  leaseOwner: "worker-a",
  leaseUntil: new Date("2026-08-09T12:15:00.000Z"),
  leaseToken: 7,
  backoffUntil: null,
  consecutiveFailures: 0,
  lastAttemptAt: new Date("2026-08-09T12:00:00.000Z"),
  lastSuccessAt: null,
  lastFailureAt: null,
  lastErrorCode: null,
  lastErrorStatus: null,
};

test("economy jobs refuse to publish outside an elected durable lease", async () => {
  let providerCalled = false;
  const provider = {
    async getBazaar() {
      providerCalled = true;
      throw new Error("must not run");
    },
  } as unknown as HypixelProvider;

  await assert.rejects(
    () => refreshBazaar({ provider }),
    (error: unknown) => error instanceof ProviderError && error.status === 503,
  );
  assert.equal(providerCalled, false);
});

test("unchanged Bazaar generations repair aggregate history without duplicating snapshots", async () => {
  const calls: string[] = [];
  const leases: EconomyPublicationLease[] = [];
  const store = fakeStore({ calls, leases });
  const provider = {
    async getBazaar() {
      calls.push("provider:bazaar");
      return {
        data: { lastUpdated: 2_000, products: [], skippedProducts: 0 },
        cacheStatus: "fresh",
      };
    },
  } as unknown as HypixelProvider;

  const result = await refreshBazaar({
    provider,
    sink: store,
    lease: { owner: "worker-a", token: 7 },
    previousLastUpdated: 2_000,
  });

  assert.equal(result.status, "skipped");
  assert.deepEqual(calls, ["provider:bazaar", "aggregate:bazaar"]);
  assert.deepEqual(leases, [{ owner: "worker-a", token: 7 }]);
});

test("stale upstream Bazaar data never overwrites the durable snapshot", async () => {
  const calls: string[] = [];
  const store = fakeStore({ calls });
  const provider = {
    async getBazaar() {
      calls.push("provider:bazaar");
      return {
        data: { lastUpdated: 2_000, products: [], skippedProducts: 0 },
        cacheStatus: "stale",
      };
    },
  } as unknown as HypixelProvider;

  const result = await refreshBazaar({
    provider,
    sink: store,
    lease: { owner: "worker-a", token: 7 },
    previousLastUpdated: 1_000,
  });

  assert.equal(result.status, "skipped");
  assert.equal(result.cacheStatus, "stale");
  assert.deepEqual(calls, ["provider:bazaar"]);
});

test("expired durable Bazaar data remains readable and explicitly stale", async () => {
  const response = await bazaarSnapshotResponse(
    new Request("https://example.test/api/economy/bazaar?limit=10"),
    {
      async readBazaarSnapshot() {
        return {
          state: {
            feed: "bazaar",
            sourceUpdatedAt: new Date("2000-01-01T11:59:00.000Z"),
            publishedAt: new Date("2000-01-01T11:59:05.000Z"),
            expiresAt: new Date("2000-01-01T12:04:05.000Z"),
            recordCount: 1,
            skippedMalformed: 0,
          },
          products: [{
            productId: "ENCHANTED_CARROT",
            buyPrice: 100,
            sellPrice: 110,
            buyVolume: 1_000,
            sellVolume: 800,
            buyMovingWeek: 8_000,
            sellMovingWeek: 7_000,
            buyOrders: 12,
            sellOrders: 10,
            spread: 10,
            spreadPercent: 10,
          }],
        };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("Cache-Control"),
    "public, max-age=30, stale-while-revalidate=60",
  );
  const payload = await response.json() as {
    data: { cacheStatus: string; products: unknown[] };
  };
  assert.equal(payload.data.cacheStatus, "stale");
  assert.equal(payload.data.products.length, 1);
});

test("elected economy cycle publishes all normalized feeds with its fencing token", async () => {
  const calls: string[] = [];
  const leases: EconomyPublicationLease[] = [];
  const store = fakeStore({ calls, leases });
  const provider = {
    async getEndedAuctions() {
      calls.push("provider:ended");
      return { data: { lastUpdated: 1_000, auctions: [], skippedAuctions: 0 }, cacheStatus: "fresh" };
    },
    async getBazaar() {
      calls.push("provider:bazaar");
      return { data: { lastUpdated: 2_000, products: [], skippedProducts: 0 }, cacheStatus: "fresh" };
    },
    async getActiveAuctions() {
      calls.push("provider:active");
      return { data: { page: 0, totalPages: 1, totalAuctions: 0, lastUpdated: 3_000, auctions: [], skippedAuctions: 0 }, cacheStatus: "fresh" };
    },
  } as unknown as HypixelProvider;

  const result = await runPublicEconomyCycle({
    store,
    provider,
    owner: "worker-a",
    now: () => new Date("2026-08-09T12:00:00.000Z"),
    random: () => 0,
  });

  assert.equal(result.status, "completed");
  assert.deepEqual(result.jobs.map((job) => job.job), ["ended-auctions", "bazaar", "active-auctions"]);
  assert.deepEqual(calls, [
    "lease:claim",
    "provider:ended",
    "save:ended",
    "provider:bazaar",
    "save:bazaar",
    "aggregate:bazaar",
    "provider:active",
    "save:active",
    "lease:success",
    "lease:release",
  ]);
  assert.deepEqual(leases, [
    { owner: "worker-a", token: 7 },
    { owner: "worker-a", token: 7 },
    { owner: "worker-a", token: 7 },
    { owner: "worker-a", token: 7 },
  ]);
});

test("durable worker circuit skips active leases and honors reset-aware 429/503 backoff", async () => {
  const leased = fakeStore({ claimReason: "leased" });
  const skipped = await runPublicEconomyCycle({ store: leased, owner: "worker-b" });
  assert.deepEqual(skipped, { status: "skipped", jobs: [] });

  const backingOff = fakeStore({
    claimReason: "backoff",
    state: {
      ...workerState,
      leaseOwner: null,
      leaseUntil: null,
      backoffUntil: new Date("2026-08-09T12:00:30.000Z"),
      lastErrorCode: "rate_limited",
    },
  });
  const paused = await runPublicEconomyCycle({
    store: backingOff,
    owner: "worker-b",
    now: () => new Date("2026-08-09T12:00:00.000Z"),
  });
  assert.equal(paused.status, "backing-off");
  assert.equal(paused.retryAfterSeconds, 30);
  assert.equal(paused.errorCode, "rate_limited");

  assert.equal(computeEconomyBackoffMs({ status: 429, consecutiveFailures: 0, retryAfterSeconds: 42, random: () => 0 }), 42_000);
  assert.equal(computeEconomyBackoffMs({ status: 503, consecutiveFailures: 2, random: () => 0 }), 60_000);
  assert.equal(computeEconomyBackoffMs({ status: 503, consecutiveFailures: 99, random: () => 1 }), 900_000);
});

test("active-auction reads batch marker, count, and page in one D1 transaction", async () => {
  const { database, db, metrics, resetMetrics } = createTestDatabase();
  const now = new Date("2026-08-15T12:00:00.000Z");
  const store = new DrizzlePublicEconomySnapshotStore(db, { now: () => now });

  try {
    const claim = await store.claimWorkerLease({
      owner: "active-read-test",
      now,
      leaseMs: 60_000,
    });
    assert.equal(claim.claimed, true);
    await store.replaceActiveAuctionSnapshot({
      lastUpdated: now.getTime() - 30_000,
      auctions: [{
        id: "00000000000000000000000000000001",
        itemName: "Test auction",
        category: "misc",
        tier: "COMMON",
        startingBid: 1_000,
        highestBidAmount: 1_100,
        bin: true,
        startAt: now.getTime() - 60_000,
        endAt: now.getTime() + 60_000,
        bidCount: 0,
      }],
      skippedAuctions: 0,
    }, {
      owner: "active-read-test",
      token: claim.state.leaseToken,
    });

    resetMetrics();
    const result = await store.readActiveAuctionSnapshot({
      query: "test",
      page: 0,
      limit: 20,
    });
    assert.equal(result?.matchingAuctions, 1);
    assert.equal(result?.auctions.length, 1);
    assert.deepEqual(metrics, {
      standaloneQueries: 0,
      batchCalls: 1,
      batchStatements: 3,
    });
  } finally {
    database.close();
  }
});

test("expired predecessor cleanup cannot delete a successor auction generation", async () => {
  const { binding, database } = createTestDatabase();
  const base = binding;
  type FixtureStatement = ReturnType<typeof base.prepare>;
  const now = new Date("2026-08-15T12:00:00.000Z");
  const predecessorSource = now.getTime() - 30_000;
  const successorSource = now.getTime() - 10_000;
  let claimToken = 0;
  let raced = false;

  function guardedStatement(statement: FixtureStatement): FixtureStatement {
    return new Proxy(statement, {
      get(target, property, receiver) {
        if (property === "bind") {
          return (...values: Parameters<FixtureStatement["bind"]>) =>
            guardedStatement(target.bind(...values));
        }
        if (property === "run") {
          return async () => {
            if (!raced) {
              raced = true;
              database.exec(`
                insert into public_active_auction_snapshot_rows (
                  source_updated_at, auction_uuid, captured_at, item_name,
                  item_name_normalized, category, tier, starting_bid,
                  highest_bid_amount, is_bin, starts_at, ends_at, bid_count
                ) values (
                  ${successorSource}, '22222222222222222222222222222222',
                  ${now.getTime()}, 'Successor auction', 'successor auction',
                  'misc', 'COMMON', 1000, 1000, 1,
                  ${now.getTime() - 60_000}, ${now.getTime() + 60_000}, 0
                );
                update public_economy_worker_state
                set lease_owner = 'successor', lease_token = ${claimToken + 1},
                    lease_until = ${now.getTime() + 120_000}
                where provider = 'hypixel-public';
                update public_economy_feed_state
                set source_updated_at = ${successorSource},
                    published_lease_token = ${claimToken + 1}
                where feed = 'active-auctions';
              `);
            }
            return target.run();
          };
        }
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  }

  const racedBinding = new Proxy(base, {
    get(target, property, receiver) {
      if (property === "prepare") {
        return (query: string) => {
          const statement = target.prepare(query);
          return /delete from public_active_auction_snapshot_rows/iu.test(query)
            ? guardedStatement(statement)
            : statement;
        };
      }
      const value = Reflect.get(target, property, receiver) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const store = new DrizzlePublicEconomySnapshotStore(
    drizzle(racedBinding as never, { schema }),
    { now: () => now },
  );

  try {
    const claim = await store.claimWorkerLease({
      owner: "predecessor",
      now,
      leaseMs: 60_000,
    });
    assert.equal(claim.claimed, true);
    claimToken = claim.state.leaseToken;
    await store.replaceActiveAuctionSnapshot({
      lastUpdated: predecessorSource,
      auctions: [{
        id: "11111111111111111111111111111111",
        itemName: "Predecessor auction",
        category: "misc",
        tier: "COMMON",
        startingBid: 1_000,
        highestBidAmount: 1_000,
        bin: true,
        startAt: now.getTime() - 60_000,
        endAt: now.getTime() + 60_000,
        bidCount: 0,
      }],
      skippedAuctions: 0,
    }, { owner: "predecessor", token: claimToken });

    const successor = database.prepare(`
      select count(*) as count
      from public_active_auction_snapshot_rows
      where source_updated_at = ?
    `).get(successorSource) as { count: number };
    assert.equal(successor.count, 1);
    assert.equal(raced, true);
  } finally {
    database.close();
  }
});

test("Cloudflare economy composition publishes normalized D1 Bazaar snapshot and history", async () => {
  const { binding, database, db } = createTestDatabase();
  const now = new Date("2026-08-15T12:00:00.000Z");
  const bazaarUpdatedAt = Date.parse("2026-08-15T11:59:30.000Z");
  const quickStatus = {
    buyPrice: 100,
    sellPrice: 110,
    buyVolume: 1_000,
    sellVolume: 800,
    buyMovingWeek: 8_000,
    sellMovingWeek: 7_000,
    buyOrders: 12,
    sellOrders: 10,
  };
  const bazaarProducts = Object.fromEntries([
    [
      "ENCHANTED_CARROT",
      { product_id: "ENCHANTED_CARROT", quick_status: quickStatus },
    ],
    ...Array.from({ length: 12 }, (_, index) => {
      const productId = `TEST_PRODUCT_${index}`;
      return [productId, { product_id: productId, quick_status: quickStatus }];
    }),
  ]);
  const activeAuctions = Array.from({ length: 10 }, (_, index) => ({
    uuid: (index + 1).toString(16).padStart(32, "0"),
    item_name: `Test auction ${index}`,
    category: "misc",
    tier: "common",
    starting_bid: 1_000 + index,
    highest_bid_amount: 1_100 + index,
    bin: index % 2 === 0,
    start: bazaarUpdatedAt - 60_000,
    end: bazaarUpdatedAt + 60_000,
    bids: [],
  }));
  const endedAuctions = Array.from({ length: 17 }, (_, index) => ({
    auction_id: (index + 101).toString(16).padStart(32, "0"),
    timestamp: bazaarUpdatedAt,
    price: 2_000 + index,
    bin: index % 2 === 0,
  }));
  const provider = new HypixelProvider({
    apiKey: null,
    cache: new MemoryTtlCache(),
    fetchImplementation: async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/skyblock/bazaar")) {
        return Response.json({
          success: true,
          lastUpdated: bazaarUpdatedAt,
          products: bazaarProducts,
        });
      }
      if (path.endsWith("/skyblock/auctions_ended")) {
        return Response.json({
          success: true,
          lastUpdated: bazaarUpdatedAt,
          auctions: endedAuctions,
        });
      }
      if (path.endsWith("/skyblock/auctions")) {
        return Response.json({
          success: true,
          page: 0,
          totalPages: 1,
          totalAuctions: activeAuctions.length,
          lastUpdated: bazaarUpdatedAt,
          auctions: activeAuctions,
        });
      }
      return new Response(null, { status: 404 });
    },
  });

  try {
    const result = await runCloudflarePublicEconomyCycle(binding as never, {
      provider,
      owner: "cloudflare-cron-test",
      now: () => now,
      random: () => 0,
    });
    assert.equal(result.status, "completed");

    const store = new DrizzlePublicEconomySnapshotStore(db);
    const snapshot = await store.readBazaarSnapshot({
      query: "ENCHANTED_CARROT",
      limit: 10,
    });
    assert.deepEqual(snapshot?.products, [{
      productId: "ENCHANTED_CARROT",
      buyPrice: 100,
      sellPrice: 110,
      buyVolume: 1_000,
      sellVolume: 800,
      buyMovingWeek: 8_000,
      sellMovingWeek: 7_000,
      buyOrders: 12,
      sellOrders: 10,
      spread: 10,
      spreadPercent: 10,
    }]);
    const boundedSearch = await store.readBazaarSnapshot({
      query: "A".repeat(128),
      limit: 10,
    });
    assert.deepEqual(boundedSearch?.products, []);
    const history = await store.readBazaarHistory({
      productId: "ENCHANTED_CARROT",
      resolution: "hour",
      limit: 10,
    });
    assert.equal(history?.buckets.length, 1);
    assert.equal(history?.buckets[0]?.sampleCount, 1);
    const active = await store.readActiveAuctionSnapshot({
      query: "",
      page: 0,
      limit: 20,
    });
    assert.equal(active?.auctions.length, activeAuctions.length);
    const ended = await store.readEndedAuctionSnapshot({ limit: 20 });
    assert.equal(ended?.auctions.length, endedAuctions.length);
  } finally {
    database.close();
  }
});

test("public economy persistence schema excludes identities and raw item payloads", async () => {
  const source = await readFile(new URL("../../db/schema/economy.ts", import.meta.url), "utf8");
  const publicTables = source.slice(source.indexOf("publicEconomyWorkerState"));
  const declarations = publicTables
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.match(publicTables, /public_bazaar_snapshot_rows/);
  assert.match(publicTables, /public_bazaar_history_buckets/);
  assert.match(publicTables, /public_active_auction_snapshot_rows/);
  assert.match(publicTables, /public_ended_auction_sales/);
  assert.doesNotMatch(declarations, /sellerMinecraftUuid|buyer|bidder|itemData|saleData|lore|nbt/i);
  assert.match(publicTables, /publishedLeaseToken/);
  assert.match(publicTables, /leaseToken/);
});

test("admin exposes only the private-service economy refresh control", async () => {
  const [routeSource, componentSource] = await Promise.all([
    readFile(new URL("../../app/api/admin/actions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../components/AdminExperience.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(routeSource, /requestEconomyRefresh\(env\.ECONOMY_SERVICE\)/u);
  assert.doesNotMatch(
    routeSource,
    /runPublicEconomyCycle|refreshBazaar|refreshActiveAuctions|refreshEndedAuctions|clear-economy-cache|sharedProviderCache/u,
  );
  assert.doesNotMatch(
    componentSource,
    /clear-economy-cache|Clear economy cache|targeted economy-cache|window\.confirm/u,
  );
});

function fakeStore(options: {
  calls?: string[];
  leases?: EconomyPublicationLease[];
  claimReason?: "acquired" | "leased" | "backoff";
  state?: PublicEconomyWorkerState;
} = {}): PublicEconomySnapshotStore {
  const calls = options.calls ?? [];
  const leases = options.leases ?? [];
  const state = options.state ?? workerState;
  const claimReason = options.claimReason ?? "acquired";
  return {
    async claimWorkerLease() {
      calls.push("lease:claim");
      return { claimed: claimReason === "acquired", reason: claimReason, state };
    },
    async recordWorkerSuccess() { calls.push("lease:success"); },
    async recordWorkerFailure() { calls.push("lease:failure"); },
    async releaseWorkerLease() { calls.push("lease:release"); },
    async getFeedState() { return null; },
    async saveBazaarSnapshot(_snapshot, lease) { calls.push("save:bazaar"); leases.push(lease); },
    async aggregateBazaarHistory(_sourceUpdatedAt, lease) { calls.push("aggregate:bazaar"); leases.push(lease); },
    async replaceActiveAuctionSnapshot(_snapshot, lease) { calls.push("save:active"); leases.push(lease); },
    async saveEndedAuctionSnapshot(_snapshot, lease) { calls.push("save:ended"); leases.push(lease); },
    async readBazaarSnapshot() { return null; },
    async readBazaarHistory() { return null; },
    async readActiveAuctionSnapshot() { return null; },
    async readEndedAuctionSnapshot() { return null; },
  };
}
