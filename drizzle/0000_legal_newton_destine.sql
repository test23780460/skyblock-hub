CREATE TABLE `auction_listings` (
	`auction_uuid` text PRIMARY KEY NOT NULL,
	`item_id` text,
	`item_variant_key` text DEFAULT 'base' NOT NULL,
	`seller_minecraft_uuid` text,
	`is_bin` integer DEFAULT false NOT NULL,
	`is_claimed` integer DEFAULT false NOT NULL,
	`starting_bid` integer NOT NULL,
	`highest_bid` integer DEFAULT 0 NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`fetched_at` integer NOT NULL,
	`item_data` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "auction_listings_prices_check" CHECK("auction_listings"."starting_bid" >= 0 and "auction_listings"."highest_bid" >= 0),
	CONSTRAINT "auction_listings_time_check" CHECK("auction_listings"."ends_at" >= "auction_listings"."starts_at")
);
--> statement-breakpoint
CREATE INDEX `auction_listings_item_bin_price_idx` ON `auction_listings` (`item_id`,`is_bin`,`starting_bid`);--> statement-breakpoint
CREATE INDEX `auction_listings_ends_idx` ON `auction_listings` (`ends_at`);--> statement-breakpoint
CREATE INDEX `auction_listings_fetched_idx` ON `auction_listings` (`fetched_at`);--> statement-breakpoint
CREATE TABLE `auction_sales` (
	`id` text PRIMARY KEY NOT NULL,
	`auction_uuid` text NOT NULL,
	`item_id` text,
	`item_variant_key` text DEFAULT 'base' NOT NULL,
	`sold_price` integer NOT NULL,
	`is_bin` integer DEFAULT false NOT NULL,
	`sold_at` integer NOT NULL,
	`sale_data` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "auction_sales_price_check" CHECK("auction_sales"."sold_price" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auction_sales_auction_uidx` ON `auction_sales` (`auction_uuid`);--> statement-breakpoint
CREATE INDEX `auction_sales_item_variant_time_idx` ON `auction_sales` (`item_id`,`item_variant_key`,`sold_at`);--> statement-breakpoint
CREATE INDEX `auction_sales_sold_at_idx` ON `auction_sales` (`sold_at`);--> statement-breakpoint
CREATE TABLE `bazaar_aggregates` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`resolution` text NOT NULL,
	`bucket_start_at` integer NOT NULL,
	`sample_count` integer NOT NULL,
	`buy_open` real NOT NULL,
	`buy_high` real NOT NULL,
	`buy_low` real NOT NULL,
	`buy_close` real NOT NULL,
	`sell_open` real NOT NULL,
	`sell_high` real NOT NULL,
	`sell_low` real NOT NULL,
	`sell_close` real NOT NULL,
	`average_buy_volume` real DEFAULT 0 NOT NULL,
	`average_sell_volume` real DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `bazaar_products`(`product_id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "bazaar_aggregates_resolution_check" CHECK("bazaar_aggregates"."resolution" in ('hour', 'day')),
	CONSTRAINT "bazaar_aggregates_samples_check" CHECK("bazaar_aggregates"."sample_count" > 0),
	CONSTRAINT "bazaar_aggregates_values_check" CHECK("bazaar_aggregates"."buy_open" >= 0 and "bazaar_aggregates"."buy_high" >= 0 and "bazaar_aggregates"."buy_low" >= 0 and "bazaar_aggregates"."buy_close" >= 0 and "bazaar_aggregates"."sell_open" >= 0 and "bazaar_aggregates"."sell_high" >= 0 and "bazaar_aggregates"."sell_low" >= 0 and "bazaar_aggregates"."sell_close" >= 0 and "bazaar_aggregates"."average_buy_volume" >= 0 and "bazaar_aggregates"."average_sell_volume" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bazaar_aggregates_bucket_uidx` ON `bazaar_aggregates` (`product_id`,`resolution`,`bucket_start_at`);--> statement-breakpoint
CREATE INDEX `bazaar_aggregates_resolution_time_idx` ON `bazaar_aggregates` (`resolution`,`bucket_start_at`);--> statement-breakpoint
CREATE TABLE `bazaar_products` (
	`product_id` text PRIMARY KEY NOT NULL,
	`item_id` text,
	`display_name` text,
	`is_active` integer DEFAULT true NOT NULL,
	`first_seen_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_seen_at` integer NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bazaar_products_item_uidx` ON `bazaar_products` (`item_id`);--> statement-breakpoint
CREATE INDEX `bazaar_products_active_idx` ON `bazaar_products` (`is_active`);--> statement-breakpoint
CREATE INDEX `bazaar_products_last_seen_idx` ON `bazaar_products` (`last_seen_at`);--> statement-breakpoint
CREATE TABLE `bazaar_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`captured_at` integer NOT NULL,
	`source_updated_at` integer,
	`instant_buy_price` real NOT NULL,
	`instant_sell_price` real NOT NULL,
	`buy_volume` integer DEFAULT 0 NOT NULL,
	`sell_volume` integer DEFAULT 0 NOT NULL,
	`buy_orders` integer DEFAULT 0 NOT NULL,
	`sell_orders` integer DEFAULT 0 NOT NULL,
	`buy_moving_week` integer DEFAULT 0 NOT NULL,
	`sell_moving_week` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `bazaar_products`(`product_id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "bazaar_snapshots_prices_check" CHECK("bazaar_snapshots"."instant_buy_price" >= 0 and "bazaar_snapshots"."instant_sell_price" >= 0),
	CONSTRAINT "bazaar_snapshots_counts_check" CHECK("bazaar_snapshots"."buy_volume" >= 0 and "bazaar_snapshots"."sell_volume" >= 0 and "bazaar_snapshots"."buy_orders" >= 0 and "bazaar_snapshots"."sell_orders" >= 0 and "bazaar_snapshots"."buy_moving_week" >= 0 and "bazaar_snapshots"."sell_moving_week" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bazaar_snapshots_product_time_uidx` ON `bazaar_snapshots` (`product_id`,`captured_at`);--> statement-breakpoint
CREATE INDEX `bazaar_snapshots_captured_idx` ON `bazaar_snapshots` (`captured_at`);--> statement-breakpoint
CREATE TABLE `item_valuations` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`item_variant_key` text DEFAULT 'base' NOT NULL,
	`estimated_value` integer NOT NULL,
	`confidence` text NOT NULL,
	`sample_count` integer DEFAULT 0 NOT NULL,
	`methodology_version` text NOT NULL,
	`factors` text,
	`valued_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "item_valuations_confidence_check" CHECK("item_valuations"."confidence" in ('low', 'medium', 'high')),
	CONSTRAINT "item_valuations_values_check" CHECK("item_valuations"."estimated_value" >= 0 and "item_valuations"."sample_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_valuations_version_time_uidx` ON `item_valuations` (`item_id`,`item_variant_key`,`methodology_version`,`valued_at`);--> statement-breakpoint
CREATE INDEX `item_valuations_latest_idx` ON `item_valuations` (`item_id`,`item_variant_key`,`valued_at`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_normalized` text NOT NULL,
	`rarity` text,
	`category` text,
	`npc_sell_price` real,
	`is_tradeable` integer DEFAULT true NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`metadata` text,
	`source_version` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "items_npc_sell_price_check" CHECK("items"."npc_sell_price" is null or "items"."npc_sell_price" >= 0)
);
--> statement-breakpoint
CREATE INDEX `items_name_idx` ON `items` (`name_normalized`);--> statement-breakpoint
CREATE INDEX `items_category_rarity_idx` ON `items` (`category`,`rarity`);--> statement-breakpoint
CREATE INDEX `items_active_idx` ON `items` (`is_active`);--> statement-breakpoint
CREATE TABLE `external_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_subject` text NOT NULL,
	`email_normalized` text,
	`provider_data` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_login_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `external_identities_provider_subject_uidx` ON `external_identities` (`provider`,`provider_subject`);--> statement-breakpoint
CREATE INDEX `external_identities_user_idx` ON `external_identities` (`user_id`);--> statement-breakpoint
CREATE INDEX `external_identities_email_idx` ON `external_identities` (`email_normalized`);--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`namespace` text DEFAULT 'site' NOT NULL,
	`preference_key` text NOT NULL,
	`value` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_preferences_scope_key_uidx` ON `user_preferences` (`user_id`,`namespace`,`preference_key`);--> statement-breakpoint
CREATE INDEX `user_preferences_user_idx` ON `user_preferences` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`granted_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `role`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`granted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "user_roles_role_check" CHECK("user_roles"."role" in ('user', 'admin', 'operator'))
);
--> statement-breakpoint
CREATE INDEX `user_roles_role_idx` ON `user_roles` (`role`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_seen_at` integer,
	CONSTRAINT "users_status_check" CHECK("users"."status" in ('active', 'disabled', 'deleted'))
);
--> statement-breakpoint
CREATE INDEX `users_status_idx` ON `users` (`status`);--> statement-breakpoint
CREATE TABLE `admin_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_user_id` text,
	`action` text NOT NULL,
	`outcome` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`request_id` text,
	`ip_hash` text,
	`details` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`admin_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "admin_audit_logs_outcome_check" CHECK("admin_audit_logs"."outcome" in ('success', 'denied', 'failure'))
);
--> statement-breakpoint
CREATE INDEX `admin_audit_logs_admin_time_idx` ON `admin_audit_logs` (`admin_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_audit_logs_action_time_idx` ON `admin_audit_logs` (`action`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_audit_logs_target_idx` ON `admin_audit_logs` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `ai_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`category` text DEFAULT 'general' NOT NULL,
	`resolution` text NOT NULL,
	`window_started_at` integer NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`estimated_cost_usd` real DEFAULT 0 NOT NULL,
	`latency_total_ms` integer DEFAULT 0 NOT NULL,
	`latency_max_ms` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "ai_metrics_resolution_check" CHECK("ai_metrics"."resolution" in ('hour', 'day')),
	CONSTRAINT "ai_metrics_values_check" CHECK("ai_metrics"."request_count" >= 0 and "ai_metrics"."failure_count" >= 0 and "ai_metrics"."input_tokens" >= 0 and "ai_metrics"."output_tokens" >= 0 and "ai_metrics"."estimated_cost_usd" >= 0 and "ai_metrics"."latency_total_ms" >= 0 and "ai_metrics"."latency_max_ms" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_metrics_bucket_uidx` ON `ai_metrics` (`provider`,`model`,`category`,`resolution`,`window_started_at`);--> statement-breakpoint
CREATE INDEX `ai_metrics_provider_time_idx` ON `ai_metrics` (`provider`,`window_started_at`);--> statement-breakpoint
CREATE TABLE `analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_name` text NOT NULL,
	`user_id` text,
	`anonymous_id_hash` text,
	`route` text,
	`properties` text,
	`occurred_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `analytics_events_name_time_idx` ON `analytics_events` (`event_name`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `analytics_events_user_time_idx` ON `analytics_events` (`user_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `analytics_events_occurred_idx` ON `analytics_events` (`occurred_at`);--> statement-breakpoint
CREATE TABLE `api_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`endpoint` text NOT NULL,
	`resolution` text NOT NULL,
	`window_started_at` integer NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	`success_count` integer DEFAULT 0 NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL,
	`rate_limited_count` integer DEFAULT 0 NOT NULL,
	`cache_hit_count` integer DEFAULT 0 NOT NULL,
	`latency_total_ms` integer DEFAULT 0 NOT NULL,
	`latency_max_ms` integer DEFAULT 0 NOT NULL,
	`rate_limit_remaining` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "api_metrics_resolution_check" CHECK("api_metrics"."resolution" in ('minute', 'hour', 'day')),
	CONSTRAINT "api_metrics_counts_check" CHECK("api_metrics"."request_count" >= 0 and "api_metrics"."success_count" >= 0 and "api_metrics"."error_count" >= 0 and "api_metrics"."rate_limited_count" >= 0 and "api_metrics"."cache_hit_count" >= 0 and "api_metrics"."latency_total_ms" >= 0 and "api_metrics"."latency_max_ms" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_metrics_bucket_uidx` ON `api_metrics` (`provider`,`endpoint`,`resolution`,`window_started_at`);--> statement-breakpoint
CREATE INDEX `api_metrics_provider_time_idx` ON `api_metrics` (`provider`,`window_started_at`);--> statement-breakpoint
CREATE TABLE `application_errors` (
	`id` text PRIMARY KEY NOT NULL,
	`fingerprint` text NOT NULL,
	`source` text NOT NULL,
	`severity` text NOT NULL,
	`error_code` text,
	`safe_message` text NOT NULL,
	`context` text,
	`occurrence_count` integer DEFAULT 1 NOT NULL,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`resolved_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "application_errors_severity_check" CHECK("application_errors"."severity" in ('info', 'warning', 'error', 'critical')),
	CONSTRAINT "application_errors_count_check" CHECK("application_errors"."occurrence_count" > 0),
	CONSTRAINT "application_errors_time_check" CHECK("application_errors"."last_seen_at" >= "application_errors"."first_seen_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_errors_fingerprint_uidx` ON `application_errors` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `application_errors_open_severity_idx` ON `application_errors` (`resolved_at`,`severity`);--> statement-breakpoint
CREATE INDEX `application_errors_source_last_seen_idx` ON `application_errors` (`source`,`last_seen_at`);--> statement-breakpoint
CREATE TABLE `cache_metadata` (
	`id` text PRIMARY KEY NOT NULL,
	`namespace` text NOT NULL,
	`cache_key` text NOT NULL,
	`provider_key` text,
	`state` text DEFAULT 'fresh' NOT NULL,
	`etag` text,
	`byte_size` integer,
	`hit_count` integer DEFAULT 0 NOT NULL,
	`miss_count` integer DEFAULT 0 NOT NULL,
	`last_hit_at` integer,
	`last_refresh_at` integer,
	`stale_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`last_error_code` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "cache_metadata_state_check" CHECK("cache_metadata"."state" in ('fresh', 'stale', 'refreshing', 'error')),
	CONSTRAINT "cache_metadata_counts_check" CHECK("cache_metadata"."hit_count" >= 0 and "cache_metadata"."miss_count" >= 0 and ("cache_metadata"."byte_size" is null or "cache_metadata"."byte_size" >= 0)),
	CONSTRAINT "cache_metadata_expiry_check" CHECK("cache_metadata"."expires_at" >= "cache_metadata"."stale_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cache_metadata_namespace_key_uidx` ON `cache_metadata` (`namespace`,`cache_key`);--> statement-breakpoint
CREATE INDEX `cache_metadata_expiry_idx` ON `cache_metadata` (`expires_at`);--> statement-breakpoint
CREATE INDEX `cache_metadata_state_stale_idx` ON `cache_metadata` (`state`,`stale_at`);--> statement-breakpoint
CREATE TABLE `feature_flags` (
	`key` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`default_enabled` integer DEFAULT false NOT NULL,
	`lifecycle` text DEFAULT 'production' NOT NULL,
	`default_config` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "feature_flags_lifecycle_check" CHECK("feature_flags"."lifecycle" in ('production', 'experimental', 'deferred', 'retired'))
);
--> statement-breakpoint
CREATE INDEX `feature_flags_lifecycle_idx` ON `feature_flags` (`lifecycle`);--> statement-breakpoint
CREATE TABLE `feature_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`flag_key` text NOT NULL,
	`scope_type` text NOT NULL,
	`scope_key` text DEFAULT 'global' NOT NULL,
	`enabled` integer NOT NULL,
	`config` text,
	`reason` text,
	`starts_at` integer,
	`ends_at` integer,
	`created_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`flag_key`) REFERENCES `feature_flags`(`key`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "feature_overrides_scope_type_check" CHECK("feature_overrides"."scope_type" in ('global', 'user', 'profile')),
	CONSTRAINT "feature_overrides_window_check" CHECK("feature_overrides"."starts_at" is null or "feature_overrides"."ends_at" is null or "feature_overrides"."ends_at" >= "feature_overrides"."starts_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feature_overrides_scope_uidx` ON `feature_overrides` (`flag_key`,`scope_type`,`scope_key`);--> statement-breakpoint
CREATE INDEX `feature_overrides_active_idx` ON `feature_overrides` (`flag_key`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE TABLE `job_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`payload` text,
	`result` text,
	`error_code` text,
	`error_message` text,
	`scheduler` text,
	`scheduled_at` integer,
	`started_at` integer,
	`finished_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "job_runs_status_check" CHECK("job_runs"."status" in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
	CONSTRAINT "job_runs_attempt_check" CHECK("job_runs"."attempt" > 0),
	CONSTRAINT "job_runs_time_check" CHECK("job_runs"."started_at" is null or "job_runs"."finished_at" is null or "job_runs"."finished_at" >= "job_runs"."started_at")
);
--> statement-breakpoint
CREATE INDEX `job_runs_job_status_time_idx` ON `job_runs` (`job_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `job_runs_status_scheduled_idx` ON `job_runs` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`queue` text DEFAULT 'default' NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`timeout_ms` integer DEFAULT 60000 NOT NULL,
	`schedule_hint` text,
	`default_payload` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "jobs_attempts_check" CHECK("jobs"."max_attempts" > 0),
	CONSTRAINT "jobs_timeout_check" CHECK("jobs"."timeout_ms" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_name_uidx` ON `jobs` (`name`);--> statement-breakpoint
CREATE INDEX `jobs_queue_enabled_idx` ON `jobs` (`queue`,`is_enabled`);--> statement-breakpoint
CREATE TABLE `minecraft_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`minecraft_uuid` text NOT NULL,
	`last_known_username` text NOT NULL,
	`username_normalized` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `minecraft_accounts_uuid_uidx` ON `minecraft_accounts` (`minecraft_uuid`);--> statement-breakpoint
CREATE INDEX `minecraft_accounts_username_idx` ON `minecraft_accounts` (`username_normalized`);--> statement-breakpoint
CREATE TABLE `saved_profiles` (
	`user_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`alias` text,
	`is_pinned` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_viewed_at` integer,
	PRIMARY KEY(`user_id`, `profile_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `skyblock_profiles`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `saved_profiles_profile_idx` ON `saved_profiles` (`profile_id`);--> statement-breakpoint
CREATE INDEX `saved_profiles_user_pinned_idx` ON `saved_profiles` (`user_id`,`is_pinned`);--> statement-breakpoint
CREATE TABLE `skyblock_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`minecraft_account_id` text NOT NULL,
	`hypixel_profile_id` text NOT NULL,
	`profile_name` text,
	`cute_name` text,
	`game_mode` text,
	`is_selected` integer DEFAULT false NOT NULL,
	`data_state` text DEFAULT 'unknown' NOT NULL,
	`member_joined_at` integer,
	`last_requested_at` integer,
	`last_successful_fetch_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`minecraft_account_id`) REFERENCES `minecraft_accounts`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "skyblock_profiles_data_state_check" CHECK("skyblock_profiles"."data_state" in ('unknown', 'complete', 'partial', 'disabled', 'error'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skyblock_profiles_hypixel_id_uidx` ON `skyblock_profiles` (`hypixel_profile_id`);--> statement-breakpoint
CREATE INDEX `skyblock_profiles_account_idx` ON `skyblock_profiles` (`minecraft_account_id`);--> statement-breakpoint
CREATE INDEX `skyblock_profiles_account_selected_idx` ON `skyblock_profiles` (`minecraft_account_id`,`is_selected`);--> statement-breakpoint
CREATE TABLE `user_minecraft_accounts` (
	`user_id` text NOT NULL,
	`minecraft_account_id` text NOT NULL,
	`label` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `minecraft_account_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`minecraft_account_id`) REFERENCES `minecraft_accounts`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_minecraft_accounts_account_idx` ON `user_minecraft_accounts` (`minecraft_account_id`);--> statement-breakpoint
CREATE TABLE `favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`label` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `favorites_user_resource_uidx` ON `favorites` (`user_id`,`resource_type`,`resource_id`);--> statement-breakpoint
CREATE INDEX `favorites_user_type_idx` ON `favorites` (`user_id`,`resource_type`);--> statement-breakpoint
CREATE TABLE `goal_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`position` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`estimate` text,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "goal_steps_position_check" CHECK("goal_steps"."position" >= 0),
	CONSTRAINT "goal_steps_status_check" CHECK("goal_steps"."status" in ('pending', 'active', 'completed', 'skipped'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `goal_steps_goal_position_uidx` ON `goal_steps` (`goal_id`,`position`);--> statement-breakpoint
CREATE INDEX `goal_steps_goal_status_idx` ON `goal_steps` (`goal_id`,`status`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`profile_id` text,
	`goal_type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`progress_percent` real DEFAULT 0 NOT NULL,
	`target` text NOT NULL,
	`due_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `skyblock_profiles`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "goals_status_check" CHECK("goals"."status" in ('active', 'paused', 'completed', 'archived')),
	CONSTRAINT "goals_progress_check" CHECK("goals"."progress_percent" >= 0 and "goals"."progress_percent" <= 100)
);
--> statement-breakpoint
CREATE INDEX `goals_user_status_idx` ON `goals` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `goals_profile_status_idx` ON `goals` (`profile_id`,`status`);--> statement-breakpoint
CREATE TABLE `recommendation_states` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`recommendation_key` text NOT NULL,
	`recommendation_version` text DEFAULT '1' NOT NULL,
	`category` text NOT NULL,
	`state` text DEFAULT 'active' NOT NULL,
	`context` text,
	`remind_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `skyblock_profiles`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "recommendation_states_state_check" CHECK("recommendation_states"."state" in ('active', 'completed', 'ignored', 'snoozed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recommendation_states_identity_uidx` ON `recommendation_states` (`user_id`,`profile_id`,`recommendation_key`);--> statement-breakpoint
CREATE INDEX `recommendation_states_user_state_idx` ON `recommendation_states` (`user_id`,`state`);--> statement-breakpoint
CREATE INDEX `recommendation_states_profile_category_idx` ON `recommendation_states` (`profile_id`,`category`);--> statement-breakpoint
CREATE INDEX `recommendation_states_remind_idx` ON `recommendation_states` (`state`,`remind_at`);--> statement-breakpoint
CREATE TABLE `saved_builds` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`profile_id` text,
	`title` text NOT NULL,
	`description` text,
	`visibility` text DEFAULT 'private' NOT NULL,
	`share_slug` text,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`is_experimental` integer DEFAULT true NOT NULL,
	`build` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `skyblock_profiles`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "saved_builds_visibility_check" CHECK("saved_builds"."visibility" in ('private', 'unlisted', 'public')),
	CONSTRAINT "saved_builds_schema_version_check" CHECK("saved_builds"."schema_version" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_builds_share_slug_uidx` ON `saved_builds` (`share_slug`);--> statement-breakpoint
CREATE INDEX `saved_builds_user_updated_idx` ON `saved_builds` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `saved_builds_profile_idx` ON `saved_builds` (`profile_id`);