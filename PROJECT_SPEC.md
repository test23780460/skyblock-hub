# SkyPilot — Consolidated Product Specification

This document is the implementation source of truth derived from the 149-section master build specification. The product name override is **SkyPilot**; the repository may remain `skyblock-hub`. Branding must come from centralized configuration so the product can be renamed without scattered code edits.

Credential values are intentionally excluded. Secrets belong only in uncommitted runtime configuration; committed examples contain blank placeholders.

## Product mandate

SkyPilot is a complete, production-quality, public Hypixel SkyBlock companion platform—not a prototype, landing-page demo, scaffold, or partial MVP. It should tell a player exactly what to do next and cohesively replace multiple disconnected tools through profile analysis, progression guidance, economy intelligence, calculators, AI assistance, and administration.

## 1. Primary product vision

- Deliver a cohesive all-in-one experience covering profiles, progression, gear, accessories and Magical Power, Bazaar, Auction House, economy and valuation, money making, skills, Garden, Dungeons, Slayers, Minions, Museum, Collections, Bestiary, Rift, goals, recurring progression, calculators, player tools, AI, and administration.
- Interconnect the modules; do not present them as unrelated calculators.

## 2. Autonomous build requirement

- Maintain and continuously update `TODO.md`; plans, scaffolding, a homepage, auth, one endpoint/calculator, mock dashboard, models, or documentation are milestones rather than completion.
- Continue until every implementable requirement is complete. Make routine professional choices independently.
- Architectural deviations are permitted only when they preserve intent, improve maintainability/security/performance/scalability, violate no hard requirement, and are documented when major.

## 3. External blocker rule

- A missing Hypixel/OpenAI key, domain, Discord/advertising/OAuth/hosting/database credential, or other external dependency must block only activation of that integration.
- Build the complete integration, add blank variables to `.env.example`, degrade gracefully, provide development/test fixtures where appropriate, document the activation step, and continue all other work.
- Never replace unavailable production functionality with hardcoded fake behavior.

## 4. Continuous quality loop

- For each substantial feature: implement, integrate, test, typecheck, lint, run automated and relevant integration tests, build for production, diagnose and fix failures, rerun validation, and verify responsiveness, loading, error, empty, accessibility, and real navigation behavior.
- Do not mark a feature complete until this loop passes. Only a genuinely unavailable external service may prevent a test from running.

## 5. Final completion loop

- Before stopping, audit the entire specification for forgotten features, dead UI, fake data, incomplete routes/placeholders/mobile layouts/states, API errors, accessibility/design consistency, duplication, security/performance/database/migration issues, unfinished TODOs, missing admin/tests, hosting lock-in, and policy violations.
- Fix findings and repeat the audit until no reasonably implementable requirement remains.

## 6. Product name and centralized branding

- The canonical product name is **SkyPilot**, superseding the temporary “SkyBlock Hub” name in the source prompt.
- Centralize at least `SITE_NAME`, `SITE_DESCRIPTION`, `SITE_DOMAIN`/`SITE_URL`, and `SITE_LOGO`; do not scatter the name through the codebase.

## 7. Design quality

- Visual quality is a major requirement. SkyPilot must feel like a premium modern gaming companion, financial analytics product, esports product, or game launcher while remaining recognizably SkyBlock.
- Avoid generic Tailwind/SaaS/admin templates, school-project or Bootstrap styling, plain wiki presentation, card spreadsheets, and unfinished developer-tool aesthetics.

## 8. Visual language

- Use a dark-first theme with deep surfaces, restrained gradients/glow/glass, premium shadows and typography, strong hierarchy, item artwork/cards, smooth transitions, responsive animation, skeletons, and polished charts.
- Use SkyBlock rarity colors intelligently for Common, Uncommon, Rare, Epic, Legendary, Mythic, Divine, Special, and Very Special. Rarity must be immediately legible without overwhelming RGB effects.

## 9. Microinteractions

- Provide fast, tasteful hover/elevation, navigation indicators, chart interactions, tab and item-comparison transitions, skeletons, animated stats/progress, expandable details, and responsive tooltips.
- Honor `prefers-reduced-motion`.

## 10. Responsive design

- Design purpose-built desktop, laptop, tablet, and mobile layouts rather than shrinking desktop cards.
- Transform navigation gracefully; provide mobile-friendly alternatives to tables; keep charts usable on phones.

