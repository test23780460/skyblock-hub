# SkyPilot Architecture

## Goals

SkyPilot is organized around portable business capabilities rather than one hosting provider. The initial persistence implementation is Drizzle ORM over Cloudflare D1/SQLite, but application services depend on repository contracts and provider interfaces. Moving to PostgreSQL or another host should replace adapters and migrations—not progression, economy, recommendation, or UI logic.

The architecture follows these rules:

- server-only adapters own external APIs, secrets, persistence, queues, and schedulers;
- application/domain services own deterministic SkyBlock behavior;
- UI and route handlers consume internal services, never Hypixel or database primitives directly;
- player-profile retrieval remains request-driven and cached, while permitted public economy ingestion runs in workers;
- evolving game/provider fragments may use bounded JSON, but stable relationships stay normalized;
- missing external credentials disable only their integration.

## Runtime boundaries

```text
Browser
  ↓ product-specific route/API
Web runtime
  ↓ application service contracts
Domain services (profile, progression, economy, valuation, calculators, AI context)
  ↓ repository/external-provider interfaces
Adapters (Drizzle/D1, Hypixel, cache, queue, AI, analytics)
  ↓
D1/SQLite, workers, permitted external services
```

Heavy ingestion, aggregation, valuation, and cleanup belong in the worker runtime. Jobs are scheduler-independent functions; cron/Sites/Cloudflare/GitHub Actions or another scheduler merely invokes them. If a frontend host cannot execute workers reliably, the worker is deployed separately without removing product capabilities.

## Persistence boundaries

The portable contracts live in [`lib/repositories/contracts.ts`](lib/repositories/contracts.ts). They contain plain TypeScript records and interfaces with no Drizzle imports. The aggregate `RepositoryProvider` exposes narrower repositories for:

- identity and preferences;
- Minecraft accounts and SkyBlock profiles;
- goals and recommendation state;
- saved builds and favorites;
- economy data and valuations;
- cache metadata;
- feature evaluation;
- job runs;
- privacy-conscious telemetry and audit records.

The D1 implementation lives under [`lib/repositories/drizzle`](lib/repositories/drizzle). `createDrizzleRepositoryProvider` binds product repositories to Drizzle. The high-volume public feed path uses the narrower `PublicEconomySnapshotStore` contract in `lib/repositories/economy-snapshots.ts` and its fenced D1 adapter. Application services should accept the aggregate provider or the smallest repository/store interface they require.

New persistence backends should implement the same contracts in a sibling adapter directory. Contract changes must describe business needs, not SQLite syntax.

## Data model

The schema is split by domain under [`db/schema`](db/schema):

- `identity.ts`: canonical users, external identities, roles, and preferences;
- `player.ts`: Minecraft accounts, user links, SkyBlock profile identities, and saved profiles;
- `product.ts`: goals/steps, recommendation state, saved builds, and favorites;
- `economy.ts`: items, general Bazaar/Auction history/valuations, plus durable public worker/feed state, current Bazaar/active-Auction versions, and retained ended sales;
- `platform.ts`: cache metadata, flags/overrides, analytics, admin audit, jobs/runs, API/AI metrics, and application errors.

Stable identifiers and relationships are columns with foreign keys. JSON is limited to data whose shape legitimately evolves or is intentionally opaque at this layer, including item fragments, build definitions, recommendation evidence, goal targets, feature configuration, provider metadata, job payloads/results, and redacted telemetry context.

### Storage conventions

- IDs are application-generated text IDs (UUID, ULID, or another collision-safe format). This avoids database-specific sequences and supports idempotent ingestion.
- Timestamps are Unix epoch milliseconds in SQLite `INTEGER` columns and map to JavaScript `Date` through Drizzle.
- Booleans use SQLite integers through Drizzle boolean mode.
- Bazaar decimal prices use `REAL`; whole-coin auction and valuation amounts use `INTEGER`.
- Enumerated states are guarded both by TypeScript enum hints and SQL `CHECK` constraints.
- Foreign-key deletion is explicit: owned child records cascade, historical references that may outlive metadata use `SET NULL`.
- Query-path indexes cover identity lookup, user/profile lists, time-series access, active jobs/flags/cache records, and administrative/telemetry time windows.

