# Hosting and Data Portability

SkyPilot’s deterministic engines, upstream-provider logic, repository contracts, and scheduler-independent job functions are portable by design. The current web executable is still Cloudflare/Sites-oriented.

## Portable today

- TypeScript progression, recommendation, accessory, economy, valuation, net-worth, and calculator engines;
- normalized Minecraft/Hypixel provider interfaces and safe response models;
- provider-neutral persistence contracts;
- application-generated IDs and normalized schema design;
- scheduler-independent elected economy cycle, feed jobs, and snapshot-store/lease interfaces;
- Docker web image and standard npm validation commands.

## Provider-specific today

- vinext Cloudflare Worker entry and image service;
- `.openai/hosting.json` binding conventions;
- D1 Drizzle connection, SQLite migrations, and durable economy snapshot-store adapter;
- Sites dispatch identity headers and reserved auth routes;
- in-memory cache/rate/AI throttling bound to each runtime;
- Vite Cloudflare plugin/local binding setup.

## Required external adapters

An external deployment needs:

1. a compatible web/server runtime entry and image strategy;
2. verified authentication mapped to canonical SkyPilot users;
3. a PostgreSQL or other repository adapter plus migrations/export-import tooling;
4. distributed cache, single-flight, rate-budget, queue, and scheduler providers for multi-replica use;
5. an economy snapshot-store adapter plus worker/scheduler deployment (or a runtime compatible with the current D1 adapter);
6. secret, analytics, logging/error, backup, and storage providers;
7. deployment-specific CSRF/origin, cookie, proxy-header, and abuse controls.

`DATABASE_URL` and `REDIS_URL` are reserved placeholders, not evidence that these adapters exist.

## Portability acceptance test

The product is not fully portable until a second host can:

- build and serve public and authenticated routes;
- resolve auth identities to the same canonical users;
- apply a clean schema and import representative D1 data;
- run web and worker processes independently;
- share cache/rate/job state across replicas;
- pass lint, typecheck, all tests, migration checks, and critical E2E flows;
- preserve profile request-driven policy and economy separation;
- remove Sites/D1 configuration without changing SkyBlock domain logic.

See [External hosting](deployment/external-hosting.md), [migration](deployment/migration.md), and [database portability](database/portability.md).