## 11. Global navigation

- Provide polished access to Dashboard, Profile, Progression, Gear, Accessories, Economy, Bazaar, Auctions, Money Making, Skills, Garden, Mining, Foraging, Fishing, Dungeons, Slayers, Minions, Museum, Collections, Bestiary, Rift, Goals, Calculators, Items, AI Assistant, and More.
- Use nested menus to avoid overcrowding.

## 12. No-account experience

- Basic functionality must not require registration: a visitor can enter a Minecraft username, select a SkyBlock profile, and immediately receive a complete dashboard.

## 13. Optional accounts

- Optional accounts support saved usernames, multiple Minecraft accounts, saved profiles, goals, completed recommendations, builds, favorites, site/dashboard preferences, and appropriate AI history.
- Use an internal canonical application user ID; business data must not depend directly on one auth provider.

## 14. Main player dashboard

- After profile search, show username/head, selected profile, SkyBlock level, purse, bank, estimated net worth, Magical Power, skill average, Catacombs, Slayers, minion slots, Museum progress, important gear, active pet, strengths, and weaknesses.
- Prioritize actionable information.

## 15. “What should I do next?” system

- Build a primary progression recommendation engine that inspects the selected profile and ranks upgrades/actions.
- Every recommendation explains what, why, estimated cost and benefit, prerequisites, priority, and category; include coins-per-improvement when possible.

## 16. Progression priority engine

- Consider stage, gear, available coins, goals, skills, Magical Power/accessories, Slayers, Catacombs, Garden, Mining, pets, Collections, Minions, Museum, and prerequisites.
- Prefer high-value reachable upgrades over disproportionately expensive ones.

## 17. Budget recommendations

- Accept presets from 1M through 1B and custom budgets, then rank the best upgrades possible within that budget.

## 18. Goal system

- Support targets such as skill levels, Magical Power, Catacombs, net worth, a max setup, Slayer/Mining progression, and custom goals.
- Break large goals into steps with remaining XP, estimated hours, and milestone progress where applicable.

## 19. Recommendation history

- For signed-in users, remember completed recommendations so they are not repeatedly shown.
- Support Mark Complete, Ignore, Remind Later, and Recalculate.

## 20. Player history policy

- Player/profile requests are user-driven and intelligently cached; never continuously poll individuals, monitor thousands of profiles, or implement automated profile-session tracking where policy conflicts.
- Clearly separate player profile data from public economy/resource ingestion.

## 21. Profile analyzer

- Analyze skills, armor, weapons, tools, equipment, pets, accessories, Collections, Minions, Museum, Slayers, Dungeons, Garden, Mining, Rift, Bestiary, and progression unlocks; identify weaknesses.

## 22. Gear analyzer

- Analyze armor, weapons, equipment, tools, and pets for upgrades, reforges, enchantments, stars, gemstones, applicable attributes, recombobulation, rarity, item-specific upgrades, and missing enhancements.
- Recommend improvements to the player’s existing gear.

## 23. Gear comparison

- Compare weapon/armor/equipment/pet options using meaningful modeled differences rather than raw lore text alone.

## 24. Future build creator

- Prepare saved-build architecture. When practical, allow armor, weapon, equipment, pet, and accessory/power selection, saving, and sharing.
- It may launch behind an experimental flag when calculations cannot be modeled reliably.

## 25. Accessory system

- Show current Magical Power, missing accessories and families/upgrades, cheapest missing options, coins per Magical Power, recommendations, completion, powers, tuning, and applicable enrichment analysis.
- Support target-gain planning such as the estimated cost and purchases for the next +50 MP.

## 26. Economy dashboard

- Present Bazaar and auction trends, movers, high-volume/rising/falling items, useful margins, activity, popular products, and money-making opportunities, using charts only when informative.

## 27. Bazaar

- Implement product search plus buy/sell and applicable instant prices, spread, volume, order counts, weekly movement, price/volume history, trend, and profit calculations.

## 28. Bazaar flips

- Calculate spread, margin, profit, percentage return, volume, liquidity, and opportunity quality.
- Rank by a liquidity-aware score rather than theoretical margin alone and state that profit estimates are not guaranteed.

## 29. Craft flips

- Compare ingredient/craft cost to potential sale value, including relevant fees, potential margin, and known recipe/unlock requirements.

