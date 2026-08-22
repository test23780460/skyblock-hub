# SkyPilot

SkyPilot is an independent Hypixel SkyBlock companion that turns request-driven profile data and public economy feeds into progression guidance, planning tools, and transparent calculations.

SkyPilot is not affiliated with or endorsed by Hypixel Inc., Mojang, or Microsoft. It analyzes and explains; it does not automate gameplay, control Minecraft, promise profit, or provide unfair advantages.

## Current status

This repository is a working, tested foundation—not a completed public
production release. The migration branch prepares separate native Cloudflare
web and private economy Workers for production and staging. The web Workers use
Static Assets, isolated application D1 and player KV/rate bindings, a shared
dedicated provider-budget D1 binding, and a server-only Hypixel secret; each web Worker reaches only
its matching economy Worker through the `ECONOMY_SERVICE` service binding. The
older owner-only Sites deployment remains a historical rollback target; it is
not the preferred runtime or evidence of a public launch. Exact commit
`e380eedd37bf` is deployed to the staging web Worker as version prefix
`51f5f3e6` at
`https://skypilot-staging.ptravis022.workers.dev`; production deployment,
domain cutover, and public access are not claimed.

Implemented today:

- public homepage, navigation, responsive module surfaces, labeled demo profile, and request states;
- live Minecraft identity and Hypixel profile lookup through the native web
  Worker when its feature gate, rotated Worker secret, environment-isolated KV
  cache, shared `PROVIDER_BUDGET_DB`, and actor/shared Cloudflare abuse filters are
  active; source now contains a conditional PlayerDB username resolver for the
  Cloudflare egress failure case; focused tests and staging egress/schema/error
  smoke pass, but the configured staging Hypixel credential is invalid and no
  successful live player response is claimed; the older signed gateway and
  browser-capability path remain rollback compatibility only;
- normalized, bounded Bazaar, active-auction, and ended-auction API views backed by durable D1 snapshots when public economy is enabled;
- idempotent hourly/daily Bazaar aggregates with bounded retention plus an accessible 24H/7D/30D/1Y price-and-volume history view;
- working accessory, Garden, Farming, pet, Minion, Dungeon, Slayer, core-skill, minion-slot, dungeon-readiness, craft, NPC/Bazaar, and money-making planners backed by deterministic tested engines;
- deterministic progression, recommendation, valuation, and net-worth engines with automated tests;
- bounded request-driven base64/gzip/NBT decoding that emits safe inventory, armor, equipment, accessory, and wardrobe summaries without retaining raw NBT or lore;
- optional OpenAI Responses integration grounded in server-resolved profile, progression, current Bazaar, and deterministic calculator facts, with strict numeric conflict checks and graceful offline behavior;
- a disabled Cloudflare Access JWT adapter plus canonical identity mapping,
  account deletion, owner-scoped saved Minecraft profiles/accounts,
  preferences, favorites, build creation/sharing, and goal lifecycle; account
  features stay off until optional public sign-in is solved and verified;
- allowlisted admin status, aggregate-only AI usage/cost metrics, and one
  bounded service-binding refresh request to the private economy Worker;
- a 37-table Drizzle/D1 schema, five migrations, portable repository contracts,
  and a separately deployable lease-fenced public-economy Worker that is private,
  initially disabled, and has no Cron Trigger;
- lint, typecheck, migration-history/smoke, production build, and broad engine/service/provider/render regression coverage, plus GitHub Actions CI configuration.

Still incomplete or inactive:

- several deep module pages are feature maps or narrow planning labs, not complete live-data tools;
- both official Minecraft username hosts currently reject or fail native
  Cloudflare Worker egress. The conditional PlayerDB fallback is implemented in
  source, covered by focused tests plus the public privacy disclosure, and its
  staging egress/schema/error path is verified. The staging credential is
  invalid, so neither username nor direct Java UUID lookup has yet returned
  successful live player data from this deployment;
- complete gear-upgrade analysis, pets/storage, priced net worth, item browser/search, Auction/item valuation history, and several domain-specific systems are not wired end to end;
- Bazaar search is limited to the loaded result slice, and craft/NPC/money-making inputs are explicitly editable reference scenarios rather than current live recipes, limits, setups, or guaranteed rates;
- durable recommendation Complete/Ignore/Remind Later state, goal/analysis sharing, and broader AI knowledge grounding remain incomplete;
- a fixed-window reservation in the dedicated provider-budget D1 guards the one
  shared Hypixel key across staging and production, while
  Cloudflare rate bindings remain coarse per-location abuse filters; public
  exposure still needs staging load/capacity evidence, monitoring, and validation
  against the approved quota;
