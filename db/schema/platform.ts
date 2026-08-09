import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createdAt, jsonText, timestampMs, updatedAt, type JsonObject } from "./helpers";
import { users } from "./identity";

export const cacheMetadata = sqliteTable(
  "cache_metadata",
  {
    id: text("id").primaryKey(),
    namespace: text("namespace").notNull(),
    cacheKey: text("cache_key").notNull(),
    providerKey: text("provider_key"),
    state: text("state", { enum: ["fresh", "stale", "refreshing", "error"] })
      .notNull()
      .default("fresh"),
    etag: text("etag"),
    byteSize: integer("byte_size"),
    hitCount: integer("hit_count").notNull().default(0),
    missCount: integer("miss_count").notNull().default(0),
    lastHitAt: timestampMs("last_hit_at"),
    lastRefreshAt: timestampMs("last_refresh_at"),
    staleAt: timestampMs("stale_at").notNull(),
    expiresAt: timestampMs("expires_at").notNull(),
    lastErrorCode: text("last_error_code"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("cache_metadata_namespace_key_uidx").on(table.namespace, table.cacheKey),
    index("cache_metadata_expiry_idx").on(table.expiresAt),
    index("cache_metadata_state_stale_idx").on(table.state, table.staleAt),
    check(
      "cache_metadata_state_check",
      sql`${table.state} in ('fresh', 'stale', 'refreshing', 'error')`,
    ),
    check(
      "cache_metadata_counts_check",
      sql`${table.hitCount} >= 0 and ${table.missCount} >= 0 and (${table.byteSize} is null or ${table.byteSize} >= 0)`,
    ),
    check("cache_metadata_expiry_check", sql`${table.expiresAt} >= ${table.staleAt}`),
  ],
);

export const featureFlags = sqliteTable(
  "feature_flags",
  {
    key: text("key").primaryKey(),
    description: text("description").notNull(),
    defaultEnabled: integer("default_enabled", { mode: "boolean" }).notNull().default(false),
    lifecycle: text("lifecycle", {
      enum: ["production", "experimental", "deferred", "retired"],
    })
      .notNull()
      .default("production"),
    defaultConfig: jsonText<JsonObject>("default_config"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("feature_flags_lifecycle_idx").on(table.lifecycle),
    check(
      "feature_flags_lifecycle_check",
      sql`${table.lifecycle} in ('production', 'experimental', 'deferred', 'retired')`,
    ),
  ],
);

export const featureOverrides = sqliteTable(
  "feature_overrides",
  {
    id: text("id").primaryKey(),
    flagKey: text("flag_key")
      .notNull()
      .references(() => featureFlags.key, { onDelete: "cascade", onUpdate: "cascade" }),
    scopeType: text("scope_type", { enum: ["global", "user", "profile"] }).notNull(),
    scopeKey: text("scope_key").notNull().default("global"),
    enabled: integer("enabled", { mode: "boolean" }).notNull(),
    config: jsonText<JsonObject>("config"),
    reason: text("reason"),
    startsAt: timestampMs("starts_at"),
    endsAt: timestampMs("ends_at"),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("feature_overrides_scope_uidx").on(table.flagKey, table.scopeType, table.scopeKey),
    index("feature_overrides_active_idx").on(table.flagKey, table.startsAt, table.endsAt),
    check(
      "feature_overrides_scope_type_check",
      sql`${table.scopeType} in ('global', 'user', 'profile')`,
    ),
    check(
      "feature_overrides_window_check",
      sql`${table.startsAt} is null or ${table.endsAt} is null or ${table.endsAt} >= ${table.startsAt}`,
    ),
  ],
);

export const analyticsEvents = sqliteTable(
  "analytics_events",
  {
    id: text("id").primaryKey(),
    eventName: text("event_name").notNull(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    anonymousIdHash: text("anonymous_id_hash"),
    route: text("route"),
    properties: jsonText<JsonObject>("properties"),
    occurredAt: timestampMs("occurred_at").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("analytics_events_name_time_idx").on(table.eventName, table.occurredAt),
    index("analytics_events_user_time_idx").on(table.userId, table.occurredAt),
    index("analytics_events_occurred_idx").on(table.occurredAt),
  ],
);

export const adminAuditLogs = sqliteTable(
  "admin_audit_logs",
  {
    id: text("id").primaryKey(),
    adminUserId: text("admin_user_id").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    action: text("action").notNull(),
    outcome: text("outcome", { enum: ["success", "denied", "failure"] }).notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    requestId: text("request_id"),
    ipHash: text("ip_hash"),
    details: jsonText<JsonObject>("details"),
    createdAt: createdAt(),
  },
  (table) => [
    index("admin_audit_logs_admin_time_idx").on(table.adminUserId, table.createdAt),
    index("admin_audit_logs_action_time_idx").on(table.action, table.createdAt),
    index("admin_audit_logs_target_idx").on(table.targetType, table.targetId),
    check(
      "admin_audit_logs_outcome_check",
      sql`${table.outcome} in ('success', 'denied', 'failure')`,
    ),
  ],
);

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    queue: text("queue").notNull().default("default"),
    isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
    maxAttempts: integer("max_attempts").notNull().default(3),
    timeoutMs: integer("timeout_ms").notNull().default(60_000),
    scheduleHint: text("schedule_hint"),
    defaultPayload: jsonText<JsonObject>("default_payload"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("jobs_name_uidx").on(table.name),
    index("jobs_queue_enabled_idx").on(table.queue, table.isEnabled),
    check("jobs_attempts_check", sql`${table.maxAttempts} > 0`),
    check("jobs_timeout_check", sql`${table.timeoutMs} > 0`),
  ],
);

export const jobRuns = sqliteTable(
  "job_runs",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade", onUpdate: "cascade" }),
    status: text("status", {
      enum: ["queued", "running", "succeeded", "failed", "cancelled"],
    })
      .notNull()
      .default("queued"),
    attempt: integer("attempt").notNull().default(1),
    payload: jsonText<JsonObject>("payload"),
    result: jsonText<JsonObject>("result"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    scheduler: text("scheduler"),
    scheduledAt: timestampMs("scheduled_at"),
    startedAt: timestampMs("started_at"),
    finishedAt: timestampMs("finished_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("job_runs_job_status_time_idx").on(table.jobId, table.status, table.createdAt),
    index("job_runs_status_scheduled_idx").on(table.status, table.scheduledAt),
    check(
      "job_runs_status_check",
      sql`${table.status} in ('queued', 'running', 'succeeded', 'failed', 'cancelled')`,
    ),
    check("job_runs_attempt_check", sql`${table.attempt} > 0`),
    check(
      "job_runs_time_check",
      sql`${table.startedAt} is null or ${table.finishedAt} is null or ${table.finishedAt} >= ${table.startedAt}`,
    ),
  ],
);

export const apiMetrics = sqliteTable(
  "api_metrics",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    endpoint: text("endpoint").notNull(),
    resolution: text("resolution", { enum: ["minute", "hour", "day"] }).notNull(),
    windowStartedAt: timestampMs("window_started_at").notNull(),
    requestCount: integer("request_count").notNull().default(0),
    successCount: integer("success_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    rateLimitedCount: integer("rate_limited_count").notNull().default(0),
    cacheHitCount: integer("cache_hit_count").notNull().default(0),
    latencyTotalMs: integer("latency_total_ms").notNull().default(0),
    latencyMaxMs: integer("latency_max_ms").notNull().default(0),
    rateLimitRemaining: integer("rate_limit_remaining"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("api_metrics_bucket_uidx").on(
      table.provider,
      table.endpoint,
      table.resolution,
      table.windowStartedAt,
    ),
    index("api_metrics_provider_time_idx").on(table.provider, table.windowStartedAt),
    check("api_metrics_resolution_check", sql`${table.resolution} in ('minute', 'hour', 'day')`),
    check(
      "api_metrics_counts_check",
      sql`${table.requestCount} >= 0 and ${table.successCount} >= 0 and ${table.errorCount} >= 0 and ${table.rateLimitedCount} >= 0 and ${table.cacheHitCount} >= 0 and ${table.latencyTotalMs} >= 0 and ${table.latencyMaxMs} >= 0`,
    ),
  ],
);

export const aiMetrics = sqliteTable(
  "ai_metrics",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    category: text("category").notNull().default("general"),
    resolution: text("resolution", { enum: ["hour", "day"] }).notNull(),
    windowStartedAt: timestampMs("window_started_at").notNull(),
    requestCount: integer("request_count").notNull().default(0),
    failureCount: integer("failure_count").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    estimatedCostUsd: real("estimated_cost_usd").notNull().default(0),
    latencyTotalMs: integer("latency_total_ms").notNull().default(0),
    latencyMaxMs: integer("latency_max_ms").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("ai_metrics_bucket_uidx").on(
      table.provider,
      table.model,
      table.category,
      table.resolution,
      table.windowStartedAt,
    ),
    index("ai_metrics_provider_time_idx").on(table.provider, table.windowStartedAt),
    check("ai_metrics_resolution_check", sql`${table.resolution} in ('hour', 'day')`),
    check(
      "ai_metrics_values_check",
      sql`${table.requestCount} >= 0 and ${table.failureCount} >= 0 and ${table.inputTokens} >= 0 and ${table.outputTokens} >= 0 and ${table.estimatedCostUsd} >= 0 and ${table.latencyTotalMs} >= 0 and ${table.latencyMaxMs} >= 0`,
    ),
  ],
);

export const applicationErrors = sqliteTable(
  "application_errors",
  {
    id: text("id").primaryKey(),
    fingerprint: text("fingerprint").notNull(),
    source: text("source").notNull(),
    severity: text("severity", { enum: ["info", "warning", "error", "critical"] }).notNull(),
    errorCode: text("error_code"),
    safeMessage: text("safe_message").notNull(),
    context: jsonText<JsonObject>("context"),
    occurrenceCount: integer("occurrence_count").notNull().default(1),
    firstSeenAt: timestampMs("first_seen_at").notNull(),
    lastSeenAt: timestampMs("last_seen_at").notNull(),
    resolvedAt: timestampMs("resolved_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("application_errors_fingerprint_uidx").on(table.fingerprint),
    index("application_errors_open_severity_idx").on(table.resolvedAt, table.severity),
    index("application_errors_source_last_seen_idx").on(table.source, table.lastSeenAt),
    check(
      "application_errors_severity_check",
      sql`${table.severity} in ('info', 'warning', 'error', 'critical')`,
    ),
    check("application_errors_count_check", sql`${table.occurrenceCount} > 0`),
    check("application_errors_time_check", sql`${table.lastSeenAt} >= ${table.firstSeenAt}`),
  ],
);
