# Testing and Validation

## Commands

| Command | Coverage |
| --- | --- |
| `npm run lint` | ESLint across the repository. |
| `npm run typecheck` | Strict project TypeScript check. |
| `npm run test:engines` | Deterministic progression, valuation, accessories, Bazaar history, craft/NPC, money-making, skill, minion-slot, dungeon-readiness, and activity/Garden calculators. |
| `npm run test:services` | Game-data/skill-XP catalogs plus profile, Bazaar-history, money-making, and calculator service adapters. |
| `npm run test:providers` | Hypixel/item-NBT behavior, signed player-gateway authentication/bounds/rate ordering, mutation origins, saved state, goals, account deletion, AI grounding/metrics, economy history, and worker lease/backoff/admin checks. |
| `npm test` | Production build, all unit/service/provider suites, and rendered-HTML tests. |
| `npm run db:generate` | Schema-to-migration generation; not a test by itself. |
| `npm run db:check` | Validate Drizzle migration history against its metadata. |
| `npm run db:smoke` | Apply the complete migration chain to isolated SQLite and compare tables/FKs with the latest snapshot. |
| `npm run security:secrets` | Scan project content using the repository's secret-pattern policy. |

## Current local evidence

On 2026-08-14, the current workspace completed:

- `npm run lint`: pass;
- `npm run typecheck`: pass;
- `npm test`: pass;
- production vinext build: pass;
- 40 engine tests, 16 service tests, 88 provider/security tests, and 25 rendered-HTML tests: **169 passing, 0 failing**;
- Drizzle migration history check: pass;
- `npm run db:smoke`: four migrations, 36 tables, and zero foreign-key-check findings;
- repository secret-pattern scan: pass across 275 tracked project files;
- the earlier production dependency audit reported zero known vulnerabilities; the current retry could not reach the advisory endpoint in the sandbox, and the lockfile/dependencies are unchanged;
- one owner-authenticated live `Justiwantdreams` lookup and receipt-backed profile save passed; no broad cross-viewport, accessibility, or visual-regression pass was run.

Exact-head GitHub Actions run [`31775265691`](https://github.com/test23780460/skyblock-hub/actions/runs/31775265691) passed validation and Docker jobs for commit `3b4064d`. That commit is deployed at the [owner-only Sites preview](https://skypilot-skyblock.tratv.chatgpt.site), where live player lookup and receipt-backed profile saving passed. This is not complete automated browser E2E or a public launch; the local Docker daemon was not running, although the CI Docker build passed.

## Important gaps

The repository does not yet provide complete browser E2E coverage for profile search, profile selection, budget planning, Bazaar/Auctions, account/goal persistence, AI, and admin permissions. It also lacks documented passing results for:

- cross-browser and device-matrix testing;
- automated accessibility auditing;
- visual-regression snapshots;
- production D1 migration/backup/restore;
- live upstream smoke tests with replacement credentials;
- distributed cache/rate-limit behavior;
- load, soak, and long-term worker ingestion tests;
- external-host and public-Sites deployment smoke tests;
- comprehensive dependency and application security scanning.

Do not mark the release acceptance gate complete until those applicable checks and the full specification audits have evidence.
