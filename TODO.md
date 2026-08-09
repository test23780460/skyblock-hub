# SkyPilot Implementation Checklist

This checklist tracks the complete 149-section specification. It is an execution document, not evidence that a feature exists. Leave an item unchecked until its implementation and stated acceptance checks are verified in the current repository.

## Status and scope labels

- `[PROD]`: required to be production-ready for launch (including graceful behavior when optional credentials/data are unavailable).
- `[EXPERIMENTAL]`: may ship only behind the centralized experimental flag with a visible label; it must still be functional, safe, and tested within its documented limits.
- `[CONDITIONAL]`: implement only where current API data, reliability, and Hypixel policy permit; unsupported cases must explain the limitation and never fabricate data.
- `[DEFERRED-ARCH]`: the launch deliverable is architecture/flags, not active end-user functionality.
- `[EXTERNAL]`: code/integration must already be complete; a person must supply or activate an external credential, account, domain, or deployment.

Never place real secret values in this file, source control, fixtures, logs, client bundles, or `.env.example`. Credential values pasted into chat or another non-secret channel must be treated as exposed and replaced before production use.

## Current evidence snapshot — 2026-08-08

- Local `npm run lint`, `npm run typecheck`, and `npm test` pass.
- The production vinext build passes; 38 automated engine/service/provider/rendered-HTML tests pass with zero failures.
- The generated Drizzle history check passes, and the migration creates 30 SQLite tables with zero foreign-key-check findings in an isolated in-memory database.
- CI, Docker, hosting metadata, schema/repositories, policy documentation, and release documentation exist in the workspace; no commit, GitHub run, Docker runtime smoke test, production database, public deployment, or external activation is claimed by this evidence.
- Many module pages remain reference/planning surfaces. Unchecked items below are intentionally not inferred complete from UI copy, schemas, interfaces, or unit-tested engines alone.

## Phase 0 — Repository control, requirements, and branding

- [x] `[PROD]` Audit the existing repository, tests, routes, data flows, generated artifacts, Git status, and deployment configuration before changing architecture. Record verified gaps without deleting user work. **Evidence:** release inventory plus `docs/limitations.md`. (Req. 149)
- [x] `[PROD]` Keep `PROJECT_SPEC.md` and this checklist current; make completion evidence point to tests/builds rather than plans or scaffolding. **Evidence:** 149-section `PROJECT_SPEC.md`, this dated evidence snapshot, and `docs/testing.md`. (Req. 2, 117, 149)
- [x] `[PROD]` Make **SkyPilot** the centralized product name and configure site name, description, URL/domain, and logo in one branding module. Remove scattered legacy display-name literals without renaming the repository unless requested. **Evidence:** `lib/config.ts`, central metadata, and `public/og.png`; repository slug remains unchanged. (Req. 6)
- [ ] `[PROD]` Capture the product-level acceptance goal: an interconnected platform that tells a player what to do next and replaces disconnected companion tools. Reject isolated calculator-page UX. (Req. 1)
- [ ] `[PROD]` Establish the per-feature quality gate: implementation, integration, lint, typecheck, tests, production build, responsive/state/accessibility/navigation checks, failure fixes, and rerun. (Req. 4)
- [x] `[PROD]` Implement graceful missing-credential behavior, blank `.env.example` placeholders, and documented activation steps so one integration never blocks unrelated work. **Evidence:** blank secret placeholders, classified profile/AI unavailable responses, labeled demo, `docs/environment.md`, and `docs/setup.md`. (Req. 3, 99, 121, 135)
- [ ] `[EXTERNAL]` Before production, revoke/rotate any OpenAI or Hypixel credential previously pasted into chat and install the replacement only in the host’s secret store. Never reuse the exposed value. (Req. 80, 114, 138, 146)

## Phase 1 — Portable architecture and data foundation

