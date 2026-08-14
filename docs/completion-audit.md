# Completion Audit

This audit maps the 149 numbered sections in `PROJECT_SPEC.md` to direct evidence in the current workspace. It does not use checklist marks or product copy as proof.

## Status rules

- **Complete**: the requested behavior is implemented and has proportionate source/test evidence.
- **Partial**: useful implementation exists, but one or more stated acceptance details are not end to end.
- **Deferred**: the requested product behavior is not implemented beyond a flag, schema, catalog, generic planning surface, or intentionally future architecture.
- **Blocked**: the remaining action requires owner/provider/deployment authority. A blocked activation does not excuse a separate code gap.

Current audited totals: **38 Complete, 88 Partial, 20 Deferred, and 3 Blocked** (149 sections).

## Validation snapshot

Fresh local validation on 2026-08-14 passed:

- `npm run lint`;
- `npm run typecheck`;
- `npm run db:check`;
- `npm run db:smoke` (4 migrations, 36 tables, 0 foreign-key findings);
- `npm run security:secrets` (270 project files);
- `npm test`, including the production build and 40 engine, 16 service, 72 provider/security, and 25 rendered-HTML tests (153 passing, 0 failing).

Rendered HTML tests prove route/build output, not hydrated browser behavior. No live provider credential, production D1 migration, public deployment, or current-source GitHub Actions run is inferred from these local results.

## Requirement-by-requirement map

