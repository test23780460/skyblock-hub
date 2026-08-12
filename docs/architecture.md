# Architecture Overview

SkyPilot separates user-facing routes, deterministic SkyBlock logic, external providers, persistence, and background jobs so missing credentials or a future hosting move do not require a product rewrite.

## Layers

| Layer | Current location | Responsibility |
| --- | --- | --- |
| Web/UI | `app/`, `components/` | Pages, request states, responsive presentation, and product API handlers. |
| Application services | `lib/services/`, `lib/analysis/` | Convert normalized profiles into calculator/recommendation inputs and response models. |
| Deterministic domain | `lib/engines/`, `lib/game-data/` | Progression, recommendations, accessories, economy scoring, valuation, net worth, and activity calculations. |
| Upstream providers | `lib/providers/` | Minecraft/Hypixel HTTP, validation, normalization, caching, backoff, and safe errors. |
| Persistence contracts | `lib/repositories/contracts.ts` | Provider-neutral records and interfaces used by business services. |
| D1 adapter | `db/`, `lib/repositories/drizzle/` | D1-compatible Drizzle schema, connection composition, and repository implementation. |
| Background jobs | `worker/jobs/` | Scheduler-independent elected public-economy cycle and normalized feed jobs. |
| Runtime edge | `worker/index.ts`, `vite.config.ts` | vinext/Cloudflare request handling, bindings, and image transformation. |

The generated Worker enables Cloudflare's `global_fetch_strictly_public`
compatibility flag because Hypixel's public API is itself Cloudflare-fronted.
This keeps outbound provider requests on the public route instead of treating
them as implicit same-zone Worker calls.

## Data paths

### Player lookup

```text
User request -> product API -> validated Minecraft username or Java UUID
  -> username: Minecraft identity lookup; authenticated Hypixel name fallback
     only after bounded transport failure
  -> UUID: skip identity lookup and validate against Hypixel player data
  -> authenticated Hypixel player/profile calls
  -> bounded normalization -> deterministic analysis -> safe response
```

Player requests use a shared cache inside one runtime: one-hour fresh TTL and up to 24 hours stale-on-error. No timer, saved profile, account, goal, or worker triggers player polling.

### Public economy

```text
Scheduled trigger or allowlisted admin request
  -> durable D1 lease + fencing token + global backoff
  -> public Hypixel feeds -> bounded normalizers
  -> complete Bazaar/active-Auction snapshot + deduplicated ended sales
  -> idempotent Bazaar hour/day aggregation + bounded retention
  -> product API reads D1 only -> bounded browser view
```

`worker/jobs/economy.ts` coordinates ended sales, Bazaar, and the complete active-Auction page set. The Bazaar job also aggregates each newer source timestamp into OHLC/average-volume hour/day buckets and prunes the configured 90-day/three-year windows. Mixed/stale/older cycles are not published, and stale workers cannot overwrite a newer lease. Public web routes never call Hypixel directly. The Cloudflare scheduled handler is implemented, but production migration and schedule registration remain external activation work.

### AI

The AI route receives a bounded question, detail mode, and selectors/scenario inputs—not client-supplied profile facts or prices. On the server it may resolve a labeled demo or request-driven live profile, progression/recommendation roadmap, fresh durable Bazaar rows, and one deterministic calculator result. The OpenAI Responses request uses `store: false`, a strict schema, bounded output, and a timeout; a post-validator rejects unknown evidence and unsupported/conflicting numeric claims. Metrics persist aggregate time buckets only. Broader item/accessory/money-making knowledge and distributed abuse limiting remain incomplete.

## Persistence

The schema has 36 normalized tables for canonical users and auth identities, Minecraft accounts/profiles, goals and recommendation state, builds/favorites/preferences, items and economy history, durable public-economy feeds/worker state/history buckets, cache metadata, feature overrides, analytics/audits, jobs/runs, and aggregate API/AI/error metrics.

Application-generated text IDs, integer epoch-millisecond timestamps, explicit foreign keys, uniqueness, indexes, and checks keep the SQLite/D1 model migration-friendly. JSON is limited to evolving game/provider fragments and opaque settings/evidence.

See the [detailed architecture](../ARCHITECTURE.md) and [database guide](database/README.md).

## Portability boundary

Deterministic engines and repository contracts are host-neutral. The current executable web edge is not: it uses vinext, Cloudflare bindings, Sites identity headers, D1, and Cloudflare image services. External hosting therefore needs runtime/auth/database/cache/worker adapters described in [External hosting](deployment/external-hosting.md).

## Known architectural gaps

- cache, single-flight, Hypixel rate state, and AI request limiting are per-runtime memory;
- the feature-flag definitions/repository exist, but route/UI enforcement is incomplete;
- production scheduled-trigger registration, Auction/item aggregation, and valuation/compaction workers are not activated;
- the PostgreSQL adapter and full external worker/runtime composition are documented but not implemented;
- authenticated browser writes require an explicit exact Origin and trusted Sites identity boundary; E2E permission tests and external-host CSRF/proxy composition remain incomplete.