- [x] `[PROD]` Define maintainable web/worker/shared-package boundaries for UI, config, database, Hypixel, SkyBlock, progression/recommendations, economy, valuation, calculators, and AI; keep transport, logic, persistence, calculation, and presentation separate. **Evidence:** `app/`, `components/`, `lib/providers/`, `lib/engines/`, `lib/services/`, `lib/repositories/`, `db/`, and `worker/jobs/`; documented in `ARCHITECTURE.md`. (Req. 84, 95, 123, 124, 136)
- [ ] `[PROD]` Centralize rarities, categories, skill definitions, constants, routes, and feature metadata; make skills, Slayers, items, currencies, areas, and progression systems data-driven/extensible. (Req. 88, 125, 126)
- [ ] `[PROD]` Implement provider boundaries for database, storage, cache, auth, scheduler, queue, analytics, and secrets so business logic does not depend on Sites or another host. (Req. 90, 91, 93, 94)
- [x] `[PROD]` Design PostgreSQL-compatible entities, relations, constraints, indexes, and migrations for users/auth/accounts/profiles, goals/recommendations/builds/favorites, items/Bazaar/Auctions/valuations/history, methods, flags/admin/analytics/metrics/errors/jobs; use JSON only for legitimately evolving attributes. **Evidence:** 30-table schema, 69 indexes, 28 foreign keys, 40 checks, generated migration, and provider-neutral repositories. (Req. 87, 88)
- [x] `[PROD]` Verify migrations from a clean database and document D1-to-PostgreSQL portability if D1 is used. Business logic must not depend on D1 behavior. **Evidence:** Drizzle history check and clean in-memory SQLite application pass; `docs/database/portability.md`. Production D1 and PostgreSQL import remain unverified. (Req. 92)
- [ ] `[PROD]` Implement worker jobs as scheduler-independent tasks for Bazaar refresh, auction/ended-sale ingestion, hourly/daily aggregates, valuations, cache cleanup, and maintenance. Make the worker externally deployable. (Req. 95, 96, 140)
- [ ] `[PROD]` Add centralized feature-flag configuration/service; default Discord, ads, premium, public profiles, Guild tools, price alerts, and experiments off. Avoid scattered boolean UI checks. (Req. 69, 71, 72, 99, 100)
- [ ] `[PROD]` Supply safe local-runtime and migration flows plus `Dockerfile`/`docker-compose.yml` where compatible; document any extra step after `docker compose up`. (Req. 97, 98)
- [ ] `[PROD]` Perform the portability thought test: web, backend, workers, database, storage, secrets, auth, jobs, and domain can leave Sites without rewriting SkyPilot logic. Refactor until true. (Req. 90–98, 118, 140, 141)

## Phase 2 — Design system, shell, public entry, and universal UX

- [ ] `[PROD]` Build a premium dark design system with centralized type, spacing, radii, shadows, surfaces, rarity/status colors, chart styles, controls, cards, tables, badges, and tooltips. Avoid generic dashboard/template aesthetics and excessive RGB effects. (Req. 7, 8, 143)
- [ ] `[PROD]` Implement tasteful hover/elevation, navigation, chart, tab, skeleton, stat/progress, expandable-detail, tooltip, and comparison interactions with reduced-motion support. (Req. 9)
- [ ] `[PROD]` Create purpose-built desktop/laptop/tablet/mobile layouts, adaptive navigation, mobile table alternatives, and usable small-screen charts. (Req. 10)
- [ ] `[PROD]` Implement uncluttered nested global navigation to every enabled product area; hide or label flagged work and verify every destination. (Req. 11, 122)
- [x] `[PROD]` Build the search-first homepage with concise all-in-one progression messaging and previews for progression, markets, Farming, AI, and item tools. **Evidence:** `app/page.tsx`, `components/HomeExperience.tsx`, and rendered-homepage test. (Req. 127)
- [ ] `[PROD]` Build a fast first-profile analysis reveal and a polished, uncluttered shareable profile summary card. (Req. 128, 129)
- [ ] `[PROD]` Add consistent skeleton loading, actionable empty states, and safe user-facing errors for player/profile/inventory absence, disabled API, upstream failure, rate limits, and delayed markets. Never show raw server errors. (Req. 109, 110, 111)
- [ ] `[PROD]` Meet keyboard, semantic HTML, labels, focus, ARIA, contrast, and reduced-motion accessibility requirements. (Req. 112)
- [ ] `[PROD]` Establish performance primitives: code splitting/appropriate SSR, caching, pagination/virtualization, optimized images, deferred loading, efficient queries/indexes, and bounded browser payloads. (Req. 113)
- [x] `[PROD]` Add public-page titles, descriptions, Open Graph/social metadata where appropriate, sitemap, and robots rules that exclude private account pages. **Evidence:** `app/layout.tsx`, route metadata, `app/sitemap.ts`, `app/robots.ts`, and `public/og.png`. (Req. 116)
- [ ] `[PROD]` Add contextual explanations for Magical Power, Farming Fortune, spread, liquidity, valuation confidence, and other expert concepts. (Req. 132)

