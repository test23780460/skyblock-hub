# D1 to PostgreSQL Portability

## Boundary

Only the current adapter and schema/migrations are D1-specific. Domain/application services consume repository contracts in `lib/repositories/contracts.ts`. A PostgreSQL move creates:

1. a PostgreSQL Drizzle schema/migration chain;
2. a PostgreSQL implementation of the repository contracts;
3. a connection/composition module replacing the D1 binding;
4. export, transform, import, and verification tooling.

SkyBlock analyzers, progression rules, calculators, route response models, and UI must not be rewritten.

## Type mapping

| D1/SQLite | PostgreSQL target | Notes |
| --- | --- | --- |
| `text` ID | `text` or `uuid` | Keep text initially for lossless import; validate before optional UUID conversion. |
| epoch-ms `integer` | `timestamptz` | Convert in UTC and round-trip sample values. |
| boolean-mode `integer` | `boolean` | Convert only `0`/`1`; reject invalid legacy values. |
| JSON-mode `text` | `jsonb` | Validate every payload before import and add JSON indexes only for proven queries. |
| `real` Bazaar price | `double precision` or numeric | Choose numeric if later precision requirements justify it. |
| whole-coin `integer` | `bigint` | Repository contracts may need decimal strings if values exceed JavaScript safe integers. |

## Export/import order

Load parent tables before children:

1. users, items, feature flags, jobs, Minecraft accounts, public-economy worker/feed state;
2. external identities, roles/preferences, account links, profiles, Bazaar products, current public Bazaar/active-Auction rows, retained public ended sales;
3. saved profiles, goals/builds/favorites, general snapshots/aggregates, listings/sales/valuations;
4. steps/recommendations, overrides, runs, cache/analytics/audits/metrics/errors.

Defer or validate foreign keys during a controlled import, then enable them and verify zero orphan rows. Preserve all application IDs and uniqueness keys.

## Behavioral differences to test

- conflict/upsert behavior and nullable unique values;
- timestamp boundaries and ordering;
- JSON serialization and validation;
- case/collation behavior for normalized usernames and item search;
- transaction isolation and worker claim concurrency;
- SQL scalar functions used for metric increments and maximum latency;
- pagination plans and index selection on large economy tables.

Do not leak PostgreSQL-specific locking or query syntax into domain services. If workers need stronger claiming/transaction semantics, expose them through a dedicated adapter contract.

## Migration acceptance

A portable migration is complete when:

- counts match by table;
- foreign keys and uniqueness checks pass;
- representative user/profile/goal/build records round-trip;
- latest public Bazaar and active-Auction versions, retained ended sales, and valuations match;
- aggregate history retains bucket order and values when aggregation is activated;
- feature resolution returns the same result;
- jobs and metrics remain queryable;
- auth identities still resolve to the same canonical users;
- application integration and E2E suites pass against PostgreSQL;
- the D1 adapter can be removed from deployment configuration without editing business logic.
