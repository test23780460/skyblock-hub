# Known Limitations

This is the honest pre-release status. Architecture, schema, feature maps, or tested engines are not described as complete user-facing systems unless they are wired end to end.

## External activation not performed

- No public production launch, custom domain, or external-host deployment is claimed. An owner-only Sites preview may host the safe-default build.
- Production Hypixel and OpenAI credentials are not installed or verified. Any previously exposed credential must be replaced, not reused.
- Production D1, migrations, backup/restore, scheduler, domain, and observability are not activated.
- Sites/ChatGPT auth and the administrator allowlist require deployment configuration.

## Player analysis

- Live lookup supports normalized identity, profile choice, several core stats/skills, limited progression analysis, and deterministic recommendation services.
- Full inventory/NBT decoding and variant-aware gear, accessory bag, pet, storage, Museum, Bestiary, Rift, Minion, Garden, and deep Dungeon analysis are not wired to live responses.
- Estimated net worth and item valuation engines exist and are tested, but complete live asset extraction/price evidence is not connected.
- Dashboard recommendation Complete/Ignore/Remind Later actions are client-memory only; persistence exists at the repository level but is not connected to those buttons.
- The displayed profile signal is an unofficial presentation element and is not yet a fully wired per-profile engine result.

## Modules and calculators

- Many `/[section]` pages are connected feature maps with generic editable planning labs. They are not complete specialized implementations of every described Farming, Mining, Foraging, Fishing, Dungeons, Slayers, Minions, Museum, Collections, Bestiary, Rift, gear, item, or money-making tool.
- Deterministic Farming, pet, Minion, Dungeon, and Slayer calculators exist as tested libraries/services, but there are no dedicated product API routes and not every page invokes them.
- Saved builds, sharing, recurring task reset, recommendation history, favorites, saved profiles/preferences, Guilds, leaderboards, ads, premium, Discord, and notifications are incomplete or deliberately deferred.

## Economy

- Bazaar and active-auction pages show current normalized public snapshots and bounded client-side filtering/sorting only when the safe-default `ENABLE_PUBLIC_ECONOMY` gate is deliberately enabled.
- Active Auction search filters only the selected upstream page, not the full market.
- Ended-auction data has an API route but no complete user-facing history/valuation experience.
- Historical charts, durable raw snapshots, hourly/daily aggregation, sale sinks, NBT variants, item pages/search, craft/NPC comparison, and full valuation jobs are not active.
- Worker functions exist, but no production scheduler or durable sink is composed. Admin refresh actions therefore do not prove database ingestion.
- Market estimates are not guaranteed trades or profit.

## Accounts and administration

- Optional account identity and canonical-user mapping exist for Sites/ChatGPT auth.
- Goal GET/POST persistence works only with verified identity, an active D1 binding, and applied migration. Goal update/delete/completion/reset are missing.
- Other account capabilities described by the schema/page—saved profiles, favorites, preferences, builds, recommendation state, AI history—are not end-to-end UI features.
- Admin status is local-runtime oriented. It does not provide full database, scheduler, deployment, user, analytics, AI-cost, job retry, feature-flag, or error-log management.

## AI

- The safe-default-off route supports optional Responses API calls, server-resolved bounded context, detail modes, timeout, and safe failure.
- The current page can attach labeled demo context; it does not carry a selected live profile from the dashboard.
- AI request limiting is per runtime and unsuitable as the only production abuse control.
- AI telemetry/cost persistence and comprehensive prompt-injection/evaluation suites are not complete.

## Infrastructure and QA

- Cache, single-flight, Hypixel rate state, and AI throttling are in-memory per runtime, not distributed.
- Docker Compose includes only the web service; no database/cache/worker stack.
- PostgreSQL, Redis, external auth, object storage, queue, scheduler, analytics, and secrets adapters are not implemented.
- Current automated tests cover engines, services, providers, and rendered HTML, but not full browser E2E, visual regression, automated accessibility, load/soak, live credentials, production migrations, or deployment smoke tests.
- A final visual, performance, current-policy, security, and complete-specification audit is still required before launch.

Track remaining work in [TODO](../TODO.md).
