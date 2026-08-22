import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  isNull,
  like,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type { AppDatabase } from "@/db";
import { ProviderError } from "@/lib/providers/errors";
import {
  publicActiveAuctionSnapshotRows,
  publicBazaarHistoryBuckets,
  publicBazaarSnapshotRows,
  publicEconomyFeedState,
  publicEconomyWorkerState,
  publicEndedAuctionSales,
} from "@/db/schema";
import {
  PUBLIC_ECONOMY_PROVIDER,
  type EconomyPublicationLease,
  type EconomyLeaseClaim,
  type BazaarHistoryResolution,
  type PublishedEconomyFeed,
  type PublicEconomyFeed,
  type PublicEconomySnapshotStore,
  type PublicEconomyWorkerState,
} from "../economy-snapshots";

const BAZAAR_FRESH_MS = 5 * 60_000;
const ACTIVE_AUCTION_FRESH_MS = 5 * 60_000;
const ENDED_AUCTION_FRESH_MS = 3 * 60_000;
const ENDED_AUCTION_RETENTION_MS = 180 * 24 * 60 * 60_000;
export const BAZAAR_HOURLY_HISTORY_RETENTION_MS = 90 * 24 * 60 * 60_000;
export const BAZAAR_DAILY_HISTORY_RETENTION_MS = 3 * 365 * 24 * 60 * 60_000;
// D1 permits at most 100 bound parameters per query and 2 MB per string.
// Passing bounded JSON arrays through json_each(?) uses one parameter per
// chunk and sharply reduces snapshot-publication query count.
const DEFAULT_JSON_WRITE_CHUNK_BYTES = 1_000_000;
// Leave two bytes for the surrounding contains-search wildcards.
const D1_LIKE_QUERY_BYTES = 48;
const UTF8_ENCODER = new TextEncoder();

type StoreOptions = {
  now?: () => Date;
  endedAuctionRetentionMs?: number;
  bazaarHourlyHistoryRetentionMs?: number;
  bazaarDailyHistoryRetentionMs?: number;
  jsonWriteChunkBytes?: number;
};