## Phase 3 — Hypixel integration, permitted ingestion, and trust boundaries

- [x] `[PROD]` Review the current official Hypixel API docs and Player Data schema before implementing adapters; document schema assumptions and validate payloads. **Evidence:** dated `docs/policies/hypixel-api.md`, bounded normalization/guards, and provider tests. A fresh review is still required immediately before release. (Req. 77, 84, 114)
- [ ] `[PROD]` Implement one server-only Hypixel client with endpoint adapters, queue, shared cache, rate-limit manager, backoff, typed errors, metrics, and correct `429` handling; never use multiple keys to evade limits. (Req. 80, 82, 84)
- [x] `[PROD]` Prove the Hypixel key cannot enter client bundles, logs, responses, error telemetry, or an unrestricted proxy. Internal endpoints expose only required product data. **Evidence:** server-only header adapter, normalized product APIs, CI secret-pattern check, and provider tests proving public Bazaar omits the key. Final deployed asset/log scan remains a release audit. (Req. 80, 81, 114)
- [ ] `[PROD]` Apply configurable TTL classes for static metadata, request-driven profiles, shared Bazaar data, and centralized auctions. Eliminate direct page-to-Hypixel calls. (Req. 20, 83)
- [x] `[PROD]` Keep player lookup request-driven and cached; prohibit background profile polling, automated session tracking, mass monitoring, and player-base crawling. Separate player from public-resource pipelines. **Evidence:** user-triggered player routes/cache and separate public economy worker jobs; policy guide and provider tests. (Req. 20, 60, 63, 85)
- [ ] `[PROD]` Ingest permitted Bazaar, auctions, ended auctions, items, Collections, skills, and other public resources through centralized workers. (Req. 85)
- [ ] `[PROD]` Store bounded recent snapshots, hourly and daily aggregates, and long-term economy summaries; test retention/compaction for multi-year use. (Req. 86)
- [ ] `[PROD]` Parse NBT/item payloads defensively with limits and malformed fixtures so bad data cannot crash workers. (Req. 115)
- [ ] `[PROD]` Create versioned Hypixel fixtures for unit/integration/CI tests; label development/demo data and guarantee production cannot silently fall back to it. (Req. 119, 121)
- [ ] `[PROD]` Add visible data-age labels for profiles, Bazaar, Auctions, valuations, and other freshness-sensitive outputs. (Req. 76)
- [x] `[PROD]` Display Hypixel non-affiliation and ensure branding never implies endorsement. **Evidence:** About page, README, and policy documentation. (Req. 79)

## Phase 4 — Visitor profiles, accounts, goals, and recurring progress

- [ ] `[PROD]` Deliver username lookup → profile selection → complete dashboard without an account; do not gate basic analysis. (Req. 12, 14)
- [ ] `[PROD]` Implement optional accounts around canonical internal users, replaceable auth identities, saved usernames/accounts/profiles, preferences, favorites, builds, goals, recommendation state, and appropriate AI history. (Req. 13, 19, 94)
- [ ] `[PROD]` Implement goal templates/custom goals, decomposition into steps, remaining XP/hours/milestones, persistence, and goal progress UI. (Req. 18)
- [ ] `[PROD]` Persist recommendation actions—Complete, Ignore, Remind Later, Recalculate—and suppress completed recommendations appropriately. (Req. 19)
- [ ] `[PROD]` Implement configurable user-managed daily/weekly tasks with completion and recurring resets, independent of automated profile monitoring. (Req. 60)
- [ ] `[PROD]` Add shareable URLs for goals and selected analysis where practical; protect private data and authorization boundaries. (Req. 64)

## Phase 5 — Profile intelligence and progression core

