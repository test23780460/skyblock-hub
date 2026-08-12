# External Hosting

SkyPilot’s business logic is portable, but the current executable web edge is Cloudflare/Sites-oriented. A Docker web image exists; it is not a complete external production stack.

## What works without rewriting

- deterministic engines and service adapters;
- Minecraft/Hypixel provider normalization and safe errors;
- repository contracts and application-generated IDs;
- Drizzle schema concepts and data export model;
- scheduler-independent elected economy cycle, snapshot-store contracts, and feed jobs;
- React/vinext application source and standard validation scripts.

## Required external composition

Before deploying to Vercel, Render, Railway, a VPS, Kubernetes, or another platform, provide:

1. a supported vinext/Workers-compatible runtime or a replacement server entry;
2. image/static asset handling replacing Cloudflare image bindings where necessary;
3. verified auth replacing Sites identity headers and mapping identities to canonical users;
4. deployment-specific secure cookies, CSRF/origin controls, trusted-proxy rules, and admin authorization;
5. a PostgreSQL/other repository adapter and migration chain, or a host that supports the current D1-compatible runtime;
6. shared cache, single-flight, Hypixel rate-budget, AI abuse limit, queue, and job-state providers for multiple replicas;
7. either reuse the D1 snapshot-store composition or provide an equivalent store adapter and scheduler for ingestion, aggregation, and valuation;
8. secret management, logs/metrics/errors, backups/restores, retention, and alerting;
9. the real HTTPS `SITE_URL`, domain/DNS/TLS, and robots/metadata validation.

`DATABASE_URL` and `REDIS_URL` are currently reserved; setting them alone does not enable an adapter.

## Docker status

`Dockerfile` builds the vinext project on Node 22 Alpine and starts `npm run start`. `docker-compose.yml` exposes the web service on port 3000 and optionally reads `.env`.

It does not include PostgreSQL/D1, Redis, migrations, an economy schedule, or external auth. Saved account/build/goal state, account deletion, aggregate AI metrics, durable economy/history reads, and Cloudflare-specific bindings may therefore be unavailable in the plain container. Treat a successful container build as a web build/runtime check, not proof of production completeness.

## External release checks

- build and serve the container/runtime in the target environment;
- prove all trusted proxy/auth headers cannot be spoofed;
- run a clean database migration plus representative data import;
- run web and worker instances independently and exercise shared state;
- execute critical browser flows and permission tests;
- verify graceful operation without optional AI;
- confirm public economy and player traffic use separate compliant policies;
- validate backup/restore and rollback;
- scan client assets/logs for secrets;
- run a current Hypixel policy and security audit.

See [Hosting migration](migration.md), [portability](../portability.md), and [database portability](../database/portability.md).