## 30. NPC/Bazaar opportunities

- Support legitimate NPC/Bazaar comparisons only where game mechanics and policy permit.

## 31. Auction House

- Provide item search, active auctions, available BIN listings, lowest pricing, listing distribution, ending-soon views, recently ended auctions, sale history, and item variants.

## 32. Item valuation engine

- Estimate value from base item, rarity, enchantments, recombobulation, upgrades, gemstones, stars, applicable attributes, item modifiers, and actual historical sales.
- Never claim exactness; emit High/Medium/Low confidence and explain insufficient sales data.

## 33. Net worth

- Estimate and label “Estimated Net Worth” across available purse, bank, armor, inventory, accessory bag, pets, storage, equipment, ender chest, relevant containers, and appropriate Museum value.

## 34. Money-making section

- Cover legitimate Farming, Mining, Fishing, Dungeons, Slayers, Bazaar, Auction, Crafting, NPC, and other methods.
- Where possible show coins/hour, requirements, setup, difficulty, starting capital, risk, and attention required.

## 35. Personalized money making

- Rank the best methods the selected player can currently perform, including estimated output, setup-readiness percentage, and missing requirements.

## 36. Skills hub

- Cover Farming, Mining, Foraging, Fishing, Combat, Enchanting, and Alchemy with current level/XP, next level, remaining XP/progress, progression advice, equipment, recommendations, and calculators.

## 37. Farming/Garden

- Make Garden a flagship module covering level/XP, Garden progress, crop milestones, Farming Fortune, equipment/armor/tools/pets/upgrades, visitors, pests, applicable plots, and crop analytics.

## 38. Farming Fortune calculator

- Calculate and attribute bonuses from armor, equipment, tools, enchants, reforges, pets, Garden upgrades, applicable accessories, player progression, and crop-specific bonuses.

## 39. Farming upgrade optimizer

- Calculate and intelligently rank coins per additional Farming Fortune.

## 40. Crops

- Support Wheat, Carrot, Potato, Pumpkin, Melon, Mushroom, Cactus, Sugar Cane, Cocoa Beans, Nether Wart, and other currently relevant crops.
- Prefer current API/resource data to a frozen list.

## 41. Farming XP/time calculator

- Accept current and target levels plus XP/hour assumptions; show remaining XP and estimated hours/sessions.

## 42. Melon support

- Fully analyze Melon tool, armor, equipment, pet, Fortune, crop upgrades, and progression, returning actionable upgrades.

## 43. Pests

- Provide useful pest progression/calculators only where reliable data exists.

## 44. Visitors

- Where reliable data exists, provide Visitor offer evaluation, reward summaries, cost/value comparison, and progression; never fabricate unavailable data.

## 45. Mining

- Cover Heart of the Mountain, Mining Speed/Fortune, powder, commissions, gear/equipment, drills/pickaxes, gemstones, pets, and progression recommendations.
- Prefer current game data over hardcoded assumptions.

## 46. Foraging

- Cover level/XP, current progression systems, tools, gear, pets, upgrades, and available calculators.
- Keep the module adaptable to future Foraging changes.

## 47. Fishing

- Cover level, progression, gear, pets, available sea-creature statistics, and recommendations.

## 48. Combat

- Provide Combat progression and recommendations without unfair gameplay automation.

## 49. Dungeons

- Cover Catacombs/class levels, selected class, completions, floor and available Master Mode progress, gear and recommendations, next-floor readiness, statistics, available secrets data, and goals.

## 50. Floor readiness

- Explain evidence behind cautious ratings such as Likely Ready, Needs Improvement, and Strongly Recommended Upgrades; never guarantee player performance.

## 51. Dungeon profit

- Provide a Dungeon profit calculator where reliable data permits.

## 52. Slayers

- Support every currently relevant Slayer category through data-driven configuration.
- Show XP, level/progress, unlocks, gear and progression recommendations, reasonable cost estimates, and reliable profit tools.

## 53. Minions

- Show owned Minions, crafted/missing tiers, slot progression, cheapest next upgrades, profit estimates, fuels, upgrades, and applicable storage.

## 54. Minion slot optimizer

- Rank the cheapest crafts/tier upgrades needed for the next Minion slot.

## 55. Minion profit

- Calculate Minion profit with configurable, clearly displayed assumptions.

