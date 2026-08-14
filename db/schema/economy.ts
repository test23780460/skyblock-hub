import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createdAt, jsonText, timestampMs, updatedAt, type JsonObject } from "./helpers";

export const items = sqliteTable(
  "items",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull(),
    rarity: text("rarity"),
    category: text("category"),
    npcSellPrice: real("npc_sell_price"),
    isTradeable: integer("is_tradeable", { mode: "boolean" }).notNull().default(true),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    metadata: jsonText<JsonObject>("metadata"),
    sourceVersion: text("source_version"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("items_name_idx").on(table.nameNormalized),
    index("items_category_rarity_idx").on(table.category, table.rarity),
    index("items_active_idx").on(table.isActive),
    check(
      "items_npc_sell_price_check",
      sql`${table.npcSellPrice} is null or ${table.npcSellPrice} >= 0`,
    ),
  ],
);

export const bazaarProducts = sqliteTable(
  "bazaar_products",
  {
    productId: text("product_id").primaryKey(),
    itemId: text("item_id").references(() => items.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    displayName: text("display_name"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    firstSeenAt: createdAt("first_seen_at"),
    lastSeenAt: timestampMs("last_seen_at").notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("bazaar_products_item_uidx").on(table.itemId),
    index("bazaar_products_active_idx").on(table.isActive),
    index("bazaar_products_last_seen_idx").on(table.lastSeenAt),
  ],
);

export const bazaarSnapshots = sqliteTable(
  "bazaar_snapshots",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => bazaarProducts.productId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    capturedAt: timestampMs("captured_at").notNull(),
    sourceUpdatedAt: timestampMs("source_updated_at"),
    instantBuyPrice: real("instant_buy_price").notNull(),
    instantSellPrice: real("instant_sell_price").notNull(),
    buyVolume: integer("buy_volume").notNull().default(0),
    sellVolume: integer("sell_volume").notNull().default(0),
    buyOrders: integer("buy_orders").notNull().default(0),
    sellOrders: integer("sell_orders").notNull().default(0),
    buyMovingWeek: integer("buy_moving_week").notNull().default(0),
    sellMovingWeek: integer("sell_moving_week").notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("bazaar_snapshots_product_time_uidx").on(table.productId, table.capturedAt),
    index("bazaar_snapshots_captured_idx").on(table.capturedAt),
    check(
      "bazaar_snapshots_prices_check",
      sql`${table.instantBuyPrice} >= 0 and ${table.instantSellPrice} >= 0`,
    ),
    check(
      "bazaar_snapshots_counts_check",
      sql`${table.buyVolume} >= 0 and ${table.sellVolume} >= 0 and ${table.buyOrders} >= 0 and ${table.sellOrders} >= 0 and ${table.buyMovingWeek} >= 0 and ${table.sellMovingWeek} >= 0`,
    ),
  ],
);

export const bazaarAggregates = sqliteTable(
  "bazaar_aggregates",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => bazaarProducts.productId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    resolution: text("resolution", { enum: ["hour", "day"] }).notNull(),
    bucketStartAt: timestampMs("bucket_start_at").notNull(),
    sampleCount: integer("sample_count").notNull(),
    buyOpen: real("buy_open").notNull(),
    buyHigh: real("buy_high").notNull(),
    buyLow: real("buy_low").notNull(),
    buyClose: real("buy_close").notNull(),
    sellOpen: real("sell_open").notNull(),
    sellHigh: real("sell_high").notNull(),
    sellLow: real("sell_low").notNull(),
    sellClose: real("sell_close").notNull(),
    averageBuyVolume: real("average_buy_volume").notNull().default(0),
    averageSellVolume: real("average_sell_volume").notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("bazaar_aggregates_bucket_uidx").on(
      table.productId,
      table.resolution,
      table.bucketStartAt,
    ),
    index("bazaar_aggregates_resolution_time_idx").on(table.resolution, table.bucketStartAt),
    check("bazaar_aggregates_resolution_check", sql`${table.resolution} in ('hour', 'day')`),
    check("bazaar_aggregates_samples_check", sql`${table.sampleCount} > 0`),
    check(
      "bazaar_aggregates_values_check",
      sql`${table.buyOpen} >= 0 and ${table.buyHigh} >= 0 and ${table.buyLow} >= 0 and ${table.buyClose} >= 0 and ${table.sellOpen} >= 0 and ${table.sellHigh} >= 0 and ${table.sellLow} >= 0 and ${table.sellClose} >= 0 and ${table.averageBuyVolume} >= 0 and ${table.averageSellVolume} >= 0`,
    ),
  ],
);

