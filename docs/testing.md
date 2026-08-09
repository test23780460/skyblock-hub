# Testing and Validation

## Commands

| Command | Coverage |
| --- | --- |
| `npm run lint` | ESLint across the repository. |
| `npm run typecheck` | Strict project TypeScript check. |
| `npm run test:engines` | Deterministic calculators, progression, Bazaar, valuation, net worth, recommendations, and accessories. |
| `npm run test:services` | Game-data catalog and profile-to-engine service adapters. |
| `npm run test:providers` | Hypixel header/cache behavior, public-key omission, input/failure handling, normalization, and rate backoff. |
| `npm test` | Production build, all unit/service/provider suites, and rendered-HTML tests. |
| `npm run db:generate` | Schema-to-migration generation; not a test by itself. |
| `npm run db:check` | Validate Drizzle migration history against its metadata. |
| `npm run security:secrets` | Scan project content using the repository's secret-pattern policy. |

## Current local evidence

On 2026-08-09, this workspace completed:

- `npm run lint`: pass;
- `npm run typecheck`: pass;
- `npm test`: pass;
- production vinext build: pass;
- 17 engine tests, 11 service tests, 11 provider/security tests, and 7 rendered-HTML tests: **46 passing, 0 failing**;
- Drizzle migration history check: pass;
- generated migration applied to an in-memory SQLite database: 30 tables and zero foreign-key-check findings;
- repository secret-pattern scan: pass across 188 candidate files;
- production dependency audit: zero known vulnerabilities;
- interactive browser QA: clean desktop (1440x1000), mobile (390x844), and narrow mobile (320x720) layouts, native navigation, labeled demo loading, budget replanning, and zero final client-log errors.

This is local evidence, not proof that GitHub Actions or a public deployment has run successfully. The repository CI workflow repeats install, secret-pattern check, migration-history validation, lint, typecheck, tests/build, and a Docker build on GitHub. Docker is installed locally, but its daemon was not running during this pass, so the image build remains CI-verified work rather than a local success claim.

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
