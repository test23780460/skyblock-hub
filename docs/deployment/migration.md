# Hosting Migration Plan

This plan moves SkyPilot away from Sites without rewriting SkyBlock domain logic. It is a design/runbook; no external migration has been executed.

## 1. Inventory and freeze

- Record the exact deployed version, runtime configuration names, active flags, bindings, routes, and worker schedules.
- Rotate any exposed credentials before copying configuration.
- Pause durable writes/ingestion for the final export window or establish a replay checkpoint.
- Export D1 and verify the backup can be read independently.

## 2. Frontend and backend runtime

- Build a target runtime adapter for vinext/server requests, static assets, images, environment, and trusted proxy headers.
- Preserve product API envelopes and public/private route behavior.
- Configure the real HTTPS origin so metadata, canonical URLs, sitemap, and robots output are correct.

## 3. Database

- Implement the repository contracts for PostgreSQL or the selected database.
- Translate D1 types using [database portability](../database/portability.md).
- Apply the target migration chain, import in foreign-key order, and preserve application IDs/uniqueness keys.
- Compare row counts, orphan checks, representative users/goals/builds, latest market snapshots, valuations, jobs, and flags.

## 4. Authentication

- Replace Sites identity headers with a verified provider adapter.
- Map provider subjects to existing canonical `users.id`; do not move provider IDs into business tables.
- Implement secure cookie/session storage, callback validation, CSRF/origin protection, account linking/deletion, and admin allowlist/roles.

## 5. Cache, queues, workers, and schedules

- Move per-runtime cache/single-flight/rate state to shared providers when running multiple replicas.
- Deploy web and economy workers separately.
- Bind scheduler configuration only to job entry points; keep job business logic in worker functions.
- Configure idempotent snapshots/sales, overlap prevention, backoff, metrics, retention, and dead/failure handling.
- Preserve the ban on continuous player polling.

## 6. Secrets, storage, analytics, and domain

- Install replacement secrets in the target secret manager; never export secret values through Git or migration files.
- Choose portable object storage only if required; no R2 data exists in the current configuration.
- Configure redacted logs/errors/metrics and privacy-conscious analytics.
- Configure backups, restore drills, retention, alerts, DNS, TLS, and rollback.

## 7. Validate and cut over

1. Run lint, typecheck, full tests/build, database checks, and critical E2E against the target.
2. Smoke-test anonymous profile/economy routes, authenticated goals, admin authorization, and optional AI failure/success.
3. Verify shared rate/cache behavior under multiple replicas.
4. Re-run Hypixel policy, security, performance, accessibility, and visual audits.
5. Put the old deployment in read-only/maintenance mode for the final delta if necessary.
6. Switch DNS, monitor, and retain a tested rollback window.

The migration passes only when the old Sites/D1 configuration can be removed without editing progression, economy, valuation, calculator, or recommendation logic.
