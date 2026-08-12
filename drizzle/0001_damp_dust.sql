CREATE TABLE `public_active_auction_snapshot_rows` (
	`source_updated_at` integer NOT NULL,
	`auction_uuid` text NOT NULL,
	`captured_at` integer NOT NULL,
	`item_name` text NOT NULL,
	`item_name_normalized` text NOT NULL,
	`category` text,
	`tier` text,
	`starting_bid` integer,
	`highest_bid_amount` integer,
	`is_bin` integer,
	`starts_at` integer,
	`ends_at` integer,
	`bid_count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`source_updated_at`, `auction_uuid`),
	CONSTRAINT "public_active_auction_values_check" CHECK(("public_active_auction_snapshot_rows"."starting_bid" is null or "public_active_auction_snapshot_rows"."starting_bid" >= 0) and ("public_active_auction_snapshot_rows"."highest_bid_amount" is null or "public_active_auction_snapshot_rows"."highest_bid_amount" >= 0) and "public_active_auction_snapshot_rows"."bid_count" >= 0),
	CONSTRAINT "public_active_auction_time_check" CHECK("public_active_auction_snapshot_rows"."starts_at" is null or "public_active_auction_snapshot_rows"."ends_at" is null or "public_active_auction_snapshot_rows"."ends_at" >= "public_active_auction_snapshot_rows"."starts_at")
);
--> statement-breakpoint
CREATE INDEX `public_active_auction_version_end_idx` ON `public_active_auction_snapshot_rows` (`source_updated_at`,`ends_at`);--> statement-breakpoint
CREATE INDEX `public_active_auction_version_name_idx` ON `public_active_auction_snapshot_rows` (`source_updated_at`,`item_name_normalized`);--> statement-breakpoint
CREATE TABLE `public_bazaar_snapshot_rows` (
	`source_updated_at` integer NOT NULL,
	`product_id` text NOT NULL,
	`captured_at` integer NOT NULL,
	`buy_price` real,
	`sell_price` real,
	`buy_volume` integer,
	`sell_volume` integer,
	`buy_moving_week` integer,
	`sell_moving_week` integer,
	`buy_orders` integer,
	`sell_orders` integer,
	`spread` real,
	`spread_percent` real,
	PRIMARY KEY(`source_updated_at`, `product_id`),
	CONSTRAINT "public_bazaar_values_check" CHECK(("public_bazaar_snapshot_rows"."buy_price" is null or "public_bazaar_snapshot_rows"."buy_price" >= 0) and ("public_bazaar_snapshot_rows"."sell_price" is null or "public_bazaar_snapshot_rows"."sell_price" >= 0) and ("public_bazaar_snapshot_rows"."buy_volume" is null or "public_bazaar_snapshot_rows"."buy_volume" >= 0) and ("public_bazaar_snapshot_rows"."sell_volume" is null or "public_bazaar_snapshot_rows"."sell_volume" >= 0) and ("public_bazaar_snapshot_rows"."buy_orders" is null or "public_bazaar_snapshot_rows"."buy_orders" >= 0) and ("public_bazaar_snapshot_rows"."sell_orders" is null or "public_bazaar_snapshot_rows"."sell_orders" >= 0))
);
--> statement-breakpoint
CREATE INDEX `public_bazaar_version_product_idx` ON `public_bazaar_snapshot_rows` (`source_updated_at`,`product_id`);--> statement-breakpoint
CREATE TABLE `public_economy_feed_state` (
	`feed` text PRIMARY KEY NOT NULL,
	`source_updated_at` integer NOT NULL,
	`published_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`record_count` integer DEFAULT 0 NOT NULL,
	`skipped_malformed` integer DEFAULT 0 NOT NULL,
	`published_lease_token` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "public_economy_feed_name_check" CHECK("public_economy_feed_state"."feed" in ('bazaar', 'active-auctions', 'ended-auctions')),
	CONSTRAINT "public_economy_feed_counts_check" CHECK("public_economy_feed_state"."record_count" >= 0 and "public_economy_feed_state"."skipped_malformed" >= 0 and "public_economy_feed_state"."published_lease_token" > 0),
	CONSTRAINT "public_economy_feed_expiry_check" CHECK("public_economy_feed_state"."expires_at" >= "public_economy_feed_state"."published_at")
);
--> statement-breakpoint
CREATE INDEX `public_economy_feed_expiry_idx` ON `public_economy_feed_state` (`expires_at`);--> statement-breakpoint
CREATE TABLE `public_economy_worker_state` (
	`provider` text PRIMARY KEY NOT NULL,
	`lease_owner` text,
	`lease_until` integer,
	`lease_token` integer DEFAULT 0 NOT NULL,
	`backoff_until` integer,
	`consecutive_failures` integer DEFAULT 0 NOT NULL,
	`last_attempt_at` integer,
	`last_success_at` integer,
	`last_failure_at` integer,
	`last_error_code` text,
	`last_error_status` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "public_economy_worker_failures_check" CHECK("public_economy_worker_state"."consecutive_failures" >= 0),
	CONSTRAINT "public_economy_worker_token_check" CHECK("public_economy_worker_state"."lease_token" >= 0),
	CONSTRAINT "public_economy_worker_error_status_check" CHECK("public_economy_worker_state"."last_error_status" is null or ("public_economy_worker_state"."last_error_status" >= 100 and "public_economy_worker_state"."last_error_status" <= 599)),
	CONSTRAINT "public_economy_worker_lease_check" CHECK(("public_economy_worker_state"."lease_owner" is null and "public_economy_worker_state"."lease_until" is null) or ("public_economy_worker_state"."lease_owner" is not null and "public_economy_worker_state"."lease_until" is not null))
);
--> statement-breakpoint
CREATE INDEX `public_economy_worker_backoff_idx` ON `public_economy_worker_state` (`backoff_until`);--> statement-breakpoint
CREATE INDEX `public_economy_worker_lease_idx` ON `public_economy_worker_state` (`lease_until`);--> statement-breakpoint
CREATE TABLE `public_ended_auction_sales` (
	`auction_uuid` text PRIMARY KEY NOT NULL,
	`source_updated_at` integer NOT NULL,
	`captured_at` integer NOT NULL,
	`ended_at` integer,
	`price` integer,
	`is_bin` integer,
	CONSTRAINT "public_ended_auction_price_check" CHECK("public_ended_auction_sales"."price" is null or "public_ended_auction_sales"."price" >= 0)
);
--> statement-breakpoint
CREATE INDEX `public_ended_auction_source_idx` ON `public_ended_auction_sales` (`source_updated_at`);--> statement-breakpoint
CREATE INDEX `public_ended_auction_ended_idx` ON `public_ended_auction_sales` (`ended_at`);