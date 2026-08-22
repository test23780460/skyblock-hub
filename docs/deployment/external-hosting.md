# External hosting

SkyPilot's business logic is portable, but the prepared executable edge uses
vinext on Cloudflare Workers with Static Assets, D1, KV, and rate-limit
bindings. A Docker web image exists; it is not a complete external production
stack.

## What works without rewriting

- deterministic engines and service adapters;
- bounded Minecraft/Hypixel provider normalization and safe errors;
- repository contracts and application-generated IDs;
- Drizzle schema concepts and export model;
- scheduler-independent economy jobs and snapshot/lease contracts;
- React/vinext application source and standard validation scripts.

## Required external composition

Before deploying to Vercel, Render, Railway, a VPS, Kubernetes, or another
platform, provide:

1. a supported server entry plus static-asset handling;
2. verified auth replacing the disabled Cloudflare Access adapter and mapping
   provider subjects to canonical users without email-only merging;
3. secure cookies/session storage, CSRF/origin controls, trusted-proxy rules,
   and admin authorization;
4. a PostgreSQL/other repository adapter and migration chain, or a runtime that
   deliberately preserves D1 compatibility;
5. shared cache and upstream-admission/rate-budget providers for multiple
   replicas;
6. a durable economy snapshot/lease adapter and exactly one scheduler after
   plan, migration, and monitoring gates are satisfied;
7. secrets, redacted logs/metrics/errors, backups/restores, retention, alerts,
   domain/DNS/TLS, and metadata validation.

No object-storage or image-transform service is currently required. Add one
only if a future feature creates that need. `DATABASE_URL` and `REDIS_URL` are
reserved placeholders; setting them alone does not implement an adapter.

## Docker status

`Dockerfile` builds the vinext project on Node 22 Alpine and `docker-compose.yml`
exposes only the web process on port 3000. The Compose path does not include a
database, distributed cache/admission, migrations, an economy scheduler, or
external auth. A successful container build proves only that web image.

## External release checks

- build and serve the exact target version;
- prove auth and proxy headers cannot be spoofed;
- run a clean database migration and representative import;
- run web/economy processes independently and exercise shared state;
- verify request-driven player lookup never becomes scheduled monitoring;
- run critical browser, owner-isolation, permission, accessibility, and error
  flows;
- verify graceful operation without optional AI;
- validate backup/restore, rollback, logs, and artifact secret scans;
- confirm the current Hypixel policy, Production approval, quota/rate controls,
  and public-economy plan/cost posture.

See [Second-host migration](migration.md), [portability](../portability.md), and
[database portability](../database/portability.md).
