import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";
import {
  DatabaseSync,
  type SQLInputValue,
  type StatementSync,
} from "node:sqlite";
import { drizzle } from "drizzle-orm/d1";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as schema from "../../db/schema";
import { DrizzlePublicEconomySnapshotStore } from "../../lib/repositories/drizzle/public-economy-snapshot.repository";
import { bazaarHistoryResponse } from "../../app/api/economy/bazaar/history/route";
import { BazaarHistoryPanel } from "../../components/BazaarHistoryPanel";

test("Bazaar history aggregation is idempotent, OHLC-correct, and bounded", async () => {
  const sqlite = await migratedDatabase();
  const db = drizzle(new SqliteD1(sqlite) as never, { schema });
  let currentTime = new Date("2026-08-11T12:06:00.000Z");
  const store = new DrizzlePublicEconomySnapshotStore(db, {
    now: () => currentTime,
    bazaarHourlyHistoryRetentionMs: 2 * 60 * 60_000,
    bazaarDailyHistoryRetentionMs: 2 * 24 * 60 * 60_000,
  });
  const claim = await store.claimWorkerLease({
    owner: "history-worker",
    now: currentTime,
    leaseMs: 10 * 24 * 60 * 60_000,
  });
  assert.equal(claim.claimed, true);
  const lease = { owner: "history-worker", token: claim.state.leaseToken };

  const first = Date.parse("2026-08-11T12:05:00.000Z");
  await publishBazaar(store, lease, first, 100, 110, 1_000, null);
  await store.aggregateBazaarHistory(first, lease);
  await assert.rejects(
    () => store.aggregateBazaarHistory(first, { ...lease, token: lease.token + 1 }),
    /lease expired/i,
  );

  currentTime = new Date("2026-08-11T12:36:00.000Z");
  await publishBazaar(
    store,
    lease,
    Date.parse("2026-08-11T12:35:00.000Z"),
    90,
    120,
    3_000,
    2_000,
  );
  currentTime = new Date("2026-08-11T13:06:00.000Z");
  await publishBazaar(
    store,
    lease,
    Date.parse("2026-08-11T13:05:00.000Z"),
    105,
    115,
    5_000,
    4_000,
  );

  const hourly = await store.readBazaarHistory({
    productId: "ENCHANTED_CARROT",
    resolution: "hour",
    limit: 24,
  });
  assert.equal(hourly?.buckets.length, 2);
  assert.deepEqual(
    hourly?.buckets[0],
    {
      productId: "ENCHANTED_CARROT",
      resolution: "hour",
      bucketStartAt: new Date("2026-08-11T12:00:00.000Z"),
      firstSourceUpdatedAt: new Date("2026-08-11T12:05:00.000Z"),
      lastSourceUpdatedAt: new Date("2026-08-11T12:35:00.000Z"),
      sampleCount: 2,
      buyOpen: 100,
      buyHigh: 100,
      buyLow: 90,
      buyClose: 90,
      sellOpen: 110,
      sellHigh: 120,
      sellLow: 110,
      sellClose: 120,
      averageBuyVolume: 2_000,
      averageSellVolume: 2_000,
    },
  );
  const daily = await store.readBazaarHistory({
    productId: "ENCHANTED_CARROT",
    resolution: "day",
    limit: 30,
  });
  assert.equal(daily?.buckets[0]?.sampleCount, 3);

  currentTime = new Date("2026-08-14T12:06:00.000Z");
  await publishBazaar(
    store,
    lease,
    Date.parse("2026-08-14T12:05:00.000Z"),
    130,
    140,
    1_000,
    1_000,
  );
  assert.equal((await store.readBazaarHistory({
    productId: "ENCHANTED_CARROT",
    resolution: "hour",
    limit: 24,
  }))?.buckets.length, 1);
  assert.equal((await store.readBazaarHistory({
    productId: "ENCHANTED_CARROT",
    resolution: "day",
    limit: 30,
  }))?.buckets.length, 1);
  sqlite.close();
});

