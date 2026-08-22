# Architecture Overview

SkyPilot separates user-facing routes, deterministic SkyBlock logic, external providers, persistence, and background jobs so missing credentials or a future hosting move do not require a product rewrite.

## Layers

| Layer | Current location | Responsibility |
| --- | --- | --- |
| Web/UI | `app/`, `components/` | Pages, request states, responsive presentation, and product API handlers. |
| Application services | `lib/services/`, `lib/analysis/` | Convert normalized profiles into calculator/recommendation inputs and response models. |
| Deterministic domain | `lib/engines/`, `lib/game-data/` | Progression, recommendations, accessories, economy scoring, valuation, net worth, and activity calculations. |
| Upstream providers | `lib/providers/` | Minecraft/Hypixel HTTP, validation, normalization, caching, backoff, and safe errors. |
| Native player runtime | `worker/player-runtime.ts`, `lib/platform/cloudflare/` | Web-Worker-only Hypixel key, normalized KV/L0 cache composition, route-bound actor filtering, authenticated-Hypixel-call filtering, and atomic admission through the shared `PROVIDER_BUDGET_DB`. |
| Persistence contracts | `lib/repositories/contracts.ts` | Provider-neutral records and interfaces used by business services. |
| D1 adapter | `db/`, `lib/repositories/drizzle/` | D1-compatible Drizzle schema, connection composition, and repository implementation. |
| Background jobs | `worker/jobs/`, `worker/economy.ts` | Scheduler-independent elected public-economy jobs composed only by a private economy Worker. |
| Web runtime edge | `worker/index.ts`, `vite.config.ts`, `wrangler.jsonc` | vinext/Cloudflare request handling, Static Assets, environment bindings, and `ECONOMY_SERVICE`; it has no scheduled ingestion handler. |
| Economy runtime edge | `worker/economy.ts`, `wrangler.economy.jsonc` | Private service-binding/admin dispatch and optional future scheduled dispatch; `workers_dev` and preview URLs are disabled. |

Both generated Workers use compatibility date `2026-08-21` and enable
Cloudflare's `global_fetch_strictly_public` compatibility flag because
Hypixel's public API is itself Cloudflare-fronted. This keeps outbound provider
requests on the public route instead of treating them as implicit same-zone
Worker calls.

## Data paths

### Player lookup

```text
User request -> product API -> route-bound PLAYER_ACTOR_LIMITER coarse abuse check
  -> validated Minecraft username or Java UUID
  -> native web Worker player composition
  -> KV fresh/stale lookup
  -> username: Minecraft Services identity lookup with bounded Mojang fallback;
     if both are unavailable, return an actionable direct-Java-UUID path
     (no unsupported Hypixel name query and no Hypixel quota spent)
  -> UUID: skip identity lookup and validate against Hypixel player data
  -> on an authenticated Hypixel transport only: one coarse
     PLAYER_GLOBAL_LIMITER check + one two-token PROVIDER_BUDGET_DB reservation
  -> authenticated Hypixel player/profile calls
  -> bounded normalization -> deterministic analysis -> safe response
```

Hosted player requests use environment-isolated normalized Workers KV with a
one-hour fresh TTL and up to 24 hours stale-on-error, plus bounded per-isolate
L0 caching. Request-bound I/O promises are not retained for cross-request
single-flight. Cloudflare actor/shared rate bindings are coarse per-location
abuse filters. The actor binding is route-bound; Mojang calls do not spend
Hypixel quota. A fixed-window reservation in the dedicated
`PROVIDER_BUDGET_DB`, shared by staging and production, is the globally
consistent guard for the one shared Hypixel key. Each admitted authenticated
analysis reserves two tokens, and failure to reserve fails closed. The browser never
receives the key. No timer, saved profile, account, goal, or worker triggers
player polling.

### Public economy

```text
Cron Trigger -> private skypilot-economy Worker
Allowlisted admin request -> web Worker -> ECONOMY_SERVICE -> private economy Worker
  -> durable D1 lease + fencing token + global backoff
  -> public Hypixel feeds -> bounded normalizers
  -> complete Bazaar/active-Auction snapshot + deduplicated ended sales
  -> idempotent Bazaar hour/day aggregation + bounded retention
  -> product API reads D1 only -> bounded browser view
```

`worker/jobs/economy.ts` coordinates ended sales, Bazaar, and the complete
active-Auction page set. `worker/economy.ts` is the only native composition that
may invoke those jobs. The web Worker reads D1 snapshots and can only request a
bounded refresh through its environment-matched `ECONOMY_SERVICE` binding. The
private production and staging economy Workers expose neither `workers.dev` nor
preview URLs. Mixed/stale/older cycles are not published, and stale workers
cannot overwrite a newer lease. Every initial environment keeps both copies of
`ENABLE_PUBLIC_ECONOMY=false` and has no Cron. Workers Paid, all remote
migrations, capacity/usage monitoring, replacement of the current
non-incremental active-Auction crawl with a reviewed incremental or compacted
ingestion design, and exactly one reviewed production trigger are required
before activation.

### AI

The AI route receives a bounded question, detail mode, and selectors/scenario inputs—not client-supplied profile facts or prices. On the server it may resolve a labeled demo or request-driven live profile, progression/recommendation roadmap, fresh durable Bazaar rows, and one deterministic calculator result. The OpenAI Responses request uses `store: false`, a strict schema, bounded output, and a timeout; a post-validator rejects unknown evidence and unsupported/conflicting numeric claims. Metrics persist aggregate time buckets only. Broader item/accessory/money-making knowledge and distributed abuse limiting remain incomplete.

## Persistence

The schema has 37 normalized tables for canonical users and auth identities,
Minecraft accounts/profiles, goals and recommendation state,
builds/favorites/preferences, items and economy history, durable public-economy
feeds/worker state/history buckets, a portable provider-request budget table, cache
metadata, feature overrides, analytics/audits, jobs/runs, and aggregate
API/AI/error metrics. The active native credential reservation uses the same
table shape in a separate one-table `PROVIDER_BUDGET_DB`, not either
environment's application `DB`.

Application-generated text IDs, integer epoch-millisecond timestamps, explicit foreign keys, uniqueness, indexes, and checks keep the SQLite/D1 model migration-friendly. JSON is limited to evolving game/provider fragments and opaque settings/evidence.

See the [detailed architecture](../ARCHITECTURE.md) and [database guide](database/README.md).

## Portability boundary

Deterministic engines and repository contracts are host-neutral. The current
executable edges use vinext, Workers Static Assets, D1, KV/rate/service
bindings, a separate private economy Worker, and a disabled Cloudflare Access
adapter. External hosting therefore needs
runtime/auth/database/cache/worker adapters described in [External
hosting](deployment/external-hosting.md). Sites metadata and the separate player
gateway remain rollback code, not active native dependencies.

## Known architectural gaps

- Cloudflare abuse filtering is per location and Hypixel response-header backoff
  and AI request limiting remain per-isolate; the dedicated shared
  `PROVIDER_BUDGET_DB` is the global credential guard, but its configured
  capacity still needs production load/monitoring evidence;
- the feature-flag definitions/repository exist, but route/UI enforcement is incomplete;
- public-economy activation/monitoring remains off because the active-Auction
  crawl is non-incremental; a capacity-safe incremental replacement and
  Auction/item valuation/compaction workers are not activated;
- the PostgreSQL adapter and full external worker/runtime composition are documented but not implemented;
- authenticated browser writes require an explicit exact Origin plus a verified
  identity/session boundary; optional public accounts, E2E permission tests,
  and external-host CSRF/proxy composition remain incomplete.