## 56. Museum

- Track completion, data-permitted missing items, progression, valuable missing contributions, and relevant unlocks.

## 57. Collections

- Show current progress, completed/incomplete Collections, unlocks, and easy recommended completions.

## 58. Bestiary

- Track Bestiary progress where the API supplies reliable data.

## 59. Rift

- Show available Rift progression and useful player recommendations.

## 60. Daily/weekly system

- Implement user-managed configurable task lists with check-off, saved completion, and appropriate recurring resets.
- Do not depend on prohibited continuous profile tracking.

## 61. Player comparison

- Broad player-vs-player comparison and invasive comparison tracking are explicitly not launch priorities.

## 62. Guilds

- Preserve clean future Guild architecture; advanced Guild tooling is not a launch priority.

## 63. Leaderboards

- A Top Coins/Wealth leaderboard is allowed only when built legitimately and reliably from data SkyPilot may collect.
- Never crawl the player base. If a global board is not responsible/permitted, use voluntary opt-in profiles; keep architecture extensible.

## 64. Sharing

- Provide shareable URLs where practical for builds, goals, and selected analysis results.
- Gate public profile sharing behind a feature flag.

## 65. AI SkyBlock assistant

- Integrate an AI assistant with structured profile, economy, progression, calculator, and knowledge data; it must not be a generic chatbot.
- Answer personalized spending, Magical Power, setup, progression, Farming-time, money-making, and Dungeon questions.

## 66. AI architecture

- Compose responses from user question → player context → profile analyzer → current economy → progression engine → calculators → relevant knowledge → AI response.
- Structured application data and deterministic calculations are authoritative for numeric facts, not the language model.

## 67. Fix My Profile

- Analyze the complete available profile and produce a roadmap grouped into Critical, High Priority, Medium Priority, and Long Term, with estimated costs and benefits where possible.

## 68. Beginner/Normal/Advanced AI

- Offer Beginner (terms explained), Normal (balanced), and Advanced (game knowledge assumed; numeric optimization emphasized) response modes.

## 69. Discord

- Do not launch active Discord notifications. Prepare future OAuth, bot, linking, alerts, profile commands, price alerts, and goal-reminder architecture behind `ENABLE_DISCORD=false`.

## 70. Notifications

- Browser/price/flip notifications and recurring external reminders are not launch priorities; prepare architecture only where useful.

## 71. Advertising

- Prepare reusable, non-deceptive ad slots for suitable sidebar/content/footer locations without harming UX or causing accidental clicks.
- Keep ads disabled initially through `ENABLE_ADS=false`.

## 72. Premium

- Do not launch paid membership or paywall important functionality. Avoid blocking future premium architecture and keep `ENABLE_PREMIUM=false`.

## 73. Item database

- Provide item search and useful pages containing available name, rarity, category, lore, Bazaar/Auction data, estimated value, price history, known crafting data, related items, and progression relevance.

## 74. Global search

- Search players, items, Bazaar products, calculators, and tools, with autocomplete where practical.

## 75. Charts

- Use high-quality interactive charts when informative for Bazaar price/volume, item history, net-worth composition, skill/goal progress, and money-making comparisons.
- Include useful tooltips, date ranges, and responsive layouts; do not add decorative charts.

## 76. Data freshness

- Label important data as live, recent, or historical, including readable profile and market update ages.

## 77. Hypixel API

- Use the official Hypixel API and current official documentation, including the current Player Data schema, rather than remembered payloads.

## 78. Hypixel policy (hard requirement)

- Current official Hypixel developer policy is authoritative and must be reviewed during implementation.
- If any product requirement conflicts, implement the nearest compliant behavior and document the conflict.

## 79. Hypixel non-affiliation

- Clearly state that SkyPilot is neither affiliated with nor endorsed by Hypixel; do not imitate official branding.

## 80. API key security

- `HYPIXEL_API_KEY` is server-only: never commit it, send it to browser JavaScript, log it, or expose it through a proxy.
- `.env.example` contains only the blank `HYPIXEL_API_KEY=` placeholder.

## 81. No API proxy

- Never expose an unrestricted public Hypixel proxy. Internal endpoints return only product-required data/functionality.

## 82. Rate limiting

- Centralize Hypixel access behind a client with rate-limit management, shared cache, request queue, backoff, error handling, metrics, and endpoint adapters.
- Respect headers and `429` responses with appropriate retry/backoff. Never rotate multiple keys to evade limits.