| # | Section | Status | Direct evidence or remaining gap |
| ---: | --- | --- | --- |
| 1 | Primary product vision | **Partial** | A coherent shell now joins profile analysis, saved state, goals, current/history economy views, money-making, optimizers, calculators, and grounded AI; several deep profile/domain replacements remain incomplete. |
| 2 | Autonomous build requirement | **Complete** | `PROJECT_SPEC.md`, `TODO.md`, this audit, and repeatable validation commands preserve scope and evidence. |
| 3 | External blocker rule | **Complete** | Safe-default feature gates and classified unavailable states isolate missing Hypixel, OpenAI, auth, D1, and deployment activation. |
| 4 | Continuous quality loop | **Partial** | Lint, typecheck, build, 153 automated tests, migration smoke, and secret scanning pass; full browser, accessibility, visual, performance, and live-integration loops do not. |
| 5 | Final completion loop | **Deferred** | The release gate cannot pass while the end-to-end gaps below remain. |
| 6 | Product name and centralized branding | **Complete** | `lib/config.ts`, root metadata, sitemap, About content, and `public/og.png` use SkyPilot centrally. |
| 7 | Design quality | **Partial** | `app/globals.css` and the shared shell are cohesive, but no complete cross-page visual acceptance pass exists. |
| 8 | Visual language | **Partial** | Central dark tokens, surfaces, status/rarity accents, cards, and controls exist; chart and item-visual systems are incomplete. |
| 9 | Microinteractions | **Partial** | Focus, hover, loading skeleton, pressed state, progress, and reduced-motion behavior exist; chart/tooltip/comparison interactions are incomplete. |
| 10 | Responsive design | **Partial** | Breakpoints and mobile navigation/table overflow exist; broad viewport/device regression evidence is missing. |
| 11 | Global navigation | **Complete** | `components/SiteShell.tsx` exposes grouped desktop navigation and a compact mobile navigation to product destinations. |
| 12 | No-account experience | **Partial** | Username lookup, profile selection, dashboard states, item coverage, and public planners work without an account when their data gates are enabled; the requested complete live dashboard is not finished. |
| 13 | Optional accounts | **Partial** | Canonical identity, saved accounts/profiles, preferences, favorites, builds/sharing, goals, and deletion are owner-scoped end to end; recommendation actions, appropriate AI history, and portable non-Sites auth remain incomplete. |
| 14 | Main player dashboard | **Partial** | `DashboardExperience` shows profile selection, core stats, skills, signals, budget, recommendations, bounded item coverage, and detected gear; live pet, priced net worth, minion slots, and Museum remain absent or null. |
| 15 | What should I do next? | **Partial** | Deterministic ranking and explanations are wired; live analysis currently produces only sparse unpriced candidates. |
| 16 | Progression priority engine | **Partial** | The tested engine supports budgets, prerequisites, stages, and categories, but live inputs do not cover the full profile. |
| 17 | Budget recommendations | **Partial** | Presets/custom budgets and aggregate budget enforcement work; unpriced live candidates are deferred, so the rich path is mainly demo/manual. |
| 18 | Goal system | **Partial** | Owner-scoped create/read/update/complete/pause/resume/reset/delete and manual recurring cycles work; semantic XP/hour/cost decomposition and persisted editable steps do not. |
| 19 | Recommendation history | **Partial** | Schema/repository support exists and dashboard actions work for a visit; the buttons are not connected to durable recommendation state. |
| 20 | Player history policy | **Complete** | Player lookup is request-driven/cached and separate from scheduled public economy ingestion; no profile polling or mass tracking exists. |
| 21 | Profile analyzer | **Partial** | Mojang/Hypixel normalization covers core stats, skills, Catacombs, Slayer, MP, bounded item containers, gear/accessory identities, and safe unavailable states; pets and several progression domains remain missing. |
| 22 | Gear analyzer | **Partial** | The request-driven profile path safely detects equipped armor/equipment plus carried weapons/tools, rarity, stars, and recombobulation; enchant/reforge/gemstone/attribute appraisal and owned-gear upgrade advice remain absent. |
| 23 | Gear comparison | **Deferred** | The current gear surface is a generic manual lab, not a modeled weapon/armor/equipment/pet comparison. |
| 24 | Future build creator | **Complete** | `/builds` provides a visibly experimental manual armor/weapon/equipment/pet/accessory composer; signed-in users can create, edit, profile-link, favorite, delete, and share private/unlisted/public builds with rotatable slugs. |
| 25 | Accessory system | **Partial** | `AccessoryOptimizerExperience` uses the exact family-aware engine with editable ownership/prices/budget/target MP, and profile normalization exposes bounded accessory identities; live bag import, powers, tuning, enrichments, and a full catalog remain absent. |
| 26 | Economy dashboard | **Partial** | The economy command center connects current/history Bazaar, Auctions, and working craft/NPC labs; cross-market movers, popular-product activity, and consolidated trend/opportunity ranking remain incomplete. |
| 27 | Bazaar | **Partial** | The durable snapshot UI/API covers up to 250 products, buy/sell summaries, spread, volume, orders, weekly movement, fee-aware profit math, freshness, and keyboard-accessible 24H/7D/30D/1Y price/volume history; UI search is limited to the loaded slice and summary prices are not exact instant execution. |
| 28 | Bazaar flips | **Complete** | `scoreBazaarFlip` and `BazaarExperience` calculate fees, margin, return, liquidity, risk, and opportunity quality with non-guarantee notices. |
| 29 | Craft flips | **Partial** | The deterministic craft lab covers entered ingredients/quantities, fixed cost, output, sale price, fees, margin/return, break-even, and unlock state; it has no current recipe catalog, live ingredient prices, or profile unlock evidence. |
| 30 | NPC/Bazaar opportunities | **Partial** | The manual two-way lab ranks only routes with explicit prices and verified remaining limits, including fees/returns/blockers; current policy-validated item mechanics, limits, and live prices are not supplied by SkyPilot. |
| 31 | Auction House | **Partial** | A durable complete active snapshot supports snapshot-wide item search, BIN/listing fields, pagination, sorting, and ending times; distributions, variants, ended-sales UI, and history are missing. |
| 32 | Item valuation engine | **Partial** | A confidence/outlier-aware engine is tested and bounded item summaries expose safe rarity/star/recombobulation evidence; current comparable sales and variant pricing are not joined into a user-facing valuation. |
| 33 | Net worth | **Partial** | A deduplicating aggregation engine and bounded inventory identities exist, but current price evidence and several containers are not joined, so dashboard net worth remains honestly unavailable. |
| 34 | Money-making section | **Partial** | `/money-making` covers every requested method family with editable hourly ranges/costs, requirements, capital, difficulty, risk, and attention; its rates/setups are labeled reference scenarios rather than current method evidence. |
| 35 | Personalized money making | **Partial** | The deterministic service derives bounded profile readiness/capital, blocks unknown or unverified setup evidence, and ranks cautious/expected/optimistic output with named gaps; gear, routes, current economy, and most setup facts still require manual verification. |
| 36 | Skills hub | **Partial** | The focused seven-skill planner uses centralized level caps/XP, reports current/target/next-level XP and time/sessions, and profile analysis shares that curve; per-skill equipment and detailed recommendations remain incomplete. |
| 37 | Farming/Garden | **Partial** | `GardenOptimizerExperience` provides crop-specific Fortune attribution, expected yield, editable rates, budget, and upgrade ranking; Garden progression, visitors, pests, plots, and profile setup are absent. |
| 38 | Farming Fortune calculator | **Partial** | The Garden engine attributes grouped skill/armor/tool/pet/Garden/crop sources; full profile-derived enchant/reforge/accessory/progression attribution is not present. |
| 39 | Farming upgrade optimizer | **Complete** | The Garden engine ranks editable candidates by coins per incremental Fortune and reports yield/value deltas and affordability. |
| 40 | Crops | **Partial** | The named ten crops are selectable; the list is static and does not cover all current resource-driven crop data. |
| 41 | Farming XP/time calculator | **Complete** | The Farming and core-skill planners accept current/target levels or normalized XP, use one versioned XP curve, and expose remaining XP, effective rate, hours, and sessions with editable assumptions. |
| 42 | Melon support | **Partial** | Melon is supported by the generic crop optimizer, but a complete Melon tool/armor/equipment/pet/progression analyzer is absent. |
| 43 | Pests | **Deferred** | No reliable pest calculator/progression surface is implemented. |
| 44 | Visitors | **Deferred** | No Visitor offer/reward/cost/progression evaluator is implemented. |
| 45 | Mining | **Partial** | The core-skill planner covers Mining level/XP/target/time and the money-making ranker can use visible Mining level; HotM, powder, commissions, tools, gemstones, and dedicated recommendations remain absent. |
| 46 | Foraging | **Partial** | The centralized planner provides Foraging level-to-target XP/time with editable rates; current progression systems, tools, gear, pets, and a dedicated update-tolerant module remain absent. |
| 47 | Fishing | **Partial** | The centralized planner and money-making readiness model cover Fishing level/XP/time and visible prerequisites; gear, pets, sea creatures, and a dedicated progression module remain absent. |
| 48 | Combat | **Partial** | Normalized Combat XP/level and the focused core-skill planner provide safe target/time guidance used by readiness tools; detailed progression recommendations remain missing. |
| 49 | Dungeons | **Partial** | `/dungeons` now combines a working Catacombs run/profit planner with official entry gates and an evidence-based readiness evaluator; classes, completions, profile gear, secrets, and goals remain incomplete. |
| 50 | Floor readiness | **Complete** | The tested evaluator separates official Combat/Catacombs/prior-floor entry gates from editable setup checkpoints, reports cautious readiness states and ranked deficiencies, and explicitly disclaims performance guarantees. |
| 51 | Dungeon profit | **Complete** | The focused planner estimates attempts, completions, time, reward, chest/attempt costs, and net result from explicit assumptions. |
| 52 | Slayers | **Partial** | `/slayers` opens a working XP/time/net-cost planner and central category catalog exists; per-category unlocks/gear/progression/live data are incomplete. |
| 53 | Minions | **Partial** | `/minions` combines configurable production/profit planning with an exact editable tier-path slot optimizer; live ownership/crafted tiers, current slots, fuels/upgrades, and storage views remain missing. |
| 54 | Minion slot optimizer | **Partial** | The deterministic optimizer exactly minimizes entered cross-family tier paths while preserving prerequisites and reports budget/reachability; its UI is limited to four illustrative fixed families rather than live or freely extensible craft data. |
| 55 | Minion profit | **Complete** | The focused planner exposes action time, outputs, fuel/upgrades, uptime, selling price, operating cost, and duration assumptions. |
| 56 | Museum | **Deferred** | No live completion/missing-contribution/unlock system is wired. |
| 57 | Collections | **Deferred** | No live completion/unlock/easy-completion system is wired. |
| 58 | Bestiary | **Deferred** | No reliable API-backed Bestiary tracking is wired. |
| 59 | Rift | **Deferred** | No reliable API-backed Rift progression/recommendation system is wired. |
| 60 | Daily/weekly system | **Complete** | Saved goal lists support daily/weekly cadence, progress updates, completion, and explicit next-cycle reset without background player monitoring. |
| 61 | Player comparison | **Complete** | Broad/invasive comparison is intentionally absent and no comparison polling/history exists. |
| 62 | Guilds | **Deferred** | A disabled feature flag/catalog seam exists; no Guild interface is implemented. |
| 63 | Leaderboards | **Deferred** | No crawler or leaderboard exists; an opt-in/reliable board architecture is also absent. |
| 64 | Sharing | **Partial** | Privacy-enforced unlisted/public build URLs with rotatable unguessable slugs work; goal/analysis sharing and feature-gated public profiles are not implemented. |
| 65 | AI SkyBlock assistant | **Partial** | The optional assistant now accepts selectors rather than client facts and grounds answers in server-resolved profile, progression, current Bazaar, roadmap, and one deterministic calculator; accessory/money-making/item knowledge and complete personalized coverage remain incomplete. |
| 66 | AI architecture | **Partial** | The server composes validated question, profile analysis, current non-stale economy, progression/roadmap, and calculator output into a bounded authoritative context; broader knowledge/domain services and distributed production abuse controls remain incomplete. |
| 67 | Fix My Profile | **Partial** | A deterministic roadmap service is tested, but the dashboard does not render the roadmap and live recommendations lack prices/full categories. |
| 68 | Beginner/Normal/Advanced AI | **Complete** | All three modes are selectable, validated, and mapped to server instructions. |
| 69 | Discord | **Deferred** | No active Discord integration exists, as intended; the requested disabled OAuth/bot/interface seam and dedicated flag are missing. |
| 70 | Notifications | **Deferred** | No browser/price/flip/external reminder system is active; future provider architecture is minimal. |
| 71 | Advertising | **Deferred** | Advertising defaults off, but reusable labeled ad slots are not implemented. |
| 72 | Premium | **Deferred** | Premium defaults off and no launch paywall exists; a replaceable premium adapter is not implemented. |
| 73 | Item database | **Deferred** | Bounded request-driven item summaries now exist, but no centrally ingested searchable item catalog/pages with markets, crafts, history, related items, and relevance is populated. |
| 74 | Global search | **Partial** | Global player search and local Bazaar/Auction search work; unified player/item/product/tool autocomplete does not. |
| 75 | Charts | **Partial** | Bazaar exposes a responsive keyboard-navigable price/volume history chart with four date ranges and detailed bucket tooltips; net-worth, goal, item, and broader comparison charts remain absent. |
| 76 | Data freshness | **Partial** | Profile, current economy, and Bazaar-history source/aggregation ages and cache states are shown; valuation and several other modules have no freshness path. |
| 77 | Hypixel API | **Complete** | Official endpoints are isolated behind typed normalizers with bounded validation and provider tests. |
| 78 | Hypixel policy | **Partial** | A dated policy guide and compliant request/public-feed boundaries exist; an immediately pre-release re-review is still required. |
| 79 | Hypixel non-affiliation | **Complete** | Footer, About, README, and API notices clearly disclaim affiliation/endorsement. |
| 80 | API key security | **Complete** | The Hypixel key is blank in `.env.example`, server-only, header-only, absent from public economy calls, and covered by provider/secret scans. Exposed credentials still require external rotation before activation. |
| 81 | No API proxy | **Complete** | Internal routes return bounded product models and never proxy arbitrary Hypixel paths/raw payloads. |
| 82 | Rate limiting | **Partial** | Central provider backoff/rate state and a durable elected economy circuit with fencing exist; there is no shared player queue/distributed budget/full metrics. |
| 83 | Caching | **Partial** | Player requests use centralized single-flight/stale cache and economy reads durable D1 snapshots; profile cache/limits are per-runtime and TTL classes are not configuration-driven. |
| 84 | API adapters | **Complete** | UI calls internal routes; upstream calls live in provider/worker adapters and normalized services. |
| 85 | Data ingestion | **Partial** | A scheduled, lease-fenced worker ingests Bazaar, complete active Auctions, and ended sales into D1; items/Collections/skills/resources are not ingested. |
| 86 | Historical economy data | **Partial** | Worker-built idempotent Bazaar OHLC/average-volume buckets retain hourly evidence for 90 days and daily evidence for three years, while ended sales remain bounded/deduplicated; auction/item valuation summaries and broader compaction remain absent. |
| 87 | Database | **Complete** | `db/schema/**`, four checked migrations, 36 normalized tables, constraints/indexes/FKs, repositories, and clean migration smoke evidence cover the specified durable domains. |
| 88 | Data-model flexibility | **Partial** | Stable relations are normalized and evolving fragments use bounded JSON, but complete resource/version update ingestion is absent. |
| 89 | Initial hosting target | **Blocked** | An earlier owner-only Sites preview/config exists, but the current workspace is not deployed; production D1, scheduler, current-source publish, public access, and domain require deployment authority. |
| 90 | Zero hosting lock-in | **Partial** | Engines/contracts/jobs are portable; vinext/Workers, D1, Sites auth, images, and runtime composition remain provider-specific. |
| 91 | Infrastructure abstractions | **Partial** | Repository, economy store/sink, provider, and scheduler-independent job boundaries exist; cache/rate/queue/auth/storage/analytics/secrets adapters are incomplete. |
| 92 | Database portability | **Partial** | Canonical repository contracts, app-generated IDs, SQLite-safe normalized schema, and D1-to-PostgreSQL docs exist; no PostgreSQL adapter/import test exists. |
| 93 | Storage portability | **Deferred** | No object storage is currently used, so no lock-in was introduced; a storage adapter is not implemented. |
| 94 | Auth portability | **Partial** | Business records use canonical user IDs and external identity mapping; only trusted Sites/ChatGPT composition exists. |
| 95 | Background workers | **Partial** | A real scheduled public-economy cycle covers three feeds plus idempotent Bazaar hour/day aggregation and retention pruning under the same lease; valuation, item/resource, auction aggregate, and broader maintenance jobs are missing. |
| 96 | Scheduler portability | **Complete** | `runPublicEconomyCycle` and feed jobs are scheduler-independent; the Cloudflare `scheduled` handler is composition only. |
| 97 | Docker | **Partial** | Dockerfile/Compose build the web runtime; database/cache/worker/scheduler/auth are not composed. |
| 98 | Local development | **Partial** | Setup/build/test/four-migration docs exist; a one-command local D1/auth/worker/full-stack flow and seed/import path do not. |
| 99 | Environment variables | **Partial** | Blank secrets, database/Redis/site fields, and central flags are documented; Discord has no dedicated flag and AI does not auto-enable merely because credentials exist. |
| 100 | Feature flags | **Complete** | `lib/config.ts` centralizes flag parsing and product API enforcement; deferred features default off. |
| 101 | Admin panel | **Partial** | Server auth plus exact allowlist gate local status/actions and a redacted durable AI-metrics view; full system/economy/user operations and browser permission coverage remain incomplete. |
| 102 | Admin - system | **Partial** | Web/cache/provider/config state is shown; database/worker/scheduler/deploy/recent-error state is not queried durably. |
| 103 | Admin - Hypixel | **Partial** | Remaining-limit and local cache counters are shown; endpoint counts, errors/429s, latency, and durable cache metrics are absent. |
| 104 | Admin - economy | **Partial** | Bounded ingestion actions and feed infrastructure exist; durable feed/job counts, recency, valuation state, and errors are not displayed. |
| 105 | Admin - users | **Deferred** | No privacy-conscious user/profile/activity/search summary is exposed. |
| 106 | Admin - AI | **Complete** | AI calls increment hour/day aggregate request, failure, token, configured-cost, latency, and category buckets; an allowlisted private/no-store admin view reports 24-hour/30-day summaries without prompts, answers, users, profiles, or IPs. |
| 107 | Admin controls | **Partial** | Exact allowlist, same-origin/body checks, targeted cache clear, and bounded ingestion actions exist; flags, maintenance, retry/status, durable audit, and broader confirmations are missing. |
| 108 | Analytics | **Deferred** | Replaceable schema/repository interfaces exist, but product events are not instrumented end to end. |
| 109 | Error handling | **Partial** | Core APIs use safe typed envelopes and major UIs show actions; coverage is not consistent across every module/control. |
| 110 | Loading states | **Partial** | Dashboard, Bazaar, Auctions, goals, and AI have loading/busy states; generic/static routes do not exercise all async states. |
| 111 | Empty states | **Partial** | Major interactive surfaces have useful empty/unavailable states; deep product modules remain generic. |
| 112 | Accessibility | **Partial** | Skip link, labels, focus-visible, live regions, pressed/progress states, reduced motion, and keyboard Bazaar-history inspection exist; no automated/manual full audit, and some div-table semantics remain weak. |
| 113 | Performance | **Partial** | Bounded API/NBT/AI outputs, pagination, indexes, caching, worker aggregation, and image handling exist; no measured large-profile/list/mobile/load budget is recorded. |
| 114 | Security | **Partial** | Bounded inputs and NBT decoding, safe errors, exact origins, allowlists, AI fact-conflict enforcement, headers, secret scans, and ownership/cascade tests exist; comprehensive authz/CSRF/distributed-abuse/deployment audit remains incomplete. |
| 115 | NBT/external item data | **Complete** | `lib/providers/skyblock-items.ts` applies fixed base64/compressed/inflated/depth/list/string/item budgets, reduces supported containers to safe summaries, discards raw NBT/lore before caching, and passes malformed/deep/oversized/decompression-bomb/fuzz tests. |
| 116 | SEO | **Complete** | Metadata, Open Graph image, sitemap, robots rules, and private-route exclusion are implemented/tested. |
| 117 | Documentation | **Complete** | README, architecture, security, API, database, setup, operations, testing, portability, deployment, limitations, spec, checklist, and this audit exist. |
| 118 | Deployment documentation | **Complete** | Sites, external hosting, migration, database portability, auth, workers, secrets, and domain steps are documented honestly. |
| 119 | Testing | **Partial** | 153 tests cover engines, services, signed gateway/provider/security boundaries, D1-backed saved state/history, NBT safety, AI grounding/metrics, workers, legal pages, feature-aware navigation, and rendered routes; browser E2E, full authz, live providers, and many deep feature flows remain untested. |
| 120 | End-to-end tests | **Deferred** | Rendered HTML is server smoke coverage, not Playwright/browser E2E for the required flows. |
| 121 | Mock data rule | **Complete** | Demo/illustrative data is visibly labeled and safe-default live failures never silently fall back to demo. |
| 122 | No dead UI | **Partial** | Saved-state/build, market history, economy labs, money-making, skills, readiness, slot, and AI controls are wired; several deep module pages still present feature maps or narrow planning surfaces rather than complete capabilities. |
| 123 | No giant monolith components | **Complete** | UI is split by experience; current components remain under the specified practical ceiling. |
| 124 | No giant service files | **Complete** | Providers, engines, analyzers, repositories, lifecycle, and jobs are separated by responsibility. |
| 125 | Central game configuration | **Partial** | Central catalogs/config/nav plus one versioned standard skill-XP curve and per-skill caps are shared by profile normalization and calculators; some rarity/item/domain constants remain local. |
| 126 | Future SkyBlock updates | **Partial** | Stable IDs/catalogs, provider normalizers, versioned item summaries, and centralized skill XP improve update tolerance; several modules still use static local lists/reference assumptions. |
| 127 | Home page | **Complete** | Search-first homepage, concise positioning, no-account message, labeled previews, module links, and non-affiliation render and test successfully. |
| 128 | First profile experience | **Partial** | Empty/loading/error/profile reveal states are polished, but browser timing/interactions and complete live analysis are unverified. |
| 129 | Profile summary card | **Partial** | A compact dashboard stat summary exists; it is not a share/export card and omits major live fields. |
| 130 | Progression score | **Complete** | A bounded, tested unofficial score is visibly labeled SkyPilot-specific and not an official metric. |
| 131 | Best value badges | **Complete** | Recommendation models/engine/UI support value/priority badges with deterministic ranking. |
| 132 | Data explanations | **Partial** | Key tools include assumptions/notices/explanations, but a consistent tooltip/help system across expert concepts is incomplete. |
| 133 | No gameplay cheating | **Complete** | The product analyzes/explains only, documents non-automation, and contains no gameplay-control path. |
| 134 | Source-of-truth principle | **Partial** | AI precedence is strongly proven: clients send selectors/scenarios, the server resolves facts, and post-validation rejects unknown evidence, unsupported numeric claims, evasions, and contradictions; several game/reference datasets still lack a current source/version audit. |
| 135 | AI failure handling | **Complete** | AI is optional/flagged; missing credentials and failures leave deterministic/non-AI tools available with clear messages. |
| 136 | Monorepo/shared packages | **Complete** | Equivalent `app`/`components`/`lib`/`db`/`worker` separation avoids a forced multi-package scaffold while preserving boundaries. |
| 137 | CI | **Complete** | `.github/workflows/ci.yml` runs install, lint, typecheck, Drizzle checks, migration smoke, tests/build, and Docker build. |
| 138 | Git hygiene | **Partial** | Ignore rules and secret scans are strong; the audited feature delta still requires an intentional commit/current CI run before release. |
| 139 | Initial public deployment | **Blocked** | An earlier owner-only Sites build exists, but the current source is neither committed nor deployed; public access/domain and production integration activation require owner/deployment approval, and product completeness is still insufficient. |
| 140 | Sites limitations | **Partial** | Economy jobs are isolated and scheduled through a Sites-compatible handler; external worker composition and unsupported infrastructure remain incomplete. |
| 141 | Migration test | **Partial** | The four-migration chain creates all 36 expected SQLite tables with zero foreign-key findings, but no second-host/PostgreSQL production import/auth/worker migration smoke exists. |
| 142 | Visual QA | **Partial** | Prior-source desktop/mobile spot checks are documented, but the current saved-state/history/AI/item/planner delta and every major page/state at desktop/tablet/mobile have no captured browser audit. |
| 143 | Design consistency | **Partial** | Shared tokens/shell/panels/controls keep new tools cohesive; charts/tooltips and many generic module pages remain unfinished. |
| 144 | Performance QA | **Deferred** | No load/soak/browser performance measurement covers the specified large data and mobile cases. |
| 145 | Policy audit | **Partial** | Current architecture respects the documented major boundaries; a final immediately pre-release policy re-read/audit remains. |
| 146 | Security audit | **Partial** | Focused origin, auth, ownership, secret, NBT-boundary, AI-grounding/redaction, header, and account-cascade checks pass; a comprehensive release audit with distributed abuse, deployment, logs, and remediation evidence does not. |
| 147 | Completion report | **Blocked** | A truthful final deployment/completion report cannot claim completion until implementable gaps and external activations are resolved. |
| 148 | Definition of done | **Partial** | Foundation and several vertical slices pass; the complete product, QA, portability, security, and release gates do not. |
| 149 | Begin and continue through completion | **Partial** | Work progressed through audited vertical slices; substantial implementable work remains and is prioritized below. |

