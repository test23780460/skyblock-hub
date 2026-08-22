# Operations runbook

## Initial operating posture

The prepared native runtime uses two Workers per named environment. `skypilot`
and `skypilot-staging` serve the UI and product APIs with Static Assets.
`skypilot-economy` and `skypilot-economy-staging` are private public-resource
ingestion Workers with `workers_dev=false` and preview URLs disabled. Each web
Worker reaches only its matching private Worker through `ECONOMY_SERVICE`.
Named environments have separate application D1, player KV, and rate-limit
bindings; their web Workers share one dedicated `PROVIDER_BUDGET_DB` for the one
Hypixel credential. Player lookup is request-driven. Account auth, AI, the legacy browser gateway, and
public economy are safe-default off unless their separate gates are satisfied.

The private economy service entry, scheduler, lease/fencing/backoff, feed jobs,
and D1 readers are implemented, but **both Workers in every initial environment
have `ENABLE_PUBLIC_ECONOMY=false` and no Cron Trigger**. Do not activate the
row-heavy writer while its active-Auction crawl is non-incremental. Workers
Paid, current migrations for every bound database role, a usage/cost and
capacity budget, a reviewed incremental or compacted ingestion replacement,
monitoring, and exactly one reviewed production Cron on the private economy
Worker are confirmed.

On 2026-08-22, all five application migrations were applied successfully to
production D1 `skypilot-production`. A follow-up remote migration listing had
nothing pending; read-only verification found 39 SQLite tables (37 application
plus two migration-bookkeeping tables), and `PRAGMA foreign_key_check` returned
no rows. This is schema evidence only, not backup/restore or production-traffic
evidence.

## Health and status

- `/status` is the human-readable feature/configuration view.
- `/api/health` returns HTTP 200 for process liveness and reports only a safe
  environment label plus configured/disabled dependency states.
- Health does not expose binding IDs/names or secret names and does not probe
  upstream providers.
- A healthy web Worker does not prove D1 migrations, a remote secret, the
  private economy service, public economy, optional auth, AI, DNS, or Workers
  Builds are active.
- Player/profile and economy surfaces show source/cache timestamps; inspect
  them before declaring data current.

## Identity and admin access

Native account features are off initially. If they are enabled later, the
Cloudflare Access adapter must validate the assertion signature, exact issuer
and audience, algorithm, expiry, and bounded claims before any canonical-user
mapping. `ADMIN_USER_IDS` is then an exact subject allowlist; an empty value
authorizes nobody. Mutation routes also require an explicit exact Origin.

Do not protect the whole public hostname with Access when account-free tools
must remain anonymous. Protecting only a login path also does not create an app
session on unprotected routes. Keep accounts/admin off until a path/session
design is verified end to end. Never merge a historical Sites identity into a
new identity merely because email strings match.

When enabled, the current admin surface can send one fixed refresh request over
`ECONOMY_SERVICE` to the matching private economy Worker and view bounded
aggregate AI metrics. The web Worker never
imports or executes ingestion jobs. The admin surface cannot run arbitrary SQL,
change secrets, manage users, configure Crons, choose an internal URL, or
invalidate broad cache prefixes.

## Player cache and admission

Native player/Minecraft values use environment-isolated Workers KV plus a
bounded per-isolate L0 cache. There is no cross-request I/O Promise single-flight
map. `PLAYER_ACTOR_LIMITER` is a route-bound coarse per-location abuse filter.
Minecraft/PlayerDB identity calls do not spend Hypixel quota. Username
resolution tries both official services first. Only their bounded
transport/access failures may reach PlayerDB; an authoritative not-found result
does not. SkyPilot application code supplies only the normalized username plus
its identifying service user agent; Cloudflare may add network headers,
including visitor-IP metadata depending on routing. SkyPilot caches only the strictly validated
latest username/UUID mapping. Only when a cache miss reaches
an authenticated Hypixel transport does SkyPilot perform one coarse
`PLAYER_GLOBAL_LIMITER` check and one atomic two-token reservation in the shared
`PROVIDER_BUDGET_DB`. Budget-storage failure fails closed. Hypixel
response-header backoff remains local to an isolate.

Cloudflare rate-limit bindings are per location and eventually consistent; they
are coarse abuse/headroom filters, not the credential budget. Atomic fixed-window
rows in the dedicated provider-budget D1 globally guard the shared Hypixel key
across staging and production. Monitor D1 admission failures,
the configured reservation capacity, the approved Hypixel allocation, response
headers, and multi-region cold-miss volume. Keep `ENABLE_PLAYER_LOOKUP=false` for
public traffic until staging load evidence and alerting validate those settings.

The PlayerDB path and public privacy disclosure pass focused tests. Exact
application commit `75659fb2f3d6` also verifies staging egress/schema and safe error classification:
an unknown username returned `404 player_not_found`, while valid username and
UUID shapes reached Hypixel and returned `503 forbidden` because the configured
credential was invalid. This is not a successful live-data or load test. Keep
public activation gated on a valid rotated credential, successful identity
agreement, load evidence, and alerting. Monitor only aggregate resolver
outcome/error/latency counts; never log usernames, UUIDs,
raw PlayerDB responses, client addresses, or the identifying request URL. A
PlayerDB failure must use stale validated identity cache where allowed or return
the direct-UUID recovery action. It must not trigger polling, batch resolution,
alternate proxy rotation, or tight retries. Honor `429` and `Retry-After`.