## 83. Caching

- All Hypixel access uses centralized caching with configurable TTLs: long for metadata, request-driven for profiles, short/shared for Bazaar, and centralized ingestion/cache for auctions.
- Individual pages must not independently hit Hypixel.

## 84. API adapters

- Keep external APIs behind adapters: Hypixel → adapter → service layer → internal API → UI. UI components do not call Hypixel directly.

## 85. Data ingestion

- Where policy permits, centrally collect public Bazaar, auction/ended-auction, item, Collection, skill, and other resource data.
- Never extend continuous ingestion to individual player profiles where prohibited.

## 86. Historical economy data

- Retain useful multi-year economy history through bounded raw snapshots, hourly aggregates, daily aggregates, and long-term summaries rather than endless duplicate snapshots.

## 87. Database

- Use a structured, PostgreSQL-compatible model with appropriate users/auth identities/accounts/profiles/goals/recommendations/builds/favorites; items/Bazaar snapshots and aggregates; auctions/sales/variants/valuations/history; money methods; flags/admin/analytics/metrics/errors/jobs/job runs.
- Add correct indexes, relationships, migrations, and constraints; do not hide the whole application in giant JSON blobs.

## 88. Data-model flexibility

- Combine sensible normalization with structured JSON only where evolving game-specific attributes benefit from it.

## 89. Initial hosting target

- Prefer an initial public deployment through ChatGPT Sites/Codex Sites when the finished product and environment support it.

## 90. Zero hosting lock-in (hard requirement)

- Core product logic must move to Cloudflare, Vercel, Render, Railway, AWS, Google Cloud, Azure, a VPS, or Docker infrastructure without a rewrite.
- Do not couple the product to Sites.

## 91. Infrastructure abstractions

- Isolate platform services through provider interfaces for database, storage, cache, auth, scheduler, queue, analytics, secrets, and similar concerns.
- Business logic must be hosting-provider agnostic.

## 92. Database portability

- If Sites/D1 is used, keep behavior, schema, and migrations portable and document D1 → PostgreSQL → other-host migration without rewriting SkyBlock logic.

## 93. Storage portability

- Isolate object storage so services can move among R2, S3, S3-compatible, and other providers.

## 94. Auth portability

- Map ChatGPT, Discord, Google, GitHub, email/password, and future identities to the internal `user_id`; never spread provider IDs across business tables.

## 95. Background workers

- Separate heavy processing from the web runtime, ideally through web/worker applications and shared packages.
- Potential independently deployable jobs include Bazaar refresh, auction and ended-auction ingestion, hourly/daily aggregation, valuations, cache cleanup, and maintenance.

## 96. Scheduler portability

- Implement jobs as scheduler-independent functions/tasks runnable via cron, Cloudflare Cron, Render/Railway, GitHub Actions, AWS, or alternatives.
- Provider cron configuration must not contain business logic.

## 97. Docker

- Where compatible, provide a `Dockerfile` and `docker-compose.yml`; `docker compose up` should launch the core local stack or documentation must state the remaining steps.

## 98. Local development

- Document a fresh-developer flow for clone, dependency install, environment setup, dependencies, migrations, optional seed data, web app, workers, and tests.

## 99. Environment variables

- Maintain blank/safe example configuration for Hypixel, OpenAI, database, Redis/cache, site name/URL, and centralized feature flags.
- Default AI enabled where credentials exist; Discord, ads, premium, public profiles, Guild tools, price alerts, and experimental features disabled unless deliberately activated.
- Do not assume every variable is required for initial Sites deployment.

## 100. Feature flags

- Use a centralized flag service/configuration system rather than scattered UI boolean checks.

## 101. Admin panel

- Provide a polished, secure dashboard available only to authorized administrators.

## 102. Admin — system

- Show website, database, worker, scheduler, and cache status plus available deployment information and recent errors.

## 103. Admin — Hypixel

- Show request/error/`429` counts, latency, endpoint use, cache hit rate, available remaining-limit data, and API health.

## 104. Admin — economy

- Show last Bazaar update, auction ingestion and ended-auction processing; product/snapshot/sales counts; valuation jobs; and ingestion errors.

## 105. Admin — users

- Show registered users, saved profiles, active users, popular features, and search activity without unnecessary personal-data collection.

