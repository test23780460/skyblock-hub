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
| Background jobs | `worker/jobs/` | Scheduler-independent Bazaar and Auction refresh functions with pluggable sinks. |
| Runtime edge | `worker/index.ts`, `vite.config.ts` | vinext/Cloudflare request handling, bindings, and image transformation. |

## Data paths

### Player lookup

```text
User request -> product API -> validated Minecraft username
  -> Minecraft identity lookup -> authenticated Hypixel player/profile calls
  -> bounded normalization -> deterministic analysis -> safe response
```

Player requests use a shared cache inside one runtime: one-hour fresh TTL and up to 24 hours stale-on-error. No timer, saved profile, account, goal, or worker triggers player polling.

### Public economy

```text
Public Hypixel feed -> bounded normalizer -> short shared cache
  -> current web view and/or scheduler-independent worker -> optional sink
  -> snapshots/aggregates/sales/valuation tables
```

The read routes work directly against normalized public feeds today. Worker functions exist, but production scheduling and a persistent sink are not yet composed.

### AI

The AI route receives a bounded question, detail mode, and optional structured context. Its instructions state that deterministic SkyPilot outputs are authoritative. It uses the OpenAI Responses API with `store: false`, a timeout, bounded output, and graceful unavailable states. The current UI attaches labeled demo context only; live selected-profile attachment is incomplete.

## Persistence

The schema has 30 normalized tables for canonical users and auth identities, Minecraft accounts/profiles, goals and recommendation state, builds/favorites/preferences, items and economy history, cache metadata, feature overrides, analytics/audits, jobs/runs, and API/AI/error metrics.

Application-generated text IDs, integer epoch-millisecond timestamps, explicit foreign keys, uniqueness, indexes, and checks keep the SQLite/D1 model migration-friendly. JSON is limited to evolving game/provider fragments and opaque settings/evidence.

See the [detailed architecture](../ARCHITECTURE.md) and [database guide](database/README.md).

## Portability boundary

Deterministic engines and repository contracts are host-neutral. The current executable web edge is not: it uses vinext, Cloudflare bindings, Sites identity headers, D1, and Cloudflare image services. External hosting therefore needs runtime/auth/database/cache/worker adapters described in [External hosting](deployment/external-hosting.md).

## Known architectural gaps

- cache, single-flight, Hypixel rate state, and AI request limiting are per-runtime memory;
- the feature-flag definitions/repository exist, but route/UI enforcement is incomplete;
- scheduled job registration, persistent economy sinks, aggregate retention, and valuation workers are not activated;
- the PostgreSQL adapter and full external worker/runtime composition are documented but not implemented;
- authenticated writes need deployment-specific CSRF/origin hardening and E2E permission tests.