- [ ] `[PROD]` Build the main dashboard with identity/profile, SkyBlock Level, finances, estimated net worth, Magical Power, skill average, Catacombs, Slayers, Minion slots, Museum, key gear/pet, strengths, and weaknesses. (Req. 14)
- [ ] `[PROD]` Normalize and analyze skills, gear, pets, accessories, Collections, Minions, Museum, Slayers, Dungeons, Garden, Mining, Rift, Bestiary, and unlocks; handle missing API fields explicitly. (Req. 21)
- [ ] `[PROD]` Build the priority engine across stage, gear, budget, goals, skills, MP/accessories, Slayers, Catacombs, Garden/Mining, pets, Collections, Minions, Museum, and prerequisites. (Req. 15, 16)
- [ ] `[PROD]` Every recommendation must explain action, reason, cost, benefit, prerequisites, priority/category, and coins per improvement where possible. Rank value over unaffordable vanity upgrades. (Req. 15, 16)
- [ ] `[PROD]` Implement preset/custom budget optimization from 1M through 1B and return ranked reachable upgrades. (Req. 17)
- [ ] `[PROD]` Implement Fix My Profile with Critical/High/Medium/Long Term roadmap, supported cost/benefit estimates, and links to the relevant tool. (Req. 67)
- [x] `[PROD]` Add consistent Best Value, Cheap Upgrade, High Impact, Long Term, Requires Grind, and Market Dependent badges. **Evidence:** recommendation model/engines and dashboard presentation. (Req. 131)
- [ ] `[EXPERIMENTAL]` If implemented, expose the internal progression score only as a clearly labeled SkyPilot analytical metric, never an official Hypixel stat. (Req. 130)

## Phase 6 — Gear, accessories, builds, and valuation inputs

- [ ] `[PROD]` Analyze armor, weapons, equipment, tools, and pets for reforges, enchants, stars, gemstones, attributes, recombobulation, rarity, item upgrades, and missing enhancements; recommend changes to owned gear. (Req. 22)
- [ ] `[PROD]` Compare weapons, armor, equipment, and pets using meaningful modeled deltas rather than lore-text diffs. (Req. 23)
- [ ] `[PROD]` Build the accessory optimizer: current MP, missing families/upgrades, cheapest options, coins/MP, target-gain plans, completion, powers, tuning, and applicable enrichments. (Req. 25)
- [ ] `[EXPERIMENTAL]` Implement functional saved/shareable build composition for armor, weapon, equipment, pet, and accessories/power behind the experiment flag when modeling confidence is incomplete. (Req. 24, 64)

## Phase 7 — Economy, Bazaar, Auctions, items, and money making

- [ ] `[PROD]` Build the economy dashboard with Bazaar/Auction trends, movers, volume, rises/falls, liquidity-aware margins, activity, popular products, and useful opportunities. (Req. 26)
- [ ] `[PROD]` Build Bazaar search/details with buy/sell/instant data, spread, volume/orders, weekly movement, price/volume history, trend, profit calculations, pagination, and freshness. (Req. 27, 75, 76)
- [ ] `[PROD]` Implement Bazaar flip scoring using spread, margin, profit/return, volume, liquidity, and opportunity quality; warn that estimates are not guaranteed. (Req. 28)
- [ ] `[PROD]` Implement craft-vs-buy calculations with ingredients, craft cost, sale value, fees, margin, and known unlocks. (Req. 29)
- [ ] `[CONDITIONAL]` Add legitimate NPC/Bazaar comparisons only where current mechanics and policy permit. (Req. 30)
- [ ] `[PROD]` Build Auction search/listings/BIN, lowest price, distributions, ending soon, ended sales, history, and variants with bounded/paginated browser payloads. (Req. 31, 113)
- [ ] `[PROD]` Build item valuation from base and modifiers plus actual sales, with High/Medium/Low confidence and explicit insufficient-data handling. (Req. 32)
- [ ] `[CONDITIONAL]` Calculate clearly labeled Estimated Net Worth across all API-visible account containers/categories and explain omissions. (Req. 33)
- [ ] `[PROD]` Build legitimate method catalog/comparison for Farming, Mining, Fishing, Dungeons, Slayers, Bazaar, Auction, Crafting, NPC, and other supported methods with coins/hour, setup, requirements, difficulty, capital, risk, and attention. (Req. 34)
- [ ] `[PROD]` Personalize money-making rankings using profile readiness, estimated output, and missing setup requirements. (Req. 35)
- [ ] `[PROD]` Build global item/player/Bazaar/tool search with autocomplete where practical and item pages containing lore/classification, markets/value/history, known crafts/relations, and progression relevance. (Req. 73, 74)
- [ ] `[PROD]` Use responsive interactive charts only for informative price/volume/history/composition/progress/comparison views, with tooltips and date ranges. (Req. 75)