## Largest implementable end-to-end gaps

1. **Priced profile intelligence and Fix My Profile.** Join bounded item identities to current/historical valuation evidence, cover missing containers/pets, model gear modifiers and accessory families, and render the complete categorized roadmap with priced recommendations and durable completion actions. Add real-provider fixture revisions, valuation-service/API contracts, and a browser profile-select/budget/roadmap flow.
2. **Remaining durable user workflows.** Connect Complete/Ignore/Remind Later/Recalculate to owner-scoped recommendation state, add appropriate privacy-bounded AI history only if justified, enrich saved goal steps, and add browser persistence/authz tests across profiles, preferences, favorites, builds/sharing, and goals.
3. **Deep domain modules.** Replace remaining feature maps or narrow planners for gear, items, Mining, Foraging, Fishing, Museum, Collections, Bestiary, and Rift; deepen Garden, Dungeons, Slayers, Minions, skills, and the economy overview with current versioned resource/profile data. Add service fixtures, route contracts, hydrated UI tests, and one browser flow per production module.
4. **Auction/item history and valuation.** Extend the proven Bazaar hour/day pipeline to variant-aware auction/item identity, ended-sale valuation, compact long-term summaries, and item/Auction history views; add worker retention/transaction tests and browser Auction/item-history flows.
5. **Admin, analytics, and telemetry beyond AI.** Instrument API/Hypixel/economy/user/product events, errors, jobs, and runs; expose redacted system/economy/user views and safe audited controls. Add exact permission, non-admin, same-origin, action-audit, and redaction tests.
6. **Portable production infrastructure.** Implement PostgreSQL, distributed cache/rate/queue, scheduler/worker, external auth, secrets/observability, and backup/restore adapters; compose the core external stack. Add D1/PostgreSQL repository contract tests, multi-replica rate/cache tests, worker smoke, migration/import, and restore evidence.
7. **Broader AI grounding and production controls.** Add accessory, money-making, item/valuation, and versioned knowledge context where authoritative; replace per-runtime abuse controls before scale and validate a live-provider graceful-failure/context flow without logging private prompts.
8. **Release QA gates.** Add Playwright plus automated accessibility and visual snapshots; exercise auth/admin/goal/economy/profile flows; run responsive, keyboard/focus, load/soak, large-payload, production migration, live-provider, security, and final policy audits.

## External activation prerequisites

These require owner/provider/deployment action and must remain unchecked. They are not substitutes for the implementable gaps above.

- Revoke the OpenAI and Hypixel credentials previously exposed outside a secret store; create replacement credentials and install them server-side only.
- Obtain/confirm the appropriate Hypixel production application approval and perform the final current-policy review before live activation.
- Install an approved OpenAI model/key only if the optional AI feature is deliberately enabled.
- Apply all four versioned migrations to production D1, configure backups/restore/retention, and verify the `DB` binding.
- Enable and verify the Sites/ChatGPT identity trust boundary and exact administrator allowlist.
- Register exactly one production economy schedule, keep the durable lease/backoff path enabled, and then deliberately turn on `ENABLE_PUBLIC_ECONOMY`.
- Choose public Sites access, domain/DNS/TLS, `SITE_URL`, and monitoring/alerting only after explicit owner approval.
- For an external host, provision the database/cache/queue/scheduler/auth/secrets/observability services and validate the missing adapters first.
