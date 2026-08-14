import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { ProviderError } from "../../lib/providers/errors";
import type { HypixelProvider } from "../../lib/providers/hypixel";
import type {
  EconomyPublicationLease,
  PublicEconomySnapshotStore,
  PublicEconomyWorkerState,
} from "../../lib/repositories/economy-snapshots";
import { refreshBazaar } from "../../worker/jobs/bazaar";
import {
  computeEconomyBackoffMs,
  runPublicEconomyCycle,
} from "../../worker/jobs/economy";

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

test("admin economy refresh uses the elected durable cycle instead of direct feed jobs", async () => {
  const source = await readFile(new URL("../../app/api/admin/actions/route.ts", import.meta.url), "utf8");
  assert.match(source, /runPublicEconomyCycle/);
  assert.match(source, /DrizzlePublicEconomySnapshotStore/);
  assert.doesNotMatch(source, /refreshBazaar|refreshEndedAuctions/);
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
