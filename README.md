# SkyPilot

SkyPilot is an independent Hypixel SkyBlock companion that turns request-driven profile data and public economy feeds into progression guidance, planning tools, and transparent calculations.

SkyPilot is not affiliated with or endorsed by Hypixel Inc., Mojang, or Microsoft. It analyzes and explains; it does not automate gameplay, control Minecraft, promise profit, or provide unfair advantages.

## Current status

This repository is a working, tested foundation—not a completed public production release. An [owner-only Sites preview](https://skypilot-skyblock.tratv.chatgpt.site) exists, but the URL alone does not prove that the current source or a live integration has passed deployment checks. The private preview does not constitute a public launch.

Implemented today:

- public homepage, navigation, responsive module surfaces, labeled demo profile, and request states;
- live Minecraft identity and Hypixel profile lookup through a signed fixed-route Cloudflare gateway when its safe feature gate, Worker-only replacement key, shared normalized KV cache, and signing configuration are active; owner-only Sites deployments may use the separately gated 30-second exact-body browser capability and ten-minute per-profile save receipts;
- normalized, bounded Bazaar, active-auction, and ended-auction API views backed by durable D1 snapshots when public economy is enabled;
- idempotent hourly/daily Bazaar aggregates with bounded retention plus an accessible 24H/7D/30D/1Y price-and-volume history view;
- working accessory, Garden, Farming, pet, Minion, Dungeon, Slayer, core-skill, minion-slot, dungeon-readiness, craft, NPC/Bazaar, and money-making planners backed by deterministic tested engines;
- deterministic progression, recommendation, valuation, and net-worth engines with automated tests;
- bounded request-driven base64/gzip/NBT decoding that emits safe inventory, armor, equipment, accessory, and wardrobe summaries without retaining raw NBT or lore;
- optional OpenAI Responses integration grounded in server-resolved profile, progression, current Bazaar, and deterministic calculator facts, with strict numeric conflict checks and graceful offline behavior;
- optional ChatGPT identity mapping, account deletion, owner-scoped saved Minecraft profiles/accounts, preferences, favorites, build creation/sharing, and goal lifecycle when Sites auth and migrations are active;
- allowlisted admin status, aggregate-only AI usage/cost metrics, a lease-aware full economy refresh request, and targeted runtime economy-cache invalidation;
- a 36-table Drizzle/D1 schema, four migrations, portable repository contracts, and a scheduled lease-fenced public-economy worker;
- lint, typecheck, migration-history/smoke, production build, and broad engine/service/provider/render regression coverage, plus GitHub Actions CI configuration.

Still incomplete or inactive:

- several deep module pages are feature maps or narrow planning labs, not complete live-data tools;
- complete gear-upgrade analysis, pets/storage, priced net worth, item browser/search, Auction/item valuation history, and several domain-specific systems are not wired end to end;
- Bazaar search is limited to the loaded result slice, and craft/NPC/money-making inputs are explicitly editable reference scenarios rather than current live recipes, limits, setups, or guaranteed rates;
- durable recommendation Complete/Ignore/Remind Later state, goal/analysis sharing, and broader AI knowledge grounding remain incomplete;
- the browser capability is replayable during its 30-second window and current rate bindings are not an exact global Hypixel credential ledger; public exposure still needs authoritative coordination or explicit residual-risk acceptance;
- the save receipt covers only authenticated owner-scoped profile linking; it does not make the server-side AI path reachable, so AI must stay disabled in an egress-limited deployment;
- the production economy schedule, player-gateway end-to-end smoke, Hypixel Production approval, production D1 data, external auth providers, and a public domain are not all verified;
- Docker runs the web image only; the complete external database/cache/worker stack is not composed;
- no public production URL, custom domain, or live-integration launch is claimed.

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
```

The current local validation result is documented in [Testing](docs/testing.md).

## Environment summary

| Variable | Required | Current use |
| --- | --- | --- |
| `HYPIXEL_API_KEY` | Gateway Worker only in production | Authenticated player/profile requests. Never placed in Sites/browser configuration; public economy requests omit it. |
| `PLAYER_GATEWAY_URL`, `PLAYER_GATEWAY_SECRET`, `REQUIRE_PLAYER_GATEWAY` | Hosted live player analysis | Signed server-to-server gateway transport; production must fail closed through the gateway. |
| `ENABLE_BROWSER_PLAYER_GATEWAY` | Owner-only Sites compatibility | Enables short-lived exact-body browser capabilities plus ten-minute per-profile save receipts. It does not make the AI server path browser-capable and is not public-ready by itself. |
| `SKYPILOT_SITE_ORIGIN` | Gateway Worker browser mode | Non-secret exact HTTPS Sites origin allowed by the Worker's origin-bound signature and CORS policy. |
| `OPENAI_API_KEY` | AI only | Server-only OpenAI Responses request. All non-AI tools remain available without it. |
| `OPENAI_MODEL` | No | AI model override; defaults to the value in `.env.example`. |
| `OPENAI_INPUT_COST_USD_PER_MILLION`, `OPENAI_OUTPUT_COST_USD_PER_MILLION` | No | Non-secret configured rates used only for aggregate AI cost estimates; default to zero. |
| `SITE_NAME`, `SITE_URL` | Recommended | Central branding, canonical URLs, sitemap, and social metadata. |
| `ADMIN_USER_IDS` | Admin only | Comma-separated Sites/ChatGPT user IDs allowed into admin routes. |
| `DATABASE_URL`, `REDIS_URL` | Reserved | Not wired by the current D1/in-memory adapters. |
| `ENABLE_*` | No | Risky player, economy, AI, and platform-auth integrations are enforced and default off; deferred product flags also stay off. |

The Sites D1 binding is named `DB` in `.openai/hosting.json`. Saved account state, goals, AI metrics, and public-economy snapshots/history require that binding and all four repository migrations to be applied.

## Architecture

```text
Browser
  -> vinext app routes and product APIs
  -> deterministic services/engines
  -> provider-neutral repository and upstream-provider contracts
  -> Drizzle/D1, bounded Hypixel/Minecraft calls, optional OpenAI, worker jobs
```

Player lookups are user-triggered and use the signed gateway's normalized KV cache in hosted production. The preferred path is server-to-server; an owner-only compatibility mode lets the same-origin server issue a short-lived, exact-body, origin-bound browser capability for the fixed product route. It never exposes the Hypixel or gateway secret, but it is replayable during its 30-second window and therefore is not a public-launch control by itself. The gateway also returns a ten-minute HMAC receipt for each profile so the authenticated same-origin save route can verify and persist the chosen link without another gateway request. That receipt attests only bounded lookup metadata and does not enable AI server egress. Public economy ingestion is a separate scheduled worker concern; product routes read normalized durable snapshots rather than calling Hypixel. External payloads are normalized before they reach product responses; raw Hypixel proxying is intentionally absent.

Read [Architecture](ARCHITECTURE.md), [architecture overview](docs/architecture.md), and [database guide](docs/database/README.md).

## API surface

Product APIs currently include player lookup, Bazaar/Auction views and Bazaar history, health, optional grounded AI, owner-scoped saved state/builds/favorites/preferences/goals, account deletion, and allowlisted admin actions/AI metrics. They return either `{ "data": ... }` or a safe `{ "error": ... }` envelope.

See [API reference](docs/api.md). SkyPilot does not expose an unrestricted Hypixel proxy.

## Deployment

- [ChatGPT/Codex Sites](docs/deployment/chatgpt-sites.md): current preferred target using the `DB` D1 binding and Sites identity headers.
- [Private player gateway](docs/deployment/player-gateway.md): server and owner-only browser-capability transports, narrow profile-save receipts, Worker/KV/rate bindings, secret boundary, deploy order, and live checks.
- [External hosting](docs/deployment/external-hosting.md): what runs today and what adapters are still required.
- [Migration plan](docs/deployment/migration.md): moving data, auth, workers, secrets, and domain without rewriting SkyBlock logic.

Deployment, production secrets, a production database, scheduler, and domain remain external activation items.

## Operations and security

- [Operations runbook](docs/operations.md)
- [Security policy](SECURITY.md)
- [Hypixel API policy](docs/policies/hypixel-api.md)
- [Database migrations](docs/database/migrations.md)
- [Portability](docs/portability.md)

Report vulnerabilities privately through the repository’s GitHub Security Advisory flow. Never include active credentials or private player payloads in a report.

## Documentation index

Start at [docs/README.md](docs/README.md) for setup, API, architecture, deployment, operations, testing, security, database, policy, portability, and limitations documentation.