## 106. Admin — AI

- When AI is enabled, show volume, estimated tokens/cost, failures, latency, and popular question categories.
- Avoid unnecessary private-prompt logging; redact sensitive information.

## 107. Admin controls

- Safely manage feature flags and maintenance mode, targeted cache invalidation, failed-job retry, safe ingestion triggers, and job status.
- Require confirmation for dangerous actions.

## 108. Analytics

- Capture privacy-conscious profile searches, tool/calculator use, page views, recommendation clicks, and goal creation.
- Avoid invasive tracking and keep the analytics provider replaceable.

## 109. Error handling

- Provide polished user messages for missing players/profiles/inventory, disabled Profile API, upstream outage, rate limiting, and delayed market data.
- Never expose raw server errors.

## 110. Loading states

- Use premium skeletons instead of large blank regions during requests.

## 111. Empty states

- Empty states must explain the condition and offer a relevant next action, such as Create Goal.

## 112. Accessibility

- Provide keyboard support, semantic HTML, labels, visible focus, necessary ARIA, adequate contrast, and reduced-motion support.

## 113. Performance

- Use appropriate code splitting/server rendering, caches, pagination/virtualization, image optimization, deferred loading, indexes, and efficient queries.
- Do not send thousands of auction rows to the browser unnecessarily.

## 114. Security

- Apply input validation, output encoding, authorization, secure cookies, applicable CSRF defenses, rate/abuse limits, SQL-injection and XSS protection, secure secrets, and safe logs.
- Validate all external/Hypixel data rather than trusting payloads.

## 115. NBT/external item data

- Treat NBT and item payloads as untrusted, parse safely, and prevent malformed data from crashing ingestion workers.

## 116. SEO

- Public pages need dynamic titles/descriptions, Open Graph/social metadata where appropriate, sitemap, and robots configuration.
- Exclude private account pages from indexing.

## 117. Documentation

- Maintain `README.md`, `AGENTS.md`, `PROJECT_SPEC.md`, `TODO.md`, `ARCHITECTURE.md`, `SECURITY.md`, and useful API/database/feature/deployment/policy/testing documentation.

## 118. Deployment documentation

- Document Sites deployment, external hosting, and migration of frontend, backend, workers, database, storage, secrets, auth, jobs, and domain away from Sites.

## 119. Testing

- Provide meaningful unit, integration, API, progression, calculator, economy, valuation, parser, auth, and permission tests.
- Use Hypixel response fixtures; CI must not require the real API for every test.

## 120. End-to-end tests

- Cover critical flows: player search, profile selection/dashboard, recommendations, budget optimizer, Bazaar item, calculator, account creation when enabled, goal saving, and admin authorization.

## 121. Mock data rule

- Mocks are permitted for tests, local/visual development, and unavailable credentials.
- Production must never silently present fake SkyBlock data as real; demonstration data must be explicit.

## 122. No dead UI

- Every button and navigation destination must work. Intentionally disabled work is hidden or clearly marked Coming Soon/Experimental through flags; empty placeholders are not completion.

## 123. No giant monolith components

- Split frontend pages into meaningful components; avoid multi-thousand-line React components.

## 124. No giant service files

- Keep API transport, business logic, persistence, calculations, and presentation modular.

## 125. Central game configuration

- Centralize rarities, item categories, skill definitions, game constants, routes, and feature metadata rather than duplicating constants.

## 126. Future SkyBlock updates

- Prefer data-driven systems so new skills, Slayers, items, currencies, areas, and progression systems can be added without a rewrite.

## 127. Home page

- Immediately communicate all-in-one SkyBlock progression, lead with username search, and preview progression, market, Farming, AI, and item capabilities.
- Minimize marketing filler and move visitors into a profile quickly.

## 128. First profile experience

- Provide a polished, fast analysis sequence—fetching profile, gear/accessory/progression/opportunity analysis, recommendation preparation—before revealing the dashboard.

## 129. Profile summary card

- Provide a polished/shareable, uncluttered card using selected key stats such as SkyBlock Level, estimated net worth, Magical Power, skill average, Catacombs, Farming, Mining, and Slayer.

## 130. Progression score

- An internal progression score is optional. If implemented, clearly label it as SkyPilot’s analytical metric, never an official Hypixel statistic.