export class DrizzlePublicEconomySnapshotStore
  implements PublicEconomySnapshotStore
{
  private readonly now: () => Date;
  private readonly endedAuctionRetentionMs: number;
  private readonly bazaarHourlyHistoryRetentionMs: number;
  private readonly bazaarDailyHistoryRetentionMs: number;
  private readonly jsonWriteChunkBytes: number;

  constructor(
    private readonly db: AppDatabase,
    options: StoreOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.endedAuctionRetentionMs = positiveInteger(
      options.endedAuctionRetentionMs ?? ENDED_AUCTION_RETENTION_MS,
    );
    this.bazaarHourlyHistoryRetentionMs = positiveInteger(
      options.bazaarHourlyHistoryRetentionMs ??
        BAZAAR_HOURLY_HISTORY_RETENTION_MS,
    );
    this.bazaarDailyHistoryRetentionMs = positiveInteger(
      options.bazaarDailyHistoryRetentionMs ??
        BAZAAR_DAILY_HISTORY_RETENTION_MS,
    );
    this.jsonWriteChunkBytes = Math.min(
      DEFAULT_JSON_WRITE_CHUNK_BYTES,
      positiveInteger(
        options.jsonWriteChunkBytes ?? DEFAULT_JSON_WRITE_CHUNK_BYTES,
      ),
    );
  }

  async claimWorkerLease(input: {
    owner: string;
    now: Date;
    leaseMs: number;
  }): Promise<EconomyLeaseClaim> {
    await this.ensureWorkerState();
    const leaseUntil = new Date(input.now.getTime() + positiveInteger(input.leaseMs));
    const [claimed] = await this.db
      .update(publicEconomyWorkerState)
      .set({
        leaseOwner: input.owner,
        leaseUntil,
        leaseToken: sql`${publicEconomyWorkerState.leaseToken} + 1`,
        lastAttemptAt: input.now,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(publicEconomyWorkerState.provider, PUBLIC_ECONOMY_PROVIDER),
          or(
            isNull(publicEconomyWorkerState.backoffUntil),
            lte(publicEconomyWorkerState.backoffUntil, input.now),
          ),
          or(
            isNull(publicEconomyWorkerState.leaseUntil),
            lte(publicEconomyWorkerState.leaseUntil, input.now),
            eq(publicEconomyWorkerState.leaseOwner, input.owner),
          ),
        ),
      )
      .returning();

    if (claimed) {
      return {
        claimed: true,
        reason: "acquired",
        state: workerState(claimed),
      };
    }

    const state = await this.requireWorkerState();
    return {
      claimed: false,
      reason:
        state.backoffUntil && state.backoffUntil.getTime() > input.now.getTime()
          ? "backoff"
          : "leased",
      state,
    };
  }

  async recordWorkerSuccess(
    input: EconomyPublicationLease & { at: Date },
  ): Promise<void> {
    await this.db
      .update(publicEconomyWorkerState)
      .set({
        leaseOwner: null,
        leaseUntil: null,
        backoffUntil: null,
        consecutiveFailures: 0,
        lastSuccessAt: input.at,
        lastErrorCode: null,
        lastErrorStatus: null,
        updatedAt: input.at,
      })
      .where(
        and(
          eq(publicEconomyWorkerState.provider, PUBLIC_ECONOMY_PROVIDER),
          eq(publicEconomyWorkerState.leaseOwner, input.owner),
          eq(publicEconomyWorkerState.leaseToken, input.token),
        ),
      );
  }

  async recordWorkerFailure(input: {
    owner: string;
    token: number;
    at: Date;
    code: string;
    status: number;
    backoffUntil: Date;
  }): Promise<void> {
    await this.db
      .update(publicEconomyWorkerState)
      .set({
        leaseOwner: null,
        leaseUntil: null,
        backoffUntil: input.backoffUntil,
        consecutiveFailures: sql`${publicEconomyWorkerState.consecutiveFailures} + 1`,
        lastFailureAt: input.at,
        lastErrorCode: input.code.slice(0, 80),
        lastErrorStatus: boundedHttpStatus(input.status),
        updatedAt: input.at,
      })
      .where(
        and(
          eq(publicEconomyWorkerState.provider, PUBLIC_ECONOMY_PROVIDER),
          eq(publicEconomyWorkerState.leaseOwner, input.owner),
          eq(publicEconomyWorkerState.leaseToken, input.token),
        ),
      );
  }

  async releaseWorkerLease(lease: EconomyPublicationLease): Promise<void> {
    await this.db
      .update(publicEconomyWorkerState)
      .set({ leaseOwner: null, leaseUntil: null, updatedAt: this.now() })
      .where(
        and(
          eq(publicEconomyWorkerState.provider, PUBLIC_ECONOMY_PROVIDER),
          eq(publicEconomyWorkerState.leaseOwner, lease.owner),
          eq(publicEconomyWorkerState.leaseToken, lease.token),
        ),
      );
  }

  async getFeedState(
    feed: PublicEconomyFeed,
  ): Promise<PublishedEconomyFeed | null> {
    const [state] = await this.db
      .select()
      .from(publicEconomyFeedState)
      .where(eq(publicEconomyFeedState.feed, feed))
      .limit(1);
    return state ? publishedFeed(state) : null;
  }

  async saveBazaarSnapshot(
    snapshot: Parameters<PublicEconomySnapshotStore["saveBazaarSnapshot"]>[0],
    lease: EconomyPublicationLease,
  ): Promise<void> {
    const capturedAt = this.now();
    const sourceUpdatedAt = new Date(snapshot.lastUpdated);
    const products = [...new Map(
      snapshot.products.map((product) => [product.productId, product]),
    ).values()];
    const rows = products.map((product) => [
      sourceUpdatedAt.getTime(),
      product.productId,
      capturedAt.getTime(),
      product.buyPrice,
      product.sellPrice,
      integerOrNull(product.buyVolume),
      integerOrNull(product.sellVolume),
      integerOrNull(product.buyMovingWeek),
      integerOrNull(product.sellMovingWeek),
      integerOrNull(product.buyOrders),
      integerOrNull(product.sellOrders),
      product.spread,
      product.spreadPercent,
    ]);

    for (const payload of jsonArrayChunks(rows, this.jsonWriteChunkBytes)) {
      await this.db.run(sql`
        insert into public_bazaar_snapshot_rows (
          source_updated_at, product_id, captured_at, buy_price, sell_price,
          buy_volume, sell_volume, buy_moving_week, sell_moving_week,
          buy_orders, sell_orders, spread, spread_percent
        )
        select
          json_extract(value, '$[0]'), json_extract(value, '$[1]'),
          json_extract(value, '$[2]'), json_extract(value, '$[3]'),
          json_extract(value, '$[4]'), json_extract(value, '$[5]'),
          json_extract(value, '$[6]'), json_extract(value, '$[7]'),
          json_extract(value, '$[8]'), json_extract(value, '$[9]'),
          json_extract(value, '$[10]'), json_extract(value, '$[11]'),
          json_extract(value, '$[12]')
        from json_each(${payload})
        where true
        on conflict do nothing
      `);
    }

    await this.publishFeed({
      feed: "bazaar",
      sourceUpdatedAt,
      publishedAt: capturedAt,
      expiresAt: new Date(capturedAt.getTime() + BAZAAR_FRESH_MS),
      recordCount: rows.length,
      skippedMalformed: snapshot.skippedProducts,
    }, lease);
    const cleanupAt = this.now().getTime();
    await this.db.run(sql`
      delete from public_bazaar_snapshot_rows
      where source_updated_at <> ${sourceUpdatedAt.getTime()}
        and exists (
          select 1
          from public_economy_feed_state feed
          join public_economy_worker_state worker
            on worker.provider = ${PUBLIC_ECONOMY_PROVIDER}
          where feed.feed = 'bazaar'
            and feed.source_updated_at = ${sourceUpdatedAt.getTime()}
            and feed.published_lease_token = ${lease.token}
            and worker.lease_owner = ${lease.owner}
            and worker.lease_token = ${lease.token}
            and worker.lease_until > ${cleanupAt}
        )
    `);
  }

  async aggregateBazaarHistory(
    sourceUpdatedAt: number,
    lease: EconomyPublicationLease,
  ): Promise<void> {
    const sourceMs = positiveTimestamp(sourceUpdatedAt);
    await this.assertLiveLease(lease, this.now());

    await this.upsertBazaarHistoryResolution({
      resolution: "hour",
      bucketStartMs: bucketStart(sourceMs, 60 * 60_000),
      sourceMs,
      processedAt: this.now(),
      lease,
    });
    await this.upsertBazaarHistoryResolution({
      resolution: "day",
      bucketStartMs: bucketStart(sourceMs, 24 * 60 * 60_000),
      sourceMs,
      processedAt: this.now(),
      lease,
    });

    const cleanupAt = this.now();
    await this.deleteExpiredBazaarHistory({
      resolution: "hour",
      cutoffMs: cleanupAt.getTime() - this.bazaarHourlyHistoryRetentionMs,
      lease,
      processedAt: cleanupAt,
    });
    await this.deleteExpiredBazaarHistory({
      resolution: "day",
      cutoffMs: cleanupAt.getTime() - this.bazaarDailyHistoryRetentionMs,
      lease,
      processedAt: cleanupAt,
    });
    await this.assertLiveLease(lease, this.now());
  }

  async replaceActiveAuctionSnapshot(
    snapshot: Parameters<
      PublicEconomySnapshotStore["replaceActiveAuctionSnapshot"]
    >[0],
    lease: EconomyPublicationLease,
  ): Promise<void> {
    const capturedAt = this.now();
    const sourceUpdatedAt = new Date(snapshot.lastUpdated);
    const auctions = [...new Map(
      snapshot.auctions.map((auction) => [auction.id, auction]),
    ).values()];
    const rows = auctions.map((auction) => [
      sourceUpdatedAt.getTime(),
      auction.id,
      capturedAt.getTime(),
      auction.itemName,
      auction.itemName.toLowerCase(),
      auction.category,
      auction.tier,
      integerOrNull(auction.startingBid),
      integerOrNull(auction.highestBidAmount),
      auction.bin,
      timestampOrNull(auction.startAt),
      timestampOrNull(auction.endAt),
      Math.max(0, Math.floor(auction.bidCount)),
    ]);

    for (const payload of jsonArrayChunks(rows, this.jsonWriteChunkBytes)) {
      await this.db.run(sql`
        insert into public_active_auction_snapshot_rows (
          source_updated_at, auction_uuid, captured_at, item_name,
          item_name_normalized, category, tier, starting_bid,
          highest_bid_amount, is_bin, starts_at, ends_at, bid_count
        )
        select
          json_extract(value, '$[0]'), json_extract(value, '$[1]'),
          json_extract(value, '$[2]'), json_extract(value, '$[3]'),
          json_extract(value, '$[4]'), json_extract(value, '$[5]'),
          json_extract(value, '$[6]'), json_extract(value, '$[7]'),
          json_extract(value, '$[8]'), json_extract(value, '$[9]'),
          json_extract(value, '$[10]'), json_extract(value, '$[11]'),
          json_extract(value, '$[12]')
        from json_each(${payload})
        where true
        on conflict do nothing
      `);
    }

    await this.publishFeed({
      feed: "active-auctions",
      sourceUpdatedAt,
      publishedAt: capturedAt,
      expiresAt: new Date(capturedAt.getTime() + ACTIVE_AUCTION_FRESH_MS),
      recordCount: rows.length,
      skippedMalformed: snapshot.skippedAuctions ?? 0,
    }, lease);
    const cleanupAt = this.now().getTime();
    await this.db.run(sql`
      delete from public_active_auction_snapshot_rows
      where source_updated_at <> ${sourceUpdatedAt.getTime()}
        and exists (
          select 1
          from public_economy_feed_state feed
          join public_economy_worker_state worker
            on worker.provider = ${PUBLIC_ECONOMY_PROVIDER}
          where feed.feed = 'active-auctions'
            and feed.source_updated_at = ${sourceUpdatedAt.getTime()}
            and feed.published_lease_token = ${lease.token}
            and worker.lease_owner = ${lease.owner}
            and worker.lease_token = ${lease.token}
            and worker.lease_until > ${cleanupAt}
        )
    `);
  }

  async saveEndedAuctionSnapshot(
    snapshot: Parameters<PublicEconomySnapshotStore["saveEndedAuctionSnapshot"]>[0],
    lease: EconomyPublicationLease,
  ): Promise<void> {
    const capturedAt = this.now();
    const sourceUpdatedAt = new Date(snapshot.lastUpdated);
    const deduplicated = [...new Map(
      snapshot.auctions.map((auction) => [auction.id, auction]),
    ).values()];
    const usable = deduplicated.filter(
      (auction) => auction.endedAt !== null && auction.price !== null,
    );
    const rows = usable.map((auction) => [
      auction.id,
      sourceUpdatedAt.getTime(),
      capturedAt.getTime(),
      timestampOrNull(auction.endedAt),
      integerOrNull(auction.price),
      auction.bin,
    ]);

    for (const payload of jsonArrayChunks(rows, this.jsonWriteChunkBytes)) {
      await this.db.run(sql`
        insert into public_ended_auction_sales (
          auction_uuid, source_updated_at, captured_at, ended_at, price, is_bin
        )
        select
          json_extract(value, '$[0]'), json_extract(value, '$[1]'),
          json_extract(value, '$[2]'), json_extract(value, '$[3]'),
          json_extract(value, '$[4]'), json_extract(value, '$[5]')
        from json_each(${payload})
        where true
        on conflict(auction_uuid) do nothing
      `);
    }

    await this.db
      .delete(publicEndedAuctionSales)
      .where(
        lte(
          publicEndedAuctionSales.endedAt,
          new Date(capturedAt.getTime() - this.endedAuctionRetentionMs),
        ),
      );
    const [available] = await this.db
      .select({ value: count() })
      .from(publicEndedAuctionSales)
      .where(lte(publicEndedAuctionSales.sourceUpdatedAt, sourceUpdatedAt));

    await this.publishFeed({
      feed: "ended-auctions",
      sourceUpdatedAt,
      publishedAt: capturedAt,
      expiresAt: new Date(capturedAt.getTime() + ENDED_AUCTION_FRESH_MS),
      recordCount: available?.value ?? 0,
      skippedMalformed:
        snapshot.skippedAuctions + (deduplicated.length - usable.length),
    }, lease);
  }

  async readBazaarSnapshot(input: { query: string; limit: number }) {
    const stateQuery = this.db
      .select()
      .from(publicEconomyFeedState)
      .where(eq(publicEconomyFeedState.feed, "bazaar"))
      .limit(1);
    const productsQuery = this.db
      .select({
        productId: publicBazaarSnapshotRows.productId,
        buyPrice: publicBazaarSnapshotRows.buyPrice,
        sellPrice: publicBazaarSnapshotRows.sellPrice,
        buyVolume: publicBazaarSnapshotRows.buyVolume,
        sellVolume: publicBazaarSnapshotRows.sellVolume,
        buyMovingWeek: publicBazaarSnapshotRows.buyMovingWeek,
        sellMovingWeek: publicBazaarSnapshotRows.sellMovingWeek,
        buyOrders: publicBazaarSnapshotRows.buyOrders,
        sellOrders: publicBazaarSnapshotRows.sellOrders,
        spread: publicBazaarSnapshotRows.spread,
        spreadPercent: publicBazaarSnapshotRows.spreadPercent,
      })
      .from(publicBazaarSnapshotRows)
      .innerJoin(
        publicEconomyFeedState,
        and(
          eq(publicEconomyFeedState.feed, "bazaar"),
          eq(
            publicBazaarSnapshotRows.sourceUpdatedAt,
            publicEconomyFeedState.sourceUpdatedAt,
          ),
        ),
      )
      .where(
        input.query
          ? like(
              publicBazaarSnapshotRows.productId,
              containsPattern(input.query.toUpperCase()),
            )
          : undefined,
      )
      .orderBy(asc(publicBazaarSnapshotRows.productId))
      .limit(input.limit);
    // D1 batch() is a transaction. Reading the publication marker and its
    // versioned rows together prevents cleanup from interleaving between the
    // two reads and returning an empty mixed-generation response.
    const [states, products] = await this.db.batch([
      stateQuery,
      productsQuery,
    ]);
    const state = states[0];
    return state ? { state: publishedFeed(state), products } : null;
  }

  async readBazaarHistory(input: {
    productId: string;
    resolution: BazaarHistoryResolution;
    limit: number;
  }) {
    const stateQuery = this.db
      .select()
      .from(publicEconomyFeedState)
      .where(eq(publicEconomyFeedState.feed, "bazaar"))
      .limit(1);
    const historyQuery = this.db
      .select()
      .from(publicBazaarHistoryBuckets)
      .where(
        and(
          eq(publicBazaarHistoryBuckets.productId, input.productId),
          eq(publicBazaarHistoryBuckets.resolution, input.resolution),
        ),
      )
      .orderBy(desc(publicBazaarHistoryBuckets.bucketStartAt))
      .limit(input.limit);
    const [states, rows] = await this.db.batch([stateQuery, historyQuery]);
    const state = states[0];
    if (!state) return null;
    return {
      state: publishedFeed(state),
      buckets: rows.reverse().map((row) => ({
        productId: row.productId,
        resolution: row.resolution,
        bucketStartAt: row.bucketStartAt,
        firstSourceUpdatedAt: row.firstSourceUpdatedAt,
        lastSourceUpdatedAt: row.lastSourceUpdatedAt,
        sampleCount: row.sampleCount,
        buyOpen: row.buyOpen,
        buyHigh: row.buyHigh,
        buyLow: row.buyLow,
        buyClose: row.buyClose,
        sellOpen: row.sellOpen,
        sellHigh: row.sellHigh,
        sellLow: row.sellLow,
        sellClose: row.sellClose,
        averageBuyVolume:
          row.buyVolumeSamples > 0
            ? row.buyVolumeSum / row.buyVolumeSamples
            : null,
        averageSellVolume:
          row.sellVolumeSamples > 0
            ? row.sellVolumeSum / row.sellVolumeSamples
            : null,
      })),
    };
  }

  async readActiveAuctionSnapshot(input: {
    query: string;
    page: number;
    limit: number;
  }) {
    const stateQuery = this.db
      .select()
      .from(publicEconomyFeedState)
      .where(eq(publicEconomyFeedState.feed, "active-auctions"))
      .limit(1);
    const currentVersionJoin = and(
      eq(publicEconomyFeedState.feed, "active-auctions"),
      eq(
        publicActiveAuctionSnapshotRows.sourceUpdatedAt,
        publicEconomyFeedState.sourceUpdatedAt,
      ),
    );
    const search = input.query
      ? like(
          publicActiveAuctionSnapshotRows.itemNameNormalized,
          containsPattern(input.query),
        )
      : undefined;
    const countQuery = this.db
      .select({ value: count() })
      .from(publicActiveAuctionSnapshotRows)
      .innerJoin(publicEconomyFeedState, currentVersionJoin)
      .where(search);
    const rowsQuery = this.db
      .select({
        auctionUuid: publicActiveAuctionSnapshotRows.auctionUuid,
        itemName: publicActiveAuctionSnapshotRows.itemName,
        category: publicActiveAuctionSnapshotRows.category,
        tier: publicActiveAuctionSnapshotRows.tier,
        startingBid: publicActiveAuctionSnapshotRows.startingBid,
        highestBidAmount: publicActiveAuctionSnapshotRows.highestBidAmount,
        isBin: publicActiveAuctionSnapshotRows.isBin,
        startsAt: publicActiveAuctionSnapshotRows.startsAt,
        endsAt: publicActiveAuctionSnapshotRows.endsAt,
        bidCount: publicActiveAuctionSnapshotRows.bidCount,
      })
      .from(publicActiveAuctionSnapshotRows)
      .innerJoin(publicEconomyFeedState, currentVersionJoin)
      .where(search)
      .orderBy(
        asc(publicActiveAuctionSnapshotRows.endsAt),
        asc(publicActiveAuctionSnapshotRows.auctionUuid),
      )
      .limit(input.limit)
      .offset(input.page * input.limit);
    // The marker, count, and rows must share one D1 read transaction. A writer
    // publishes the new marker before deleting the old version, so separate
    // calls could otherwise return a count and page from different versions.
    const [states, counts, rows] = await this.db.batch([
      stateQuery,
      countQuery,
      rowsQuery,
    ]);
    const state = states[0];
    if (!state) return null;
    return {
      state: publishedFeed(state),
      matchingAuctions: counts[0]?.value ?? 0,
      auctions: rows.map((row) => ({
        id: row.auctionUuid,
        itemName: row.itemName,
        category: row.category,
        tier: row.tier,
        startingBid: row.startingBid,
        highestBidAmount: row.highestBidAmount,
        bin: row.isBin,
        startAt: row.startsAt?.getTime() ?? null,
        endAt: row.endsAt?.getTime() ?? null,
        bidCount: row.bidCount,
      })),
    };
  }

  async readEndedAuctionSnapshot(input: { limit: number }) {
    const state = await this.getFeedState("ended-auctions");
    if (!state) return null;
    const rows = await this.db
      .select()
      .from(publicEndedAuctionSales)
      .where(
        lte(publicEndedAuctionSales.sourceUpdatedAt, state.sourceUpdatedAt),
      )
      .orderBy(
        desc(publicEndedAuctionSales.endedAt),
        asc(publicEndedAuctionSales.auctionUuid),
      )
      .limit(input.limit);
    return {
      state,
      available: state.recordCount,
      auctions: rows.map((row) => ({
        id: row.auctionUuid,
        endedAt: row.endedAt?.getTime() ?? null,
        price: row.price,
        bin: row.isBin,
      })),
    };
  }

  private async ensureWorkerState(): Promise<void> {
    await this.db
      .insert(publicEconomyWorkerState)
      .values({ provider: PUBLIC_ECONOMY_PROVIDER })
      .onConflictDoNothing({ target: publicEconomyWorkerState.provider });
  }

  private async assertLiveLease(
    lease: EconomyPublicationLease,
    at: Date,
  ): Promise<void> {
    const [state] = await this.db
      .select({ token: publicEconomyWorkerState.leaseToken })
      .from(publicEconomyWorkerState)
      .where(
        and(
          eq(publicEconomyWorkerState.provider, PUBLIC_ECONOMY_PROVIDER),
          eq(publicEconomyWorkerState.leaseOwner, lease.owner),
          eq(publicEconomyWorkerState.leaseToken, lease.token),
          gt(publicEconomyWorkerState.leaseUntil, at),
        ),
      )
      .limit(1);
    if (!state) throw expiredLeaseError();
  }

  private async upsertBazaarHistoryResolution(input: {
    resolution: BazaarHistoryResolution;
    bucketStartMs: number;
    sourceMs: number;
    processedAt: Date;
    lease: EconomyPublicationLease;
  }): Promise<void> {
    const processedAtMs = input.processedAt.getTime();
    await this.db.run(sql`
      insert into public_bazaar_history_buckets (
        product_id, resolution, bucket_start_at,
        first_source_updated_at, last_source_updated_at, sample_count,
        buy_open, buy_high, buy_low, buy_close,
        sell_open, sell_high, sell_low, sell_close,
        buy_volume_sum, buy_volume_samples,
        sell_volume_sum, sell_volume_samples,
        created_at, updated_at
      )
      select
        rows.product_id, ${input.resolution}, ${input.bucketStartMs},
        rows.source_updated_at, rows.source_updated_at, 1,
        rows.buy_price, rows.buy_price, rows.buy_price, rows.buy_price,
        rows.sell_price, rows.sell_price, rows.sell_price, rows.sell_price,
        coalesce(rows.buy_volume, 0), case when rows.buy_volume is null then 0 else 1 end,
        coalesce(rows.sell_volume, 0), case when rows.sell_volume is null then 0 else 1 end,
        ${processedAtMs}, ${processedAtMs}
      from public_bazaar_snapshot_rows rows
      where rows.source_updated_at = ${input.sourceMs}
        and rows.buy_price is not null
        and rows.sell_price is not null
        and exists (
          select 1 from public_economy_feed_state feed
          where feed.feed = 'bazaar'
            and feed.source_updated_at = rows.source_updated_at
        )
        and exists (
          select 1 from public_economy_worker_state worker
          where worker.provider = ${PUBLIC_ECONOMY_PROVIDER}
            and worker.lease_owner = ${input.lease.owner}
            and worker.lease_token = ${input.lease.token}
            and worker.lease_until > ${processedAtMs}
        )
      on conflict(product_id, resolution, bucket_start_at) do update set
        last_source_updated_at = excluded.last_source_updated_at,
        sample_count = public_bazaar_history_buckets.sample_count + 1,
        buy_high = max(public_bazaar_history_buckets.buy_high, excluded.buy_high),
        buy_low = min(public_bazaar_history_buckets.buy_low, excluded.buy_low),
        buy_close = excluded.buy_close,
        sell_high = max(public_bazaar_history_buckets.sell_high, excluded.sell_high),
        sell_low = min(public_bazaar_history_buckets.sell_low, excluded.sell_low),
        sell_close = excluded.sell_close,
        buy_volume_sum = public_bazaar_history_buckets.buy_volume_sum + excluded.buy_volume_sum,
        buy_volume_samples = public_bazaar_history_buckets.buy_volume_samples + excluded.buy_volume_samples,
        sell_volume_sum = public_bazaar_history_buckets.sell_volume_sum + excluded.sell_volume_sum,
        sell_volume_samples = public_bazaar_history_buckets.sell_volume_samples + excluded.sell_volume_samples,
        updated_at = excluded.updated_at
      where excluded.last_source_updated_at > public_bazaar_history_buckets.last_source_updated_at
    `);
  }

  private async deleteExpiredBazaarHistory(input: {
    resolution: BazaarHistoryResolution;
    cutoffMs: number;
    lease: EconomyPublicationLease;
    processedAt: Date;
  }): Promise<void> {
    await this.db.run(sql`
      delete from public_bazaar_history_buckets
      where resolution = ${input.resolution}
        and bucket_start_at < ${input.cutoffMs}
        and exists (
          select 1 from public_economy_worker_state worker
          where worker.provider = ${PUBLIC_ECONOMY_PROVIDER}
            and worker.lease_owner = ${input.lease.owner}
            and worker.lease_token = ${input.lease.token}
            and worker.lease_until > ${input.processedAt.getTime()}
        )
    `);
  }

  private async requireWorkerState(): Promise<PublicEconomyWorkerState> {
    const [state] = await this.db
      .select()
      .from(publicEconomyWorkerState)
      .where(eq(publicEconomyWorkerState.provider, PUBLIC_ECONOMY_PROVIDER))
      .limit(1);
    if (!state) throw new Error("Public economy worker state is unavailable");
    return workerState(state);
  }

  private async publishFeed(
    state: PublishedEconomyFeed,
    lease: EconomyPublicationLease,
  ): Promise<void> {
    const sourceUpdatedAt = state.sourceUpdatedAt.getTime();
    const publishedAt = state.publishedAt.getTime();
    const expiresAt = state.expiresAt.getTime();
    const result = await this.db.run(sql`
      insert into public_economy_feed_state (
        feed, source_updated_at, published_at, expires_at, record_count,
        skipped_malformed, published_lease_token, created_at, updated_at
      )
      select
        ${state.feed}, ${sourceUpdatedAt}, ${publishedAt}, ${expiresAt},
        ${state.recordCount}, ${state.skippedMalformed}, ${lease.token},
        ${publishedAt}, ${publishedAt}
      where exists (
        select 1 from public_economy_worker_state
        where provider = ${PUBLIC_ECONOMY_PROVIDER}
          and lease_owner = ${lease.owner}
          and lease_token = ${lease.token}
          and lease_until > ${publishedAt}
      )
      on conflict(feed) do update set
        source_updated_at = excluded.source_updated_at,
        published_at = excluded.published_at,
        expires_at = excluded.expires_at,
        record_count = excluded.record_count,
        skipped_malformed = excluded.skipped_malformed,
        published_lease_token = excluded.published_lease_token,
        updated_at = excluded.updated_at
      where excluded.source_updated_at >= public_economy_feed_state.source_updated_at
    `);
    if (result.meta.changes === 1) return;
    throw new ProviderError({
      code: "upstream_unavailable",
      message: "The economy worker lease expired before publication.",
      status: 503,
      action: "Discard the staged generation and let the elected worker retry.",
      retryable: true,
    });
  }
}