## Phase 8 — Skills, Garden, and combat progression

- [ ] `[PROD]` Build the Skills hub for Farming, Mining, Foraging, Fishing, Combat, Enchanting, and Alchemy with level/XP/remaining progress, recommendations, equipment, and calculators. (Req. 36)
- [ ] `[PROD]` Make Garden a flagship module covering level/XP, Garden/milestones, Fortune, setup, visitors, pests, applicable plots, and crop analytics. (Req. 37)
- [ ] `[PROD]` Build an attributable Farming Fortune calculator across setup, enchants/reforges, pets, Garden/progression, applicable accessories, and crop bonuses. (Req. 38)
- [ ] `[PROD]` Rank supported Farming upgrades by coins per additional Fortune. (Req. 39)
- [ ] `[PROD]` Support all current major crops through data-driven configuration, including the ten named crops, and provide full Melon setup/progression recommendations. (Req. 40, 42)
- [ ] `[PROD]` Build current-level-to-target Farming XP/time/session calculation with transparent assumptions. (Req. 41)
- [ ] `[CONDITIONAL]` Add pest calculators/progression and Visitor offer/reward/value/progression tools only where reliable data exists; never fill gaps with fabricated values. (Req. 43, 44)
- [ ] `[PROD]` Build Mining around current HotM, Speed/Fortune, powder, commissions, gear/tools/gemstones/pets, and recommendations using current data. (Req. 45)
- [ ] `[PROD]` Build update-tolerant Foraging and Fishing modules with levels, progression, gear/tools/pets, available sea-creature data, recommendations, and supported calculators. (Req. 46, 47)
- [ ] `[PROD]` Build Combat progression guidance with no automation or unfair advantage. (Req. 48, 133)
- [ ] `[PROD]` Build Dungeons for Catacombs/classes, selected class, completions/floors/Master Mode, gear, stats/secrets where available, readiness, and goals. (Req. 49)
- [ ] `[PROD]` Explain cautious floor-readiness ratings and the factors/upgrades behind them without guaranteeing performance. (Req. 50)
- [ ] `[CONDITIONAL]` Add Dungeon profit calculations only from reliable current data and transparent assumptions. (Req. 51)

## Phase 9 — Slayers, Minions, Museum, Collections, Bestiary, and Rift

- [ ] `[PROD]` Build data-driven current Slayer categories with XP/levels/progress, unlocks, gear/progression, reasonable costs, and reliable profit support. (Req. 52)
- [ ] `[PROD]` Build Minion ownership/tier/slot/upgrades/fuel/storage views, the cheapest-next-slot optimizer, and configurable transparent profit calculations. (Req. 53, 54, 55)
- [ ] `[PROD]` Build Museum completion/missing contributions/unlocks and Collections completion/unlocks/easy-completion recommendations. (Req. 56, 57)
- [ ] `[CONDITIONAL]` Build Bestiary tracking and Rift progression/recommendations only from API-permitted available data, with explicit unavailable states. (Req. 58, 59)

## Phase 10 — Structured AI assistance

- [ ] `[PROD]` Implement the AI pipeline over question, player context, analyzers, current economy, progression, calculators, and relevant knowledge; prohibit model-invented numeric facts and deterministic-result overrides. (Req. 65, 66, 134)
- [ ] `[PROD]` Support personalized spending, MP, setup, next-step, Farming-time, money-making, and Dungeon questions grounded in structured context. (Req. 65)
- [x] `[PROD]` Provide Beginner, Normal, and Advanced response-detail modes. **Evidence:** AI page mode control and `/api/ai` validation/instructions. (Req. 68)
- [x] `[PROD]` When credentials/AI fail, preserve the entire non-AI application and show a clear unavailable state. **Evidence:** `/api/ai` returns `ai_not_configured`; AI UI explains deterministic tools remain available; full test suite passes without live AI. (Req. 135)
- [ ] `[PROD]` Add AI safety, latency/error handling, cost controls, sensitive-data redaction, and tests proving structured facts win conflicts. (Req. 106, 114, 119, 134, 135)