The separate signed player gateway/browser capability is not part of the native
runtime. Operate it only if deliberately rolling back to the historical
owner-only Sites deployment, following its [rollback runbook](deployment/player-gateway.md).

## Private economy Worker (activation-only)

| Feed | Implemented baseline | Guardrails |
| --- | --- | --- |
| Ended Auctions | 55 seconds | Skip stale/unchanged/older data, deduplicate UUIDs, omit identities/raw items, prune bounded retention. |
| Bazaar | 60 seconds | Publish normalized summaries, aggregate newer timestamps into hour/day OHLC and volume buckets, prune 90-day/three-year retention. |
| Active Auctions | 60 seconds | At most 256 pages with concurrency 2; reject mixed/stale/older or incomplete page sets. |

These are code baselines, not an active schedule. Only `worker/economy.ts` may
invoke them in native Cloudflare. The private Workers have no public hostname or
preview URL; deploy the environment-matched private Worker before the web Worker
so its `ECONOMY_SERVICE` target exists. One cycle acquires a D1 lease
with a monotonically increasing fencing token, processes ended sales, Bazaar,
and active Auctions, and honors durable `429`/`503` backoff. Stale upstream data
never republishes. A last real expired snapshot remains readable as stale; no
first snapshot or storage failure returns retryable `503`, never demo data.

Scheduled outcomes emit bounded structured `skypilot.economy_cycle` logs with
status, duration, job counts/cache status, and sanitized error codes only.
Unexpected failures are rethrown so Cloudflare records a failed Cron Event. Do
not log upstream payloads, selectors, credentials, or thrown values.

The row-heavy one-minute D1 publication and non-incremental active-Auction crawl
are not Free-plan safe and have not passed production capacity/soak evidence.
Keep both flags and every Cron disabled until Workers Paid, monitoring, and a
reviewed incremental or compacted ingestion replacement are confirmed. A
capacity-safe design may require a new compact-series
schema/API/migration and reduced write amplification; do not improvise that
during activation.

## Incident actions

### Exposed credential

1. Revoke it at the provider immediately.
2. Remove it from every secret store and create a replacement.
3. Search source history, issues/chat, logs, build output, source maps, and
   browser assets for exposure without printing replacement values.
4. Invalidate/redeploy affected versions and record only a redacted incident.

### Hypixel rate limiting

1. Disable player lookup if shared `PROVIDER_BUDGET_DB` admission/backoff is not protecting the
   approved allocation; stop private-economy service/Cron triggers if relevant.
2. Honor `Retry-After` and stale-cache behavior.
3. Confirm no other deployment/key path bypasses the intended budget.
4. Inspect endpoint/cold-miss volume and reduce exposure/cadence.
5. Never add keys or proxies to evade a limit.

### Username resolver unavailable or invalid

1. Keep lookup user-triggered; do not schedule, batch, or monitor players.
2. Confirm official resolver failures are transport/access failures rather than
   authoritative not-found responses.
3. Disable or bypass the PlayerDB fallback if schema, username, UUID, privacy,
   or rate-limit behavior is unexpected; direct Java UUID input remains safe.
4. Verify the authenticated Hypixel player UUID and display name both agree with
   the resolved identity before returning analysis. Never accept PlayerDB avatar,
   metadata, or raw payload as product data.
5. Treat `player: configured` health as a binding/secret-presence check only. If
   both username and direct UUID reach Hypixel but return `503 forbidden`,
   validate and rotate the server-side credential without printing it.

### Stale or inconsistent economy data

1. Continue serving only the last complete real snapshot with a stale label.
2. Reject a cycle with stale, older, mixed, or incomplete source pages.
3. Let the durable lease/backoff and next reviewed trigger govern retry.
4. Never publish partial pages or fixture values as a coherent market snapshot.

### Database migration failure

1. Stop writes/jobs that require the new schema.
2. Preserve the database/export; never edit an applied migration in place.
3. Restore only through the tested recovery path or add a forward migration.
4. Run `npm run db:check` and `npm run db:smoke`, then verify foreign keys,
   representative rows, and application smoke tests.

## Retention, backups, and rollback

No production backup/restore or full retention policy is verified. The code
prunes Bazaar history to 90 days hourly and three years daily and bounds ended
sales, but account, audit, job, error, cache, and backup retention still need
operator decisions.

A Worker code rollback does not reverse D1 schema/data, restore deleted KV
namespaces, recreate secrets/service bindings, or change DNS. Roll back the web
and private economy Workers as a compatible pair, private economy first when
deploying forward. Preserve exports, use forward corrective migrations, and
keep the old owner-only Sites version only for a defined rollback window. See
[native Cloudflare setup](CLOUDFLARE_SETUP.md), [database
migrations](database/migrations.md), and [Security](../SECURITY.md).
