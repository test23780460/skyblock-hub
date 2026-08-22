# Hosting and data portability

SkyPilot's deterministic engines, provider normalization, repository
contracts, and scheduler-independent jobs are portable by design. The prepared
native web/private-economy executables are Cloudflare Workers-specific, while the older Sites bundle
is retained only as rollback history.

## Portable today

- deterministic progression, recommendation, accessory, economy, valuation,
  net-worth, and calculator engines;
- normalized Minecraft/Hypixel provider interfaces and bounded response models;
- provider-neutral persistence contracts and application-generated IDs;
- scheduler-independent economy feed jobs, lease/snapshot interfaces, and
  orchestration;
- React/vinext source, Docker web image, and standard npm validation commands.

## Cloudflare-specific composition today

- `worker/index.ts`, vinext, the Cloudflare Vite plugin, and Workers Static
  Assets, plus private `worker/economy.ts`;
- D1/Drizzle connection and SQLite migrations;
- Workers KV plus coarse route/authenticated-call Cloudflare rate-limit bindings
  and the dedicated shared `PROVIDER_BUDGET_DB` for request-driven player
  cache/admission; Mojang traffic does not consume the Hypixel budget;
- the disabled Cloudflare Access JWT adapter;
- the `ECONOMY_SERVICE` binding between environment-matched web/private Workers;
- Wrangler environments, generated web/economy Worker types, and Workers Builds scripts.

There is no native Images, R2, queue, or Durable Object dependency. The
`.openai/hosting.json`, Sites identity headers, browser capability, and separate
gateway remain legacy rollback mechanisms, not native runtime dependencies.

## Required adapters for another host

An external production deployment still needs:

1. a compatible web/server entry and static-asset strategy;
2. verified authentication mapped to canonical SkyPilot users;
3. a PostgreSQL or other repository adapter plus migration/export/import tools;
4. distributed cache and upstream-admission/rate-budget providers for multiple
   replicas;
5. a durable economy snapshot/lease implementation plus a scheduler;
6. deployment-specific secret management, logs/metrics/errors, backups,
   retention, and alerting;
7. secure cookie, CSRF/origin, trusted-proxy, and administrator controls.

`DATABASE_URL` and `REDIS_URL` are placeholders only; setting them does not
create those adapters. A host does not need object storage or an image service
unless a future feature introduces that requirement.

## Portability acceptance test

The product is not fully second-host portable until that host can:

- build and serve public and authenticated routes;
- resolve identities to the same canonical users without silently merging by
  email;
- apply a clean schema and import representative D1 data;
- run web and economy processes independently;
- coordinate cache/admission/job state across replicas;
- pass lint, typecheck, all tests, migration checks, and critical browser flows;
- preserve request-driven player lookup and separate public-economy ingestion;
- remove Cloudflare/Sites/D1 composition without changing SkyBlock domain logic.

See [External hosting](deployment/external-hosting.md), [migration](deployment/migration.md),
and [database portability](database/portability.md).