test("Bazaar history route is bounded, identity-explicit, and performs no upstream work", async () => {
  let received: unknown;
  const response = await bazaarHistoryResponse(
    new Request("https://example.test/api/economy/bazaar/history?product=enchanted_carrot&resolution=day&limit=999999"),
    {
      async readBazaarHistory(input) {
        received = input;
        return {
          state: {
            feed: "bazaar",
            sourceUpdatedAt: new Date("2026-08-11T12:00:00.000Z"),
            publishedAt: new Date("2026-08-11T12:00:05.000Z"),
            expiresAt: new Date("2099-01-01T00:00:00.000Z"),
            recordCount: 1,
            skippedMalformed: 0,
          },
          buckets: [],
        };
      },
    },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(received, {
    productId: "ENCHANTED_CARROT",
    resolution: "day",
    limit: 1_095,
  });
  const payload = await response.json() as { data: Record<string, unknown> };
  assert.deepEqual(payload.data.identity, {
    kind: "bazaar-product",
    productId: "ENCHANTED_CARROT",
    variantKey: null,
  });
  assert.equal(payload.data.collectionStatus, "collecting");
  assert.match(String(payload.data.notice), /not exact trade history/i);

  await assert.rejects(
    () => bazaarHistoryResponse(
      new Request("https://example.test/api/economy/bazaar/history?product=%25"),
      { async readBazaarHistory() { throw new Error("must not query storage"); } },
    ),
    /valid Bazaar product ID/,
  );
});

test("Bazaar history panel renders accessible range controls and an honest loading state", () => {
  const html = renderToStaticMarkup(
    createElement(BazaarHistoryPanel, { productId: "ENCHANTED_CARROT" }),
  );
  assert.match(html, /Price and volume history/i);
  assert.match(html, /durable worker aggregates/i);
  assert.match(html, /aria-label="History range"/i);
  assert.match(html, /aria-pressed="true"[^>]*>24H</i);
  assert.match(html, /Loading collected history/i);
  assert.doesNotMatch(html, /fixture|demo price/i);
});

async function publishBazaar(
  store: DrizzlePublicEconomySnapshotStore,
  lease: { owner: string; token: number },
  lastUpdated: number,
  buyPrice: number,
  sellPrice: number,
  buyVolume: number | null,
  sellVolume: number | null,
) {
  await store.saveBazaarSnapshot({
    lastUpdated,
    skippedProducts: 0,
    products: [{
      productId: "ENCHANTED_CARROT",
      buyPrice,
      sellPrice,
      buyVolume,
      sellVolume,
      buyMovingWeek: null,
      sellMovingWeek: null,
      buyOrders: null,
      sellOrders: null,
      spread: sellPrice - buyPrice,
      spreadPercent: (sellPrice - buyPrice) / buyPrice * 100,
    }],
  }, lease);
  await store.aggregateBazaarHistory(lastUpdated, lease);
}

async function migratedDatabase(): Promise<DatabaseSync> {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  const migrationUrl = new URL("../../drizzle/", import.meta.url);
  const files = (await readdir(migrationUrl))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
  for (const file of files) {
    const contents = await readFile(new URL(file, migrationUrl), "utf8");
    for (const statement of contents
      .split("--> statement-breakpoint")
      .map((value) => value.trim())
      .filter(Boolean)) {
      database.exec(statement);
    }
  }
  return database;
}

class SqliteD1Statement {
  constructor(
    private readonly database: DatabaseSync,
    private readonly query: string,
    private readonly parameters: SQLInputValue[] = [],
  ) {}

  bind(...parameters: SQLInputValue[]) {
    return new SqliteD1Statement(this.database, this.query, parameters);
  }

  async run() {
    const result = this.statement().run(...this.parameters);
    return {
      success: true,
      results: [],
      meta: {
        changes: Number(result.changes),
        last_row_id: Number(result.lastInsertRowid),
      },
    };
  }

  async all() {
    return { success: true, results: this.statement().all(...this.parameters), meta: {} };
  }

  async raw() {
    return this.statement()
      .all(...this.parameters)
      .map((row) => Object.values(row));
  }

  private statement(): StatementSync {
    return this.database.prepare(this.query);
  }
}

class SqliteD1 {
  constructor(private readonly database: DatabaseSync) {}

  prepare(query: string) {
    return new SqliteD1Statement(this.database, query);
  }

  async batch(statements: SqliteD1Statement[]) {
    this.database.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}
