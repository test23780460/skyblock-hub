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

The exact-head 2026-08-22 suite contains **203 tests**: 40 engine, 16 service,
113 provider/security, and 34 rendered/configuration/legal. The focused
provider/security suite passes 113/113, including the shared dedicated D1
provider budget, Minecraft/Mojang/PlayerDB/Hypixel admission split, strict
PlayerDB response and final Hypixel UUID/display-name validation, private economy service
boundary, `ECONOMY_SERVICE` routing, public-host disablement, and separate
Wrangler configuration.

The current evidence must be read narrowly:

- focused provider/security and configuration checks establish the current test
  inventory and separate Worker topology; local checks alone are not deployment
  evidence, so the remote staging result below is recorded separately;
- the application schema has five migrations and 37 tables; `npm run db:check`
  and `npm run db:smoke` pass, and the shared provider-budget database has its
  own one additive migration;
- all five migrations were applied to production application D1
  `skypilot-production` on 2026-08-22. A follow-up remote migration listing has
  nothing pending; read-only verification finds 39 SQLite tables (37 app plus
  two migration-bookkeeping tables), and `PRAGMA foreign_key_check` returns no
  rows. This proves neither backup/restore nor production traffic;
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
- application commit `75659fb2f3d6` is deployed to staging web Worker version
  prefix `ef2f930b` at
  `https://skypilot-staging.ptravis022.workers.dev`. `/api/health` returned 200
  with player configured and economy disabled, and the matching private-economy
  service binding resolved. A blank selector returned `400 invalid_input`;
  `NoSuchPilotzzzz` returned `404 player_not_found`; `Justiwantdreams` traversed
  the PlayerDB path and reached Hypixel; and it plus a known UUID returned the
  designed `503 forbidden` because the configured Hypixel credential was
  invalid. Direct provider validation independently returned HTTP 403 `Invalid
  API key` without recording the credential value;
- that version serves `/favicon.ico` and `/favicon.svg`, fixing the prior
  favicon console 404. Direct HTTP smoke returned 200 for all 28 current
  navigation destinations. Exact Playwright homepage checks at 1440x1000 and
  390x844 returned 200, found the configured title and favicon link, observed
  `innerWidth == scrollWidth`, and reported zero console and page errors;
- focused tests prove official transport/access fallback,
  official-not-found short-circuiting, bounded PlayerDB
  schema/username/UUID validation, final Hypixel UUID/display-name matching, no
  Hypixel-budget spend for identity-only traffic, cache behavior, and
  privacy-safe request fields. The staging smoke proves real Cloudflare
  PlayerDB egress/schema, input/not-found/error handling, and web-to-economy
  service resolution. The separate browser/route checks prove only the homepage
  invariants and direct status of current navigation destinations. Together
  they do not prove a valid credential, successful live player data or final
  identity agreement, production deployment/public launch, domain cutover, full
  interactive route E2E, accessibility, broad visual/performance/load or
  multi-region behavior, operational `429`/`Retry-After`, or GitHub Workers
  Builds.

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
- staging and provider-budget remote migration evidence plus production/staging
  backup/restore drills;
- production web/private-economy deployment and versioned service-binding smoke,
  plus a recorded staging private-economy Worker version;
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