## Phase 11 — Administration, observability, and privacy

- [ ] `[PROD]` Protect a polished admin dashboard with server-side authorization and permission tests. (Req. 101, 114, 119, 120)
- [ ] `[PROD]` Add system status for web/database/workers/scheduler/cache/deployments/errors. (Req. 102)
- [ ] `[PROD]` Add Hypixel metrics for counts, errors/429s, latency, endpoints, cache-hit rate, remaining-limit data where available, and health. (Req. 103)
- [ ] `[PROD]` Add economy ingestion/valuation recency, counts, job state, and error views. (Req. 104)
- [ ] `[PROD]` Add privacy-respecting user/profile/activity/feature/search summaries. (Req. 105)
- [ ] `[PROD]` Add AI volume, token/cost estimate, failures, latency, and category summaries without unnecessary prompt logging; redact sensitive data. (Req. 106)
- [ ] `[PROD]` Add confirmed controls for flags, maintenance, targeted cache invalidation, job retry, safe ingestion triggers, and status. (Req. 107)
- [ ] `[PROD]` Implement replaceable, privacy-conscious analytics for page/profile/tool/calculator/recommendation/goal events without invasive collection. (Req. 108)

## Phase 12 — Experimental, conditional, and launch-deferred scope

- [x] `[DEFERRED-ARCH]` Keep broad player comparison low priority and do not build invasive comparison history. **Evidence:** no comparison crawler/history route or scheduled profile polling exists. (Req. 61)
- [ ] `[DEFERRED-ARCH]` Preserve future Guild interfaces/flags without treating advanced Guild tools as a launch requirement. (Req. 62)
- [ ] `[CONDITIONAL]` Implement only a legitimate reliable wealth board; otherwise use an opt-in board. Never crawl the player base. (Req. 63)
- [ ] `[EXPERIMENTAL]` Keep public profile sharing behind its dedicated flag and enforce privacy defaults. (Req. 64)
- [ ] `[DEFERRED-ARCH]` Provide disabled Discord OAuth/bot/linking/alert/command/reminder seams; do not launch active Discord notifications. (Req. 69)
- [ ] `[DEFERRED-ARCH]` Do not prioritize browser/price/flip notifications or recurring external reminders; preserve interfaces only where useful. (Req. 70)
- [ ] `[DEFERRED-ARCH]` Provide disabled reusable, non-deceptive ad slots without activating advertising. (Req. 71)
- [ ] `[DEFERRED-ARCH]` Keep premium disabled, avoid launch paywalls, and preserve future extensibility. (Req. 72)

## Phase 13 — Documentation, CI, QA, policy, security, and release

