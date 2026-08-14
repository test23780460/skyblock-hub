# Database Guide

## Current implementation

SkyPilot currently uses Drizzle ORM with the SQLite dialect and a Cloudflare D1 runtime binding. The schema entry point is `db/schema.ts`; domain tables are split under `db/schema/`. Generated migrations and Drizzle snapshots live under `drizzle/` and are versioned with schema changes.

The database contains no credentials. Connection/binding configuration belongs in the deployment environment, and `.env.example` must contain blank placeholders only.

## Table catalog

### Identity

| Table | Purpose |
| --- | --- |
| `users` | Canonical provider-independent SkyPilot users. |
| `external_identities` | OAuth/login provider subjects mapped to a canonical user. |
| `user_roles` | User/admin/operator grants with grant provenance. |
| `user_preferences` | Namespaced, evolving user settings. |

### Player identity and saves

| Table | Purpose |
| --- | --- |
| `minecraft_accounts` | Global Minecraft UUID and current username identity. |
| `user_minecraft_accounts` | Many-to-many account links and primary/label state. |
| `skyblock_profiles` | Stable Hypixel profile identity and request/freshness metadata. |
| `saved_profiles` | User-specific saved/pinned profile state. |

These tables do not authorize continuous profile polling. Profile fetches remain request-driven and cached according to current Hypixel policy.

### Product state

| Table | Purpose |
| --- | --- |
| `goals` | User goal header, target, status, and progress. |
| `goal_steps` | Ordered actionable steps under a goal. |
| `recommendation_states` | Complete/ignore/snooze state for stable recommendation keys. |
| `saved_builds` | Versioned flexible build definitions and optional share slug. |
| `favorites` | Polymorphic favorites keyed by resource type and ID. |

### Economy

| Table | Purpose |
| --- | --- |
| `items` | Stable item metadata and evolving provider fragments. |
| `bazaar_products` | Bazaar product identity mapped to item metadata. |
| `bazaar_snapshots` | Deduplicated raw product snapshots. |
| `bazaar_aggregates` | Hour/day OHLC-like price and average-volume history. |
| `auction_listings` | Current ingested auction state. |
| `auction_sales` | Deduplicated ended-sale facts. |
| `item_valuations` | Versioned estimates, confidence, sample size, and factors. |
| `public_economy_worker_state` | Global worker lease, fencing token, backoff, and safe failure state. |
| `public_economy_feed_state` | Published version/freshness/count marker for each public feed. |
| `public_bazaar_snapshot_rows` | Latest normalized Bazaar version consumed by product APIs. |
| `public_bazaar_history_buckets` | Idempotent hour/day Bazaar OHLC and average-volume history with bounded retention. |
| `public_active_auction_snapshot_rows` | Latest complete normalized active-Auction version. |
| `public_ended_auction_sales` | Minimal deduplicated ended-sale facts with bounded retention. |

### Platform and operations

| Table | Purpose |
| --- | --- |
| `cache_metadata` | Freshness/expiry/usage metadata independent of payload storage. |
| `feature_flags` | Centralized default and lifecycle metadata. |
| `feature_overrides` | Time-bounded global/user/profile values. |
| `analytics_events` | Minimal privacy-conscious product events. |
| `admin_audit_logs` | Security-relevant administrator actions and outcomes. |
| `jobs` | Scheduler-independent job definitions. |
| `job_runs` | Per-attempt state, safe errors, and result metadata. |
| `api_metrics` | Aggregated provider/endpoint traffic, errors, limits, cache, latency. |
| `ai_metrics` | Aggregated model usage, failures, tokens, cost, and latency. |
| `application_errors` | Deduplicated/redacted operational error groups. |

## Repository use

Application services import interfaces from `lib/repositories`, not tables or Drizzle query helpers. The current server composition creates a Drizzle database and passes it to `createDrizzleRepositoryProvider`. Services should request the narrowest repository they need.

Callers generate IDs before invoking repositories. This makes retries and ingestion idempotent across D1 and future PostgreSQL deployments. Upsert keys include external provider identity, Minecraft UUID, Hypixel profile ID, recommendation identity, Bazaar product/time, Auction UUID, valuation version/time, and metric windows.

## Data rules

- Normalize stable relationships and queryable attributes.
- Use JSON only for evolving item/provider fragments, settings, build/goal definitions, evidence, and redacted opaque context.
- Validate JSON at service/adaptor boundaries; a JSON column is not an untyped trust boundary.
- Store all times in UTC epoch milliseconds.
- Never log or persist API keys, OAuth secrets, raw private prompts, raw session identifiers, or unredacted error payloads.
- Retain raw economy snapshots only as long as operationally useful; preserve compact aggregates for long-term charts.
- Prefer soft user lifecycle status where audit/recovery requires it; owned user content still uses explicit foreign-key cascade behavior.

## Verification

Run:

```powershell
npm.cmd run db:generate
npm.cmd run db:check
npm.cmd run db:smoke
npm.cmd run typecheck
```

`db:smoke` applies the full chain to isolated SQLite, compares its 36-table result with the latest snapshot, and runs the foreign-key check.

`db:generate` should produce no diff when the repository migration snapshot matches the schema. Typecheck may require the project’s Cloudflare worker ambient types to be configured by the runtime/tooling owner.
