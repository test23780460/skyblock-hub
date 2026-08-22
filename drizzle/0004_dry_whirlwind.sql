CREATE TABLE `provider_request_budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`window_started_at` integer NOT NULL,
	`reserved_count` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "provider_request_budgets_reserved_check" CHECK("provider_request_budgets"."reserved_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_request_budgets_scope_window_uidx` ON `provider_request_budgets` (`scope`,`window_started_at`);--> statement-breakpoint
CREATE INDEX `provider_request_budgets_window_idx` ON `provider_request_budgets` (`window_started_at`);