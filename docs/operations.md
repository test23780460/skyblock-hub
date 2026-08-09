# Operations Runbook

## Current operating model

The web runtime serves UI and product APIs. Public economy jobs are scheduler-independent functions, but no production scheduler or durable `EconomySnapshotSink` is configured by this repository. D1 schema/migrations exist; production binding, migration application, backups, retention, and monitoring remain deployment work.

## Health and status

- `/status` is a human-readable configuration/status page.
- `/api/health` reports local configuration, in-memory cache stats, and provider backoff state without making a live probe.
- `/api/health` is a web-process liveness endpoint and returns HTTP 200 while the application can serve requests. Its JSON reports optional integrations as `disabled`, `degraded`, `available`, or `backing_off` without turning an intentionally disabled dependency into a failed container healthcheck.
- Bazaar, Auction, and profile pages show source/cache timestamps. Check these before declaring data current.

## Admin access

Set `ADMIN_USER_IDS` to an exact comma-separated allowlist of verified Sites/ChatGPT user IDs. An empty value authorizes nobody.

The current admin surface can:

- inspect local web/provider/cache/rate configuration;
- run one Bazaar refresh;
- run one ended-auction refresh;
- invalidate the current runtime’s economy cache after UI confirmation.

It cannot safely manage arbitrary flags, SQL, users, migrations, secrets, deployments, or scheduler configuration. The refresh actions normalize data but do not persist it unless a sink is supplied by a future worker composition.

## Worker jobs

| Job | Baseline constant | Current guardrails |
| --- | --- | --- |
| Bazaar refresh | 60 seconds | Skips stale or unchanged upstream snapshots. |
| Active Auctions refresh | 60 seconds | Bounded to 256 pages, concurrency 2, discards mixed/stale snapshots. |
| Ended Auctions refresh | 55 seconds | Skips stale or unchanged upstream snapshots. |

These constants are operating baselines, not permission to exceed current Hypixel policy or source update cadence. A scheduler must honor shared distributed rate state, backoff, overlap prevention, idempotency, and job-run persistence before production activation.

## Cache and rate state

The current `MemoryTtlCache` holds at most 2,000 entries per process, evicts least-recently-used entries, coalesces identical in-flight loads in one runtime, and can serve bounded stale data after an upstream error.

Hypixel rate headers and `429` responses update a per-runtime authenticated/public registry. The registry blocks until reset/backoff and adds exponential delay with jitter. It does not coordinate multiple replicas. Before horizontal scaling, replace memory cache, single-flight, AI throttling, and rate budget with shared providers.

## Incident actions

### Exposed credential

1. Revoke it at the provider immediately.
2. Remove it from the deployment secret store and create a replacement.
3. Search logs, source history, issues, chat, build artifacts, and client bundles for exposure.
4. Invalidate/redeploy affected builds.
5. Record a redacted audit event; do not paste the replacement into the incident record.

### Hypixel rate limiting

1. Stop manual refreshes and background dispatch.
2. Honor `Retry-After`, reset state, and stale-cache behavior.
3. Confirm no other replica/key/application is bypassing the shared budget.
4. Inspect request volume by endpoint and reduce cadence/concurrency.
5. Never add keys or proxies to evade the limit.

### Stale or inconsistent Auctions

1. Preserve the last complete snapshot.
2. Discard a cycle when page timestamps differ or any page is stale.
3. Wait for the next source update and rerun the bounded job.
4. Do not publish partial pages as one coherent market snapshot.

### Database migration failure

1. Stop writes that depend on the new schema.
2. Preserve the database/export; do not edit a deployed migration in place.
3. Follow the tested recovery/export path and add a forward corrective migration.
4. Verify foreign keys, row counts, representative user/economy records, and application smoke tests.

See [Database migrations](database/migrations.md) and [Security](../SECURITY.md).

## Retention and backups

No production retention or backup policy is active. Before launch define:

- user deletion and auth-identity retention;
- analytics/error/admin-audit retention and redaction;
- raw Bazaar/Auction snapshot compaction into hour/day aggregates;
- database export frequency, encryption, access, restore drills, and recovery objectives;
- job/error history pruning;
- cache payload and metadata expiry.
