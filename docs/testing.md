# Testing and Validation

## Commands

| Command | Coverage |
| --- | --- |
| `npm run lint` | ESLint across the repository. |
| `npm run typecheck` | Strict project TypeScript check. |
| `npm run test:engines` | Deterministic progression, valuation, accessories, Bazaar history, craft/NPC, money-making, skill, minion-slot, dungeon-readiness, and activity/Garden calculators. |
| `npm run test:services` | Game-data/skill-XP catalogs plus profile, Bazaar-history, money-making, and calculator service adapters. |
| `npm run test:providers` | Hypixel/item-NBT behavior, mutation origins, saved state, goals, account deletion, AI grounding/metrics, economy history, and worker lease/backoff/admin checks. |
| `npm test` | Production build, all unit/service/provider suites, and rendered-HTML tests. |
| `npm run db:generate` | Schema-to-migration generation; not a test by itself. |
| `npm run db:check` | Validate Drizzle migration history against its metadata. |
| `npm run db:smoke` | Apply the complete migration chain to isolated SQLite and compare tables/FKs with the latest snapshot. |
| `npm run security:secrets` | Scan project content using the repository's secret-pattern policy. |

## Current local evidence

On 2026-08-11, this workspace completed:

- `npm run lint`: pass;
- `npm run typecheck`: pass;
- `npm test`: pass;
- production vinext build: pass;
- 40 engine tests, 16 service tests, 50 provider/security tests, and 20 rendered-HTML tests: **126 passing, 0 failing**;
- Drizzle migration history check: pass;
- `npm run db:smoke`: four migrations, 36 tables, and zero foreign-key-check findings;
- repository secret-pattern scan: pass across 259 project files;
- the earlier production dependency audit reported zero known vulnerabilities; the current retry could not reach the advisory endpoint in the sandbox, and the lockfile/dependencies are unchanged;
- no fresh hydrated-browser, cross-viewport, accessibility, or visual-regression pass was run against this current source delta.

A prior source revision passed GitHub Actions, but the current workspace delta has no matching commit or remote CI run yet. Earlier owner-authenticated smoke checks covered the homepage, health route, sitemap, absolute metadata, and labeled demo at the [owner-only Sites preview](https://skypilot-skyblock.tratv.chatgpt.site); they do not cover the current saved-state, history, AI, item, or planning changes. No public launch is claimed. Docker is installed locally, but its daemon was not running during this pass, so the current container path has not been re-smoked locally.

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
