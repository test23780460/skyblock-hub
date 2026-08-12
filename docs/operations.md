# Operations Runbook

## Current operating model

The web runtime serves UI and product APIs. Public economy APIs read normalized D1 snapshots only. A scheduler-independent worker cycle acquires a durable lease/fencing token, refreshes ended sales, Bazaar, and the complete active-Auction snapshot, then publishes feed markers and idempotent Bazaar hour/day history. The Cloudflare scheduled handler and migrations exist; production D1 application, exactly one schedule registration, backups, live history collection, and monitoring remain deployment work.

## Health and status

- `/status` is a human-readable configuration/status page.
- `/api/health` reports local configuration, in-memory cache stats, and provider backoff state without making a live probe.
- `/api/health` is a web-process liveness endpoint. Its JSON reports optional integrations as disabled/degraded/available/backing off without turning an intentionally disabled dependency into a failed container health check.
- Bazaar, Auction, and profile pages show source/cache timestamps. Check these before declaring data current.
- A successful web liveness response does not prove that D1 migrations, the economy schedule, auth, AI, or live player lookup are active.

## Admin access

Set `ADMIN_USER_IDS` to an exact comma-separated allowlist of verified Sites/ChatGPT user IDs. An empty value authorizes nobody. Admin mutations also require an explicit request Origin exactly matching the public request URL.

The current admin surface can:

- inspect local web/provider/cache/rate configuration;
- inspect private aggregate AI request, failure, token, configured-cost, latency, and category summaries without prompt/user/IP content;
- request one full durable economy cycle through the same elected lease/backoff path as the schedule;
- invalidate only the current runtime's upstream economy cache after confirmation.

It cannot manage arbitrary flags, SQL, users, migrations, secrets, deployments, scheduler configuration, failed jobs, or broad cache prefixes. A skipped admin cycle means another lease holder is already working; it must not be bypassed.

## Economy worker

| Feed | Operating baseline | Current guardrails |
| --- | --- | --- |
| Ended Auctions | 55 seconds | Skips stale/unchanged/older data, deduplicates UUIDs, omits identities/raw items, and prunes the bounded retained feed. |
| Bazaar | 60 seconds | Publishes normalized product summaries, idempotently aggregates each newer source timestamp into hourly/daily OHLC and average-volume buckets, and prunes 90-day/three-year retention windows. |
| Active Auctions | 60 seconds | Bounded to 256 pages with concurrency 2; discards mixed/stale/older page sets and publishes only a complete version. |

`runPublicEconomyCycle` acquires the global D1 lease before making an upstream call. Each lease receives a monotonically increasing fencing token; a stale worker cannot publish after a replacement lease wins. Durable `429`/`503` backoff prevents a later invocation from bypassing the circuit. One cycle processes ended sales first, then Bazaar, then active Auctions.

The baselines are not permission to exceed current Hypixel policy or source update cadence. Register exactly one intended schedule. The lease prevents overlap but should not be used to justify noisy duplicate triggers.

## Cache and rate state

The current `MemoryTtlCache` holds at most 2,000 entries per process, evicts least-recently-used entries, coalesces identical in-flight loads in one runtime, and can serve bounded stale provider data after an upstream error.

Player/Minecraft cache, Hypixel header rate state, and AI throttling remain per runtime. Public economy publication state, snapshots, lease, fencing token, and global backoff are durable in D1. Before horizontally scaling player/AI traffic, replace memory cache, single-flight, abuse limits, and rate budget with shared providers.

## Incident actions

### Exposed credential

1. Revoke it at the provider immediately.
2. Remove it from the deployment secret store and create a replacement.
3. Search logs, source history, issues, chat, build artifacts, and client bundles for exposure.
4. Invalidate/redeploy affected builds.
5. Record a redacted audit event; do not paste the replacement into the incident record.

### Hypixel rate limiting

1. Stop manual refreshes and scheduled dispatch if the durable circuit is not already backing off.
2. Honor `Retry-After`, reset state, and stale-snapshot behavior.
3. Confirm no other application/deployment is bypassing the intended budget.
4. Inspect request volume by endpoint and reduce cadence/concurrency.
5. Never add keys or proxies to evade the limit.

### Stale or inconsistent Auctions

1. Continue serving the last complete snapshot with a stale label.
2. Discard a cycle when page timestamps differ or any page is stale/older.
3. Let the durable backoff/next schedule govern the retry.
4. Do not publish partial pages as one coherent market snapshot.

### Database migration failure

1. Stop writes/jobs that depend on the new schema.
2. Preserve the database/export; do not edit a deployed migration in place.
3. Follow the tested recovery/export path and add a forward corrective migration.
4. Run `npm run db:check` and `npm run db:smoke`, then verify foreign keys, row counts, representative user/economy records, and application smoke tests.

See [Database migrations](database/migrations.md) and [Security](../SECURITY.md).

## Retention and backups

No production retention or backup policy is active. The code currently retains deduplicated ended-sale facts for a bounded default window, replaces current Bazaar/active-Auction versions, and prunes Bazaar history to 90 days hourly and three years daily. This is not a complete cross-market multi-year policy. Before launch define:

- user deletion and auth-identity retention;
- analytics/error/admin-audit retention and redaction;
- ended-sale retention plus Auction/item aggregate and long-term compaction policy;
- database export frequency, encryption, access, restore drills, and recovery objectives;
- job/error history pruning;
- cache payload and metadata expiry.