- optional public-account sign-in is unresolved; the Access verifier is useful
  for a private hostname, but protecting the whole public hostname would break
  account-free tools;
- public economy requires Workers Paid, all remote migrations, usage/cost and
  capacity evidence, replacement of the current non-incremental active-Auction
  crawl with a reviewed incremental/compacted ingestion design, and
  exactly one reviewed production Cron on the private economy Worker before
  both runtime flags are enabled; every current environment keeps them off;
- Hypixel Production approval, D1 backup/restore, broader account QA, GitHub
  Workers Builds connections, alerting, and a custom domain are not verified;
- Docker runs the web image only; the complete external database/cache/worker stack is not composed;
- no public-access production launch or custom domain is claimed.

See [Known limitations](docs/limitations.md) and [TODO](TODO.md) before treating a surface as production-ready.

## Quick start

Requirements: Node.js 22.13 or newer and npm.

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:3000`. Without credentials, the labeled demo and deterministic public planning surfaces still work. Live player, economy, AI, and platform-auth integrations are safe-default off; enable them only after satisfying the coordination and trust requirements in the environment guide.

Do not paste real credentials into source, chat, issues, logs, or documentation. Any previously exposed key must be revoked and replaced before use.

Detailed instructions: [Local setup](docs/setup.md) and [environment variables](docs/environment.md).

## Useful commands

```powershell
npm run dev          # local vinext/Vite server
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm run test:unit    # engine, service, and provider suites
npm test             # production build + all current tests
npm run build        # production vinext build
npm run start        # serve a built application
npm run db:generate  # generate Drizzle migrations after schema changes
npm run db:check     # validate Drizzle migration history
npm run db:smoke     # apply the full migration chain to isolated SQLite
npm run security:secrets # scan tracked project content for secret patterns
npm run cf:dev       # local native web Worker using staging-shaped bindings
npm run cf:build     # native build; main -> production, other CI branches -> staging
npm run cf:dry-run   # production native Wrangler dry-run
npm run cf:economy:dry-run # private production economy Worker dry-run
```

The current local validation result is documented in [Testing](docs/testing.md).

## Environment summary

| Variable | Required | Current use |
| --- | --- | --- |
| `HYPIXEL_API_KEY` | Named native web Workers | Authenticated player/profile requests. Install as an encrypted staging/production web-Worker secret; private economy Workers use keyless feeds and must not receive it. |
| `DB` | Cloudflare binding | Separate staging/production D1 databases for durable application and economy state. |
| `PROVIDER_BUDGET_DB` | Cloudflare binding | One dedicated D1 database shared by staging and production to coordinate the one shared Hypixel credential. |
| `PLAYER_CACHE` | Cloudflare binding | Separate staging/production KV namespaces for normalized request-driven player/provider values. |
| `PLAYER_ACTOR_LIMITER`, `PLAYER_GLOBAL_LIMITER` | Cloudflare bindings | Coarse per-location filters. The actor limiter protects player routes; the shared limiter is checked only when an authenticated Hypixel transport is about to run. Neither owns the exact credential budget. |
| `provider_request_budgets` | Dedicated D1 table | Atomic fixed-window reservations that globally guard the shared Hypixel key. |
| `ECONOMY_SERVICE` | Cloudflare service binding | Connects each web Worker only to its matching private economy Worker. |
| `OPENAI_API_KEY` | AI only | Server-only OpenAI Responses request. All non-AI tools remain available without it. |
| `OPENAI_MODEL` | No | AI model override; defaults to the value in `.env.example`. |
| `OPENAI_INPUT_COST_USD_PER_MILLION`, `OPENAI_OUTPUT_COST_USD_PER_MILLION` | No | Non-secret configured rates used only for aggregate AI cost estimates; default to zero. |
| `SITE_NAME`, `SITE_URL` | Recommended | Central branding, canonical URLs, sitemap, and social metadata. |
| `ENABLE_ACCOUNT_AUTH`, `AUTH_PROVIDER` | Account features | Off by default; the included adapter accepts only cryptographically verified Cloudflare Access JWTs. |
| `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD` | Access adapter only | Non-secret issuer origin and application audience; do not enable public accounts without an optional-session design. |
| `ADMIN_USER_IDS` | Admin only | Comma-separated verified native identity subjects allowed into admin routes. |
| `PLAYER_GATEWAY_*`, `REQUIRE_PLAYER_GATEWAY` | Legacy rollback only | Not required or configured by the native web Worker. |
| `DATABASE_URL`, `REDIS_URL` | Reserved | Not wired by the current D1/in-memory adapters. |
| `ENABLE_*` | No | Risky player, economy, AI, and platform-auth integrations are enforced and default off; deferred product flags also stay off. |

The application D1 binding is `DB` in both `wrangler.jsonc` and
`wrangler.economy.jsonc`. Saved account state, goals, AI metrics, and
public-economy snapshots/history require the matching environment database and
all five application migrations. Native web Workers also bind the same
dedicated `PROVIDER_BUDGET_DB`; its separate additive migration installs the one
table used to coordinate the shared Hypixel credential. `.openai/hosting.json` is
retained only for rollback packaging and is removed from native build output.

## Architecture

```text
Browser
  -> skypilot web Worker: Static Assets + vinext routes/product APIs
       -> deterministic services/engines
       -> isolated app D1 + KV + shared provider-budget D1
       -> bounded Hypixel/Minecraft calls + optional OpenAI
       -> ECONOMY_SERVICE -> private skypilot-economy Worker
                              -> scheduler-independent public-resource jobs