function workerState(
  value: typeof publicEconomyWorkerState.$inferSelect,
): PublicEconomyWorkerState {
  return {
    provider: PUBLIC_ECONOMY_PROVIDER,
    leaseOwner: value.leaseOwner,
    leaseUntil: value.leaseUntil,
    leaseToken: value.leaseToken,
    backoffUntil: value.backoffUntil,
    consecutiveFailures: value.consecutiveFailures,
    lastAttemptAt: value.lastAttemptAt,
    lastSuccessAt: value.lastSuccessAt,
    lastFailureAt: value.lastFailureAt,
    lastErrorCode: value.lastErrorCode,
    lastErrorStatus: value.lastErrorStatus,
  };
}

function publishedFeed(
  value: typeof publicEconomyFeedState.$inferSelect,
): PublishedEconomyFeed {
  return {
    feed: value.feed,
    sourceUpdatedAt: value.sourceUpdatedAt,
    publishedAt: value.publishedAt,
    expiresAt: value.expiresAt,
    recordCount: value.recordCount,
    skippedMalformed: value.skippedMalformed,
  };
}

function* jsonArrayChunks<T>(
  values: T[],
  maxBytes: number,
): Generator<string> {
  let encodedRows: string[] = [];
  let encodedBytes = 2;

  for (const value of values) {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw oversizedJsonRowError();
    const rowBytes = UTF8_ENCODER.encode(encoded).byteLength;
    if (rowBytes + 2 > maxBytes) throw oversizedJsonRowError();
    const separatorBytes = encodedRows.length === 0 ? 0 : 1;
    if (
      encodedRows.length > 0 &&
      encodedBytes + separatorBytes + rowBytes > maxBytes
    ) {
      yield `[${encodedRows.join(",")}]`;
      encodedRows = [];
      encodedBytes = 2;
    }
    encodedRows.push(encoded);
    encodedBytes += (encodedRows.length === 1 ? 0 : 1) + rowBytes;
  }

  if (encodedRows.length > 0) yield `[${encodedRows.join(",")}]`;
}

