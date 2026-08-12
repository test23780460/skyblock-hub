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
  ne,
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
const DEFAULT_WRITE_CHUNK_SIZE = 30;

type StoreOptions = {
  now?: () => Date;
  endedAuctionRetentionMs?: number;
  bazaarHourlyHistoryRetentionMs?: number;
  bazaarDailyHistoryRetentionMs?: number;
  writeChunkSize?: number;
};

export class DrizzlePublicEconomySnapshotStore
  implements PublicEconomySnapshotStore
{
  private readonly now: () => Date;
  private readonly endedAuctionRetentionMs: number;
  private readonly bazaarHourlyHistoryRetentionMs: number;
  private readonly bazaarDailyHistoryRetentionMs: number;
  private readonly writeChunkSize: number;

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
    this.writeChunkSize = Math.min(
      50,
      positiveInteger(options.writeChunkSize ?? DEFAULT_WRITE_CHUNK_SIZE),
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
    const rows = products.map((product) => ({
      sourceUpdatedAt,
      productId: product.productId,
      capturedAt,
      buyPrice: product.buyPrice,
      sellPrice: product.sellPrice,
      buyVolume: integerOrNull(product.buyVolume),
      sellVolume: integerOrNull(product.sellVolume),
      buyMovingWeek: integerOrNull(product.buyMovingWeek),
      sellMovingWeek: integerOrNull(product.sellMovingWeek),
      buyOrders: integerOrNull(product.buyOrders),
      sellOrders: integerOrNull(product.sellOrders),
      spread: product.spread,
      spreadPercent: product.spreadPercent,
    }));

    for (const chunk of chunks(rows, this.writeChunkSize)) {
      await this.db
        .insert(publicBazaarSnapshotRows)
        .values(chunk)
        .onConflictDoNothing();
    }

    await this.publishFeed({
      feed: "bazaar",
      sourceUpdatedAt,
      publishedAt: capturedAt,
      expiresAt: new Date(capturedAt.getTime() + BAZAAR_FRESH_MS),
      recordCount: rows.length,
      skippedMalformed: snapshot.skippedProducts,
    }, lease);
    await this.db
      .delete(publicBazaarSnapshotRows)
      .where(ne(publicBazaarSnapshotRows.sourceUpdatedAt, sourceUpdatedAt));
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
    const rows = auctions.map((auction) => ({
      sourceUpdatedAt,
      auctionUuid: auction.id,
      capturedAt,
      itemName: auction.itemName,
      itemNameNormalized: auction.itemName.toLowerCase(),
      category: auction.category,
      tier: auction.tier,
      startingBid: integerOrNull(auction.startingBid),
      highestBidAmount: integerOrNull(auction.highestBidAmount),
      isBin: auction.bin,
      startsAt: dateOrNull(auction.startAt),
      endsAt: dateOrNull(auction.endAt),
      bidCount: Math.max(0, Math.floor(auction.bidCount)),
    }));

    for (const chunk of chunks(rows, this.writeChunkSize)) {
      await this.db
        .insert(publicActiveAuctionSnapshotRows)
        .values(chunk)
        .onConflictDoNothing();
    }

    await this.publishFeed({
      feed: "active-auctions",
      sourceUpdatedAt,
      publishedAt: capturedAt,
      expiresAt: new Date(capturedAt.getTime() + ACTIVE_AUCTION_FRESH_MS),
      recordCount: rows.length,
      skippedMalformed: snapshot.skippedAuctions ?? 0,
    }, lease);
    await this.db
      .delete(publicActiveAuctionSnapshotRows)
      .where(ne(publicActiveAuctionSnapshotRows.sourceUpdatedAt, sourceUpdatedAt));
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
    const rows = usable.map((auction) => ({
      auctionUuid: auction.id,
      sourceUpdatedAt,
      capturedAt,
      endedAt: dateOrNull(auction.endedAt),
      price: integerOrNull(auction.price),
      isBin: auction.bin,
    }));

    for (const chunk of chunks(rows, this.writeChunkSize)) {
      await this.db
        .insert(publicEndedAuctionSales)
        .values(chunk)
        .onConflictDoNothing({ target: publicEndedAuctionSales.auctionUuid });
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
    const state = await this.getFeedState("bazaar");
    if (!state) return null;
    const condition = input.query
      ? and(
          eq(publicBazaarSnapshotRows.sourceUpdatedAt, state.sourceUpdatedAt),
          like(
            publicBazaarSnapshotRows.productId,
            `%${input.query.toUpperCase()}%`,
          ),
        )
      : eq(publicBazaarSnapshotRows.sourceUpdatedAt, state.sourceUpdatedAt);
    const products = await this.db
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
      .where(condition)
      .orderBy(asc(publicBazaarSnapshotRows.productId))
      .limit(input.limit);
    return { state, products };
  }

  async readBazaarHistory(input: {
    productId: string;
    resolution: BazaarHistoryResolution;
    limit: number;
  }) {
    const state = await this.getFeedState("bazaar");
    if (!state) return null;
    const rows = await this.db
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
    return {
      state,
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
    const state = await this.getFeedState("active-auctions");
    if (!state) return null;
    const condition = input.query
      ? and(
          eq(
            publicActiveAuctionSnapshotRows.sourceUpdatedAt,
            state.sourceUpdatedAt,
          ),
          like(
            publicActiveAuctionSnapshotRows.itemNameNormalized,
            `%${input.query}%`,
          ),
        )
      : eq(
          publicActiveAuctionSnapshotRows.sourceUpdatedAt,
          state.sourceUpdatedAt,
        );
    const [matching] = await this.db
      .select({ value: count() })
      .from(publicActiveAuctionSnapshotRows)
      .where(condition);
    const rows = await this.db
      .select()
      .from(publicActiveAuctionSnapshotRows)
      .where(condition)
      .orderBy(
        asc(publicActiveAuctionSnapshotRows.endsAt),
        asc(publicActiveAuctionSnapshotRows.auctionUuid),
      )
      .limit(input.limit)
      .offset(input.page * input.limit);
    return {
      state,
      matchingAuctions: matching?.value ?? 0,
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

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
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

function dateOrNull(value: number | null): Date | null {
  return value === null ? null : new Date(value);
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