```

Player lookups are user-triggered. Username resolution tries the two official
Minecraft identity hosts first. Only transport/access failures may reach the
conditional PlayerDB fallback; an authoritative not-found response does not.
SkyPilot's application code supplies only the normalized requested username and
an identifying service user agent, and does not copy browser cookies,
authentication, profile selectors, or the Hypixel key into that request.
Cloudflare can add network headers to Worker subrequests, and those headers may
contain a visitor IP depending on the destination's routing; the public privacy
notice discloses that possibility. SkyPilot caches only the latest validated
username/UUID mapping. The native web Worker keeps the key
server-side, uses normalized KV fresh/stale caching, and applies a coarse
route-level actor filter. Mojang identity traffic does not spend Hypixel quota.
Only when a cache miss reaches the authenticated Hypixel transport does the
Worker perform one coarse `PLAYER_GLOBAL_LIMITER` check and atomically reserve
two tokens in the shared `PROVIDER_BUDGET_DB`. The resolved UUID and
username/display name must both agree with the authenticated Hypixel player
response before analysis continues. No identity
fallback creates monitoring, history, or scheduled player refresh. The browser calls only same-origin product
routes. Public economy ingestion runs only in the private, separately deployed
economy Worker and is scheduler-independent and D1-backed. It remains disabled
until its Paid-plan, capacity, and incremental-design gates pass; the current
active-Auction crawl is non-incremental and no production Cron is configured.
product routes never crawl Hypixel. External payloads are normalized before
product responses, and raw Hypixel proxying is intentionally absent.

Read [Architecture](ARCHITECTURE.md), [architecture overview](docs/architecture.md), and [database guide](docs/database/README.md).

## API surface

Product APIs currently include player lookup, Bazaar/Auction views and Bazaar history, health, optional grounded AI, owner-scoped saved state/builds/favorites/preferences/goals, account deletion, and allowlisted admin actions/AI metrics. They return either `{ "data": ... }` or a safe `{ "error": ... }` envelope.

See [API reference](docs/api.md). SkyPilot does not expose an unrestricted Hypixel proxy.

## Deployment

- [Native Cloudflare setup](docs/CLOUDFLARE_SETUP.md): current deployment runbook for separate web/economy Workers, Static Assets, D1, KV/rate/service bindings, secrets, and GitHub Workers Builds.
- [Cloudflare migration audit](docs/CLOUDFLARE_MIGRATION.md): implemented boundary, cutover, rollback, and public-launch blockers.
- [ChatGPT/Codex Sites](docs/deployment/chatgpt-sites.md): historical owner-only rollback deployment.
- [Private player gateway](docs/deployment/player-gateway.md): historical rollback transport, not the native production path.
- [External hosting](docs/deployment/external-hosting.md): what runs today and what adapters are still required.
- [Migration plan](docs/deployment/migration.md): moving data, auth, workers, secrets, and domain without rewriting SkyBlock logic.

The exact staging web deployment above and its disabled-economy service binding
are verified. Production deployment, a valid rotated credential, production
secrets/migrations, GitHub Workers Builds connections, optional economy
activation, and the final domain remain external activation items.

## Operations and security

- [Operations runbook](docs/operations.md)
- [Security policy](SECURITY.md)
- [Hypixel API policy](docs/policies/hypixel-api.md)
- [Database migrations](docs/database/migrations.md)
- [Portability](docs/portability.md)

Report vulnerabilities privately through the repository’s GitHub Security Advisory flow. Never include active credentials or private player payloads in a report.

## Documentation index

Start at [docs/README.md](docs/README.md) for setup, API, architecture, deployment, operations, testing, security, database, policy, portability, and limitations documentation.