function containsPattern(value: string): string {
  let bytes = 0;
  let bounded = "";
  for (const character of value) {
    const characterBytes = UTF8_ENCODER.encode(character).byteLength;
    if (bytes + characterBytes > D1_LIKE_QUERY_BYTES) break;
    bounded += character;
    bytes += characterBytes;
  }
  return `%${bounded}%`;
}

function positiveInteger(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.floor(value);
}

function positiveTimestamp(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ProviderError({
      code: "invalid_response",
      message: "The Bazaar source timestamp cannot be aggregated safely.",
      status: 502,
      action: "Keep the current durable history and wait for a valid snapshot.",
      retryable: true,
    });
  }
  return value;
}

function bucketStart(timestamp: number, durationMs: number): number {
  return Math.floor(timestamp / durationMs) * durationMs;
}

function integerOrNull(value: number | null): number | null {
  return value === null || !Number.isFinite(value)
    ? null
    : Math.max(0, Math.floor(value));
}

function timestampOrNull(value: number | null): number | null {
  return value === null || !Number.isSafeInteger(value) || value <= 0
    ? null
    : value;
}

function boundedHttpStatus(value: number): number {
  return Number.isInteger(value) && value >= 100 && value <= 599 ? value : 503;
}

function expiredLeaseError(): ProviderError {
  return new ProviderError({
    code: "upstream_unavailable",
    message: "The economy worker lease expired before history aggregation.",
    status: 503,
    action: "Let the elected worker retry the idempotent aggregation.",
    retryable: true,
  });
}

function oversizedJsonRowError(): ProviderError {
  return new ProviderError({
    code: "invalid_response",
    message: "A normalized public-economy row exceeds the durable write bound.",
    status: 502,
    action: "Keep the current durable snapshot and wait for a bounded refresh.",
    retryable: true,
  });
}
