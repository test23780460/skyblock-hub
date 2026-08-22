# Testing and validation

## Commands

| Command | Coverage |
| --- | --- |
| `npm run lint` | ESLint across the repository. |
| `npm run typecheck` | Strict project TypeScript check. |
| `npm run test:engines` | Deterministic progression, valuation, accessories, economy, and planning engines. |
| `npm run test:services` | Catalog, profile, economy-history, money-making, and calculator orchestration. |
| `npm run test:providers` | Provider validation, native player/security boundaries, auth, persistence, AI, economy, and Worker behavior. |
| `npm test` | Default production build, all unit/service/provider suites, native config tests, and rendered-HTML tests. |
| `npm run db:check` | Validate Drizzle migration history and metadata. |
| `npm run db:smoke` | Apply all migrations to isolated SQLite and compare schema/FKs. |
| `npm run security:secrets` | Scan repository content with the project secret policy. |
| `npm run cf:types:check` | Regenerate Worker types in memory and fail if the checked types differ. |
| `npm run cf:economy:types:check` | Regenerate private economy Worker types in memory and fail if checked types differ. |
| `npm run cf:build:staging` | Build the native staging Worker/Static Assets composition. |
| `npm run cf:build:production` | Build the native production Worker/Static Assets composition. |
| `npm run cf:economy:dry-run:staging` | Validate the private staging economy Worker upload plan without deploying. |
| `npm run cf:economy:dry-run` | Validate the private production economy Worker upload plan without deploying. |
| `npm run cf:dry-run:staging` | Ask Wrangler to validate/upload-plan staging without deploying. |
| `npm run cf:dry-run` | Ask Wrangler to validate/upload-plan production without deploying. |

## Current migration-branch evidence

The exact-head 2026-08-21 suite contains **196 tests**: 40 engine, 16 service,
106 provider/security, and 34 rendered/configuration/legal. The focused
provider/security suite passes 105/105, including the shared dedicated D1
provider budget, Mojang/Hypixel admission split, private economy service
boundary, `ECONOMY_SERVICE` routing, public-host disablement, and separate
Wrangler configuration.

The current evidence must be read narrowly:

- focused provider/security and configuration checks establish the current test
  inventory and separate Worker topology; do not infer a remote deployment from
  those local checks;
- the application schema has five migrations and 37 tables; `npm run db:check`
  and `npm run db:smoke` pass, and the shared provider-budget database has its
  own one additive migration;
- web configurations contain Static Assets, isolated application D1/KV/rate
  bindings, shared `PROVIDER_BUDGET_DB`, `ECONOMY_SERVICE`, no Cron, and public economy off; private economy
  configurations have no public/preview URL, use only the matching D1, and also
  have no Cron with public economy off because the active-Auction crawl remains
  non-incremental and lacks Paid-plan/capacity evidence;
- lint, typecheck, secret scan, and both Worker type checks pass on this head;
- a prior local native Worker smoke (before this topology delta) recorded
  `/api/health` at 200 without revealing binding/secret names;
  `Justiwantdreams` returned 200 with three profiles and a repeat request used
  cache;
- no exact-head remote web/economy deployment or deployed service-binding smoke
  is inferred until those commands and URLs/version IDs are recorded.

The historical commit `3b4064d` and GitHub Actions run
[`31775265691`](https://github.com/test23780460/skyblock-hub/actions/runs/31775265691)
remain evidence for the older owner-only Sites rollback deployment only. They
are not exact-head native Cloudflare CI/deployment evidence.

## Important gaps

The repository still lacks complete browser E2E coverage for profile search and
selection, planning, Bazaar/Auctions, account/goal persistence, AI, and admin
permissions. It also lacks documented passing evidence for:

- cross-browser and device-matrix testing;
- automated accessibility and visual-regression testing;
- production/staging D1 migration plus backup/restore drills;
- exact-final-head remote Wrangler dry-runs and deployed web/private-economy
  Worker smoke in both environments;
- GitHub Workers Builds runs for the connected web and private-economy Workers;
- optional-account identity/session behavior;
- multi-region cache/coarse-filter behavior, D1 provider-budget monitoring, and
  approved Hypixel quota load evidence;
- long-term incremental economy ingestion/load/soak behavior, capacity evidence,
  and D1 cost monitoring;
- comprehensive dependency and application security scanning.

Do not treat a passing build, historical Sites smoke, or local Worker smoke as a
public launch. Keep the release gate open until the applicable checks and final
policy/security audits have exact-version evidence.