## 131. “Best value” badges

- Improve recommendation scanability with meaningful Best Value, Cheap Upgrade, High Impact, Long Term, Requires Grind, and Market Dependent badges.

## 132. Data explanations

- Explain complex metrics such as Magical Power, Farming Fortune, spread, liquidity, and valuation confidence through tooltips/help; support non-expert visitors.

## 133. No gameplay cheating

- SkyPilot may analyze, plan, educate, guide progression, and research the economy. It must never automate play, control Minecraft, supply prohibited unfair advantages, or violate Hypixel rules.

## 134. Source-of-truth principle

- Official Hypixel APIs/docs, permitted collected economy data, and deterministic calculators are authoritative.
- AI never overrides deterministic results.

## 135. AI failure handling

- The rest of SkyPilot works without OpenAI credentials; explain AI unavailability rather than making the site dependent on it.

## 136. Monorepo/shared packages

- Prefer separated web/worker applications and shared UI, config, database, Hypixel, SkyBlock, progression/recommendations, economy, valuation, calculators, and AI packages—or a technically superior structure with equivalent separation.

## 137. CI

- CI installs dependencies, lints, typechecks, tests, and builds; main must not knowingly contain broken code.

## 138. Git hygiene

- Use logical commits when expected. Never commit `.env`, keys/secrets, generated junk, or unnecessary large artifacts.

## 139. Initial public deployment

- After a stable production build, prepare Sites deployment and deploy publicly when capability/credentials permit without harming portability.

## 140. Sites limitations

- If Sites cannot host heavy workers or another backend component, retain and isolate it, document and deploy it externally, and let the Sites frontend consume the service/data.

## 141. Migration test

- Verify the product could leave Sites without rewriting SkyPilot’s SkyBlock logic; refactor until true.

## 142. Visual QA (hard requirement)

- Inspect every major page for spacing, text size, empty areas, card consistency, mobile breakage, tables, icons, chart/modal overflow, navigation, control alignment, and hierarchy; fix findings.

## 143. Design consistency

- Centralize typography, spacing, radii, shadows, surfaces, rarity/status colors, chart styling, buttons, inputs, cards, tables, badges, and tooltips so all modules feel unified.

## 144. Performance QA

- Test the homepage, large profiles, Bazaar/Auction lists, item search, charts, admin, and mobile behavior; optimize visible bottlenecks.

## 145. Policy audit

- Immediately before completion, re-read current Hypixel policy and audit player polling, caching, keys, proxy behavior, rate-limit circumvention, branding, monetization, unfair functionality, and privacy; fix violations.

## 146. Security audit

- Before completion, audit secrets, auth/authz, admin routes, injection/XSS/CSRF, abuse, logs, user input, API errors, and external parsing; fix significant issues.

## 147. Completion report

- Only after genuine completion, report implemented systems; deployment state/URL; external activations; lint/typecheck/unit/integration/E2E/build status; genuine external limitations; and optional future enhancements—not unfinished launch requirements.

## 148. Definition of done

- Core pages and major tools work: lookup/analysis/recommendations/Fix My Profile, accessories/gear, Bazaar/economy/Auctions/valuation/net worth, personalized money making, Garden and skills, Dungeons/Slayers/Minions/Museum/Collections, API-permitted Bestiary/Rift, goals, enabled accounts/AI, and admin.
- Shared caching/rate limiting, workers, migrations, mobile layouts, all request states, documentation, and production build work; tests pass.
- Hypixel-policy, security, and portability audits pass; Sites deployment is prepared; no significant placeholders masquerade as complete.

## 149. Begin and continue through completion

- Inspect the repository, create/update this specification and `TODO.md`, design architecture, set up the application, and transition directly from planning into implementation.
- Work autonomously, validate continuously, fix errors, revisit unfinished areas, perform the required audits, and do not call a partial application complete.

## Precedence and conditionality

1. Current Hypixel policy and game rules override conflicting product behavior.
2. Security and secret-handling requirements are hard constraints.
3. Explicit launch-deferred items (advanced Guilds, active Discord/notifications, ads, premium, broad comparison) are not disguised as finished features; their architecture/flags are the stated deliverable.
4. Data-dependent tools expose only supported results and clearly explain unavailable or low-confidence data.
5. External credentials activate already-complete integrations; their absence does not excuse unfinished unrelated work.