export const auctionListings = sqliteTable(
  "auction_listings",
  {
    auctionUuid: text("auction_uuid").primaryKey(),
    itemId: text("item_id").references(() => items.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    itemVariantKey: text("item_variant_key").notNull().default("base"),
    sellerMinecraftUuid: text("seller_minecraft_uuid"),
    isBin: integer("is_bin", { mode: "boolean" }).notNull().default(false),
    isClaimed: integer("is_claimed", { mode: "boolean" }).notNull().default(false),
    startingBid: integer("starting_bid").notNull(),
    highestBid: integer("highest_bid").notNull().default(0),
    startsAt: timestampMs("starts_at").notNull(),
    endsAt: timestampMs("ends_at").notNull(),
    fetchedAt: timestampMs("fetched_at").notNull(),
    itemData: jsonText<JsonObject>("item_data"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("auction_listings_item_bin_price_idx").on(
      table.itemId,
      table.isBin,
      table.startingBid,
    ),
    index("auction_listings_ends_idx").on(table.endsAt),
    index("auction_listings_fetched_idx").on(table.fetchedAt),
    check(
      "auction_listings_prices_check",
      sql`${table.startingBid} >= 0 and ${table.highestBid} >= 0`,
    ),
    check("auction_listings_time_check", sql`${table.endsAt} >= ${table.startsAt}`),
  ],
);

export const auctionSales = sqliteTable(
  "auction_sales",
  {
    id: text("id").primaryKey(),
    auctionUuid: text("auction_uuid").notNull(),
    itemId: text("item_id").references(() => items.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    itemVariantKey: text("item_variant_key").notNull().default("base"),
    soldPrice: integer("sold_price").notNull(),
    isBin: integer("is_bin", { mode: "boolean" }).notNull().default(false),
    soldAt: timestampMs("sold_at").notNull(),
    saleData: jsonText<JsonObject>("sale_data"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("auction_sales_auction_uidx").on(table.auctionUuid),
    index("auction_sales_item_variant_time_idx").on(
      table.itemId,
      table.itemVariantKey,
      table.soldAt,
    ),
    index("auction_sales_sold_at_idx").on(table.soldAt),
    check("auction_sales_price_check", sql`${table.soldPrice} >= 0`),
  ],
);

export const itemValuations = sqliteTable(
  "item_valuations",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade", onUpdate: "cascade" }),
    itemVariantKey: text("item_variant_key").notNull().default("base"),
    estimatedValue: integer("estimated_value").notNull(),
    confidence: text("confidence", { enum: ["low", "medium", "high"] }).notNull(),
    sampleCount: integer("sample_count").notNull().default(0),
    methodologyVersion: text("methodology_version").notNull(),
    factors: jsonText<JsonObject>("factors"),
    valuedAt: timestampMs("valued_at").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("item_valuations_version_time_uidx").on(
      table.itemId,
      table.itemVariantKey,
      table.methodologyVersion,
      table.valuedAt,
    ),
    index("item_valuations_latest_idx").on(table.itemId, table.itemVariantKey, table.valuedAt),
    check(
      "item_valuations_confidence_check",
      sql`${table.confidence} in ('low', 'medium', 'high')`,
    ),
    check(
      "item_valuations_values_check",
      sql`${table.estimatedValue} >= 0 and ${table.sampleCount} >= 0`,
    ),
  ],
);

/**
 * One durable lease and circuit breaker coordinates every public Hypixel
 * economy feed. Web requests never acquire this lease or call Hypixel.
 */
export const publicEconomyWorkerState = sqliteTable(
  "public_economy_worker_state",
  {
    provider: text("provider").primaryKey(),
    leaseOwner: text("lease_owner"),
    leaseUntil: timestampMs("lease_until"),
    leaseToken: integer("lease_token").notNull().default(0),
    backoffUntil: timestampMs("backoff_until"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    lastAttemptAt: timestampMs("last_attempt_at"),
    lastSuccessAt: timestampMs("last_success_at"),
    lastFailureAt: timestampMs("last_failure_at"),
    lastErrorCode: text("last_error_code"),
    lastErrorStatus: integer("last_error_status"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("public_economy_worker_backoff_idx").on(table.backoffUntil),
    index("public_economy_worker_lease_idx").on(table.leaseUntil),
    check(
      "public_economy_worker_failures_check",
      sql`${table.consecutiveFailures} >= 0`,
    ),
    check("public_economy_worker_token_check", sql`${table.leaseToken} >= 0`),
    check(
      "public_economy_worker_error_status_check",
      sql`${table.lastErrorStatus} is null or (${table.lastErrorStatus} >= 100 and ${table.lastErrorStatus} <= 599)`,
    ),
    check(
      "public_economy_worker_lease_check",
      sql`(${table.leaseOwner} is null and ${table.leaseUntil} is null) or (${table.leaseOwner} is not null and ${table.leaseUntil} is not null)`,
    ),
  ],
);

/** Publication marker for versioned snapshot rows. */
export const publicEconomyFeedState = sqliteTable(
  "public_economy_feed_state",
  {
    feed: text("feed", {
      enum: ["bazaar", "active-auctions", "ended-auctions"],
    }).primaryKey(),
    sourceUpdatedAt: timestampMs("source_updated_at").notNull(),
    publishedAt: timestampMs("published_at").notNull(),
    expiresAt: timestampMs("expires_at").notNull(),
    recordCount: integer("record_count").notNull().default(0),
    skippedMalformed: integer("skipped_malformed").notNull().default(0),
    publishedLeaseToken: integer("published_lease_token").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("public_economy_feed_expiry_idx").on(table.expiresAt),
    check(
      "public_economy_feed_name_check",
      sql`${table.feed} in ('bazaar', 'active-auctions', 'ended-auctions')`,
    ),
    check(
      "public_economy_feed_counts_check",
      sql`${table.recordCount} >= 0 and ${table.skippedMalformed} >= 0 and ${table.publishedLeaseToken} > 0`,
    ),
    check(
      "public_economy_feed_expiry_check",
      sql`${table.expiresAt} >= ${table.publishedAt}`,
    ),
  ],
);

/** Latest normalized Bazaar version; no order books or raw provider objects. */
export const publicBazaarSnapshotRows = sqliteTable(
  "public_bazaar_snapshot_rows",
  {
    sourceUpdatedAt: timestampMs("source_updated_at").notNull(),
    productId: text("product_id").notNull(),
    capturedAt: timestampMs("captured_at").notNull(),
    buyPrice: real("buy_price"),
    sellPrice: real("sell_price"),
    buyVolume: integer("buy_volume"),
    sellVolume: integer("sell_volume"),
    buyMovingWeek: integer("buy_moving_week"),
    sellMovingWeek: integer("sell_moving_week"),
    buyOrders: integer("buy_orders"),
    sellOrders: integer("sell_orders"),
    spread: real("spread"),
    spreadPercent: real("spread_percent"),
  },
  (table) => [
    primaryKey({ columns: [table.sourceUpdatedAt, table.productId] }),
    index("public_bazaar_version_product_idx").on(
      table.sourceUpdatedAt,
      table.productId,
    ),
    check(
      "public_bazaar_values_check",
      sql`(${table.buyPrice} is null or ${table.buyPrice} >= 0) and (${table.sellPrice} is null or ${table.sellPrice} >= 0) and (${table.buyVolume} is null or ${table.buyVolume} >= 0) and (${table.sellVolume} is null or ${table.sellVolume} >= 0) and (${table.buyOrders} is null or ${table.buyOrders} >= 0) and (${table.sellOrders} is null or ${table.sellOrders} >= 0)`,
    ),
  ],
);

/**
 * Bounded OHLC history derived only from normalized Bazaar summaries.
 * Product IDs are the provider's canonical Bazaar identity; Bazaar has no
 * item-variant payload that can be normalized safely without NBT.
 */
export const publicBazaarHistoryBuckets = sqliteTable(
  "public_bazaar_history_buckets",
  {
    productId: text("product_id").notNull(),
    resolution: text("resolution", { enum: ["hour", "day"] }).notNull(),
    bucketStartAt: timestampMs("bucket_start_at").notNull(),
    firstSourceUpdatedAt: timestampMs("first_source_updated_at").notNull(),
    lastSourceUpdatedAt: timestampMs("last_source_updated_at").notNull(),
    sampleCount: integer("sample_count").notNull(),
    buyOpen: real("buy_open").notNull(),
    buyHigh: real("buy_high").notNull(),
    buyLow: real("buy_low").notNull(),
    buyClose: real("buy_close").notNull(),
    sellOpen: real("sell_open").notNull(),
    sellHigh: real("sell_high").notNull(),
    sellLow: real("sell_low").notNull(),
    sellClose: real("sell_close").notNull(),
    buyVolumeSum: real("buy_volume_sum").notNull().default(0),
    buyVolumeSamples: integer("buy_volume_samples").notNull().default(0),
    sellVolumeSum: real("sell_volume_sum").notNull().default(0),
    sellVolumeSamples: integer("sell_volume_samples").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({
      columns: [table.productId, table.resolution, table.bucketStartAt],
    }),
    index("public_bazaar_history_retention_idx").on(
      table.resolution,
      table.bucketStartAt,
    ),
    check(
      "public_bazaar_history_resolution_check",
      sql`${table.resolution} in ('hour', 'day')`,
    ),
    check(
      "public_bazaar_history_samples_check",
      sql`${table.sampleCount} > 0 and ${table.buyVolumeSamples} >= 0 and ${table.buyVolumeSamples} <= ${table.sampleCount} and ${table.sellVolumeSamples} >= 0 and ${table.sellVolumeSamples} <= ${table.sampleCount}`,
    ),
    check(
      "public_bazaar_history_source_order_check",
      sql`${table.lastSourceUpdatedAt} >= ${table.firstSourceUpdatedAt}`,
    ),
    check(
      "public_bazaar_history_buy_ohlc_check",
      sql`${table.buyOpen} >= 0 and ${table.buyClose} >= 0 and ${table.buyLow} >= 0 and ${table.buyHigh} >= ${table.buyOpen} and ${table.buyHigh} >= ${table.buyClose} and ${table.buyLow} <= ${table.buyOpen} and ${table.buyLow} <= ${table.buyClose}`,
    ),
    check(
      "public_bazaar_history_sell_ohlc_check",
      sql`${table.sellOpen} >= 0 and ${table.sellClose} >= 0 and ${table.sellLow} >= 0 and ${table.sellHigh} >= ${table.sellOpen} and ${table.sellHigh} >= ${table.sellClose} and ${table.sellLow} <= ${table.sellOpen} and ${table.sellLow} <= ${table.sellClose}`,
    ),
    check(
      "public_bazaar_history_volume_check",
      sql`${table.buyVolumeSum} >= 0 and ${table.sellVolumeSum} >= 0`,
    ),
  ],
);

/** Current normalized active listings. Identity, lore, NBT and raw bids are absent. */
export const publicActiveAuctionSnapshotRows = sqliteTable(
  "public_active_auction_snapshot_rows",
  {
    sourceUpdatedAt: timestampMs("source_updated_at").notNull(),
    auctionUuid: text("auction_uuid").notNull(),
    capturedAt: timestampMs("captured_at").notNull(),
    itemName: text("item_name").notNull(),
    itemNameNormalized: text("item_name_normalized").notNull(),
    category: text("category"),
    tier: text("tier"),
    startingBid: integer("starting_bid"),
    highestBidAmount: integer("highest_bid_amount"),
    isBin: integer("is_bin", { mode: "boolean" }),
    startsAt: timestampMs("starts_at"),
    endsAt: timestampMs("ends_at"),
    bidCount: integer("bid_count").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.sourceUpdatedAt, table.auctionUuid] }),
    index("public_active_auction_version_end_idx").on(
      table.sourceUpdatedAt,
      table.endsAt,
    ),
    index("public_active_auction_version_name_idx").on(
      table.sourceUpdatedAt,
      table.itemNameNormalized,
    ),
    check(
      "public_active_auction_values_check",
      sql`(${table.startingBid} is null or ${table.startingBid} >= 0) and (${table.highestBidAmount} is null or ${table.highestBidAmount} >= 0) and ${table.bidCount} >= 0`,
    ),
    check(
      "public_active_auction_time_check",
      sql`${table.startsAt} is null or ${table.endsAt} is null or ${table.endsAt} >= ${table.startsAt}`,
    ),
  ],
);

/** Minimal, deduplicated ended-sale facts retained for bounded price research. */
export const publicEndedAuctionSales = sqliteTable(
  "public_ended_auction_sales",
  {
    auctionUuid: text("auction_uuid").primaryKey(),
    sourceUpdatedAt: timestampMs("source_updated_at").notNull(),
    capturedAt: timestampMs("captured_at").notNull(),
    endedAt: timestampMs("ended_at"),
    price: integer("price"),
    isBin: integer("is_bin", { mode: "boolean" }),
  },
  (table) => [
    index("public_ended_auction_source_idx").on(table.sourceUpdatedAt),
    index("public_ended_auction_ended_idx").on(table.endedAt),
    check(
      "public_ended_auction_price_check",
      sql`${table.price} is null or ${table.price} >= 0`,
    ),
  ],
);