- [x] `[PROD]` Complete README, contributor/agent, architecture, security, API, database, feature, policy, testing, and deployment documentation. **Evidence:** `README.md`, `AGENTS.md`, `ARCHITECTURE.md`, `SECURITY.md`, `PROJECT_SPEC.md`, this checklist, and `docs/`. Feature status is consolidated in `docs/limitations.md` rather than falsely presenting every planned module as complete. (Req. 117)
- [x] `[PROD]` Document Sites, external hosting, and full migration of frontend/backend/workers/database/storage/secrets/auth/jobs/domain. **Evidence:** `docs/deployment/` and portability/database guides. (Req. 118)
- [ ] `[PROD]` Build meaningful unit/integration/API/progression/calculator/economy/valuation/parser/auth/permission suites on fixtures. (Req. 119)
- [ ] `[PROD]` Add E2E coverage for search → profile → dashboard, recommendations, budget optimizer, Bazaar, calculator, enabled account creation, goal save, and admin permissions. (Req. 120)
- [ ] `[PROD]` Verify production never silently displays mock/demo data as live and that every route/control is functional or correctly hidden/flagged. (Req. 121, 122)
- [x] `[PROD]` Configure CI for deterministic install, lint, typecheck, tests, and production build; keep credentials and generated junk out of Git. **Evidence:** `.github/workflows/ci.yml`, `.gitignore`, blank `.env.example`, and local validation pass. No successful GitHub run is claimed. (Req. 137, 138)
- [ ] `[PROD]` Perform visual QA on every major page at desktop/tablet/mobile sizes; fix spacing, type, empty areas, cards, tables, icons, overflow, navigation, alignment, and hierarchy. (Req. 142, 143)
- [ ] `[PROD]` Performance-test homepage, large profiles, Bazaar/Auction lists, item search, charts, admin, and mobile; fix measured/obvious bottlenecks. (Req. 113, 144)
- [ ] `[PROD]` Re-read current Hypixel policy immediately before release and audit polling, cache, keys/proxy/rate limits, branding, monetization, unfair functionality, and privacy. Current policy overrides conflicts. (Req. 20, 78–83, 133, 145)
- [ ] `[PROD]` Audit secrets, auth/authz/admin, injection, XSS, CSRF, abuse, logs, inputs, API errors, and external/NBT parsing; fix significant findings. (Req. 80, 114, 115, 146)
- [ ] `[PROD]` Run the final specification loop until no implementable gap, dead UI, placeholder, fake production data, state/mobile/accessibility issue, test failure, lock-in, or policy/security issue remains. (Req. 5, 148)
- [ ] `[PROD]` Prepare a stable, portable Sites deployment without damaging external-host support. Isolate unsupported workers rather than removing features. (Req. 89, 139, 140, 141)
- [ ] `[EXTERNAL]` Activate public hosting, production database/cache/storage, replacement secrets, auth providers, and domain when owner credentials/accounts are available. (Req. 3, 89, 99, 139, 147)
- [ ] `[EXTERNAL]` Activate AI only with a replacement OpenAI secret stored server-side; otherwise keep its graceful unavailable state. (Req. 3, 65, 99, 135, 147)
- [ ] `[EXTERNAL]` Activate live Hypixel requests only with a replacement Hypixel key stored server-side; otherwise retain fixture-backed development/tests and the production unavailable state. (Req. 3, 77, 80, 99, 147)
- [ ] `[PROD]` Produce the final report only after completion: systems, deployment/URL, external activation, exact validation results, genuine API/external limits, and optional future enhancements. (Req. 147)

## Release acceptance gate

- [ ] `[PROD]` Core profile lookup/dashboard/analysis, recommendations/Fix My Profile, gear/accessories, economy/Bazaar/Auctions/valuation/net worth, money making, skills/Garden, Dungeons/Slayers/Minions/Museum/Collections, supported Bestiary/Rift, goals, enabled account/AI paths, and admin work end to end. (Req. 12–68, 73–76, 101–108, 148)
- [ ] `[PROD]` Caching, rate limiting, workers, migrations, mobile/request states, accessibility, docs, CI, tests, and production build pass with recorded commands/results. (Req. 4, 77–126, 137, 142–148)
- [ ] `[PROD]` Policy, security, and hosting-portability audits pass, Sites deployment is prepared, and no placeholder is presented as finished. (Req. 5, 78–81, 89–98, 122, 133–141, 145–148)

## Requirement coverage index

| Requirements | Primary checklist phase |
| --- | --- |
| 1–6 | Phase 0 |
| 7–11 | Phase 2 |
| 12–14 | Phases 4–5 |
| 15–21 | Phases 4–5 |
| 22–25 | Phase 6 |
| 26–35 | Phase 7 |
| 36–51 | Phase 8 |
| 52–59 | Phase 9 |
| 60 | Phase 4 |
| 61–64 | Phase 12 (sharing also Phase 4/6) |
| 65–68 | Phases 5 and 10 |
| 69–72 | Phases 1 and 12 |
| 73–76 | Phases 3 and 7 |
| 77–86 | Phase 3 |
| 87–100 | Phase 1 |
| 101–108 | Phase 11 |
| 109–116 | Phases 2–3 and 13 |
| 117–122 | Phase 13 |
| 123–126 | Phase 1 |
| 127–132 | Phases 2 and 5 |
| 133–135 | Phases 3, 8, 10, and 13 |
| 136–141 | Phases 1 and 13 |
| 142–149 | Phases 0 and 13 |