Money values returned to JavaScript must remain within its safe integer range. If game values outgrow that assumption, the repository contract should migrate whole-coin values to decimal strings before precision is lost.

## Identity and privacy

`users.id` is SkyPilot’s canonical identity. OAuth/provider subjects are confined to `external_identities`; no business table depends on a Discord, Google, GitHub, ChatGPT, or email-provider ID. Minecraft identities are also independent global records and link to users through `user_minecraft_accounts`.

Analytics stores optional canonical user IDs or one-way anonymous hashes, never raw anonymous identifiers. Admin audit logs may retain a one-way IP hash rather than a raw address. AI aggregate metrics contain counts/cost/latency only; private prompts do not belong in metrics. Error context must be redacted before persistence.

## Player data versus economy data

`minecraft_accounts` and `skyblock_profiles` identify data fetched because a visitor requested it. Their freshness fields support request-driven caching; they are not permission to poll players or build automated session history.

Bazaar, active Auctions, and ended sales use centralized ingestion today. The elected worker publishes the latest complete Bazaar/active versions and bounded deduplicated ended sales, then idempotently folds newer Bazaar summaries into 90-day hourly and three-year daily OHLC/average-volume buckets; web routes read only those D1 views. Auction/item aggregation, broader long-term compaction, valuation jobs, items, and other permitted resources remain planned. Player and public-economy pipelines stay operationally and logically separate.

## Cache architecture

`cache_metadata` tracks ownership, freshness, expiry, ETag, size, hits/misses, and safe error codes. It deliberately does not force cache payloads into D1. A `CacheProvider` may store values in memory, KV, Redis, D1, or another backend while updating shared metadata for visibility and invalidation.

TTL policy belongs in centralized configuration by data class. Profile data is request-driven; static metadata can have a long TTL; Bazaar uses a short shared TTL; Auction data comes from ingestion.

## Feature flags

`feature_flags` defines centralized defaults and lifecycle (`production`, `experimental`, `deferred`, `retired`). `feature_overrides` applies a time-bounded global, user, or profile override. Resolution precedence is profile → user → global → default. UI code consumes the feature service result rather than querying these tables or scattering environment checks.

## Jobs and idempotency

`jobs` describes a logical job independent of scheduler configuration. `job_runs` records attempts, scheduling source, state, safe errors, and result metadata. Worker handlers should be idempotent, use deterministic uniqueness keys for ingested snapshots/sales/valuations, and update job state through the repository.

D1 does not provide every PostgreSQL transaction/locking primitive. Cross-record workflows must therefore use idempotent writes and adapter-supported atomic batches where required. Do not simulate distributed locks in domain code. A future PostgreSQL adapter may supply stronger transaction and claim semantics behind a dedicated unit-of-work/queue contract.

## Source of truth and AI

Official Hypixel APIs/documentation, permitted collected economy data, and deterministic calculators are authoritative. The AI route resolves bounded profile, progression, current Bazaar, and calculator context from server selectors; clients cannot submit their own facts or prices. Strict structured-output validation rejects unknown evidence and unsupported or conflicting numeric claims. AI may explain or prioritize authoritative results but cannot overwrite them, and AI unavailability cannot break profile, economy, or calculator features.

## Deployment portability

The initial D1 binding is constructed in [`db/index.ts`](db/index.ts). That file is an infrastructure composition edge, not a domain dependency. A non-Sites deployment replaces it with a backend-specific connection factory and provides a matching repository adapter.

Portability checks before release:

1. Domain/application code imports repository contracts, not Drizzle schema or D1 types.
2. Workers are callable independently of their scheduler.
3. Storage/cache/auth/analytics/secrets use provider interfaces.
4. Migrations and data export cover every durable table.
5. No secret or binding value is compiled into browser code.
6. The complete web and worker stack can run outside Sites without rewriting SkyBlock logic.

See [`docs/database/README.md`](docs/database/README.md), [`docs/database/migrations.md`](docs/database/migrations.md), and [`docs/database/portability.md`](docs/database/portability.md) for operational detail.
