# SkyPilot

SkyPilot is an independent Hypixel SkyBlock companion that turns request-driven profile data and public economy feeds into progression guidance, planning tools, and transparent calculations.

SkyPilot is not affiliated with or endorsed by Hypixel Inc., Mojang, or Microsoft. It analyzes and explains; it does not automate gameplay, control Minecraft, promise profit, or provide unfair advantages.

## Current status

This repository is a working, tested foundation—not a completed public production release. A private, owner-only Sites preview may be published from the validated source, but that does not activate live integrations or constitute a public launch.

Implemented today:

- public homepage, navigation, responsive module surfaces, labeled demo profile, and request states;
- live Minecraft identity and Hypixel profile lookup when the safe feature gate and a server-side Hypixel key are both configured;
- normalized, bounded Bazaar, active-auction, and ended-auction API views;
- deterministic progression, recommendation, accessory, valuation, net-worth, Bazaar, and activity calculator engines with automated tests;
- optional OpenAI Responses integration with beginner/normal/advanced modes and graceful offline behavior;
- optional ChatGPT identity mapping and D1-backed goal creation when Sites auth and migrations are active;
- allowlisted admin status and three bounded economy/cache actions;
- a 30-table Drizzle/D1 schema, migration, portable repository contracts, and worker job functions;
- lint, typecheck, build, unit/service/provider integration tests, rendered-HTML tests, and GitHub Actions CI.

Still incomplete or inactive:

- many deep module pages are polished feature maps with editable planning labs, not complete live-data tools;
- inventory/NBT gear analysis, item browser/search, historical market charts, persistent economy sinks, valuation history, and several skill-specific systems are not wired end to end;
- worker scheduling, distributed caching/rate budgets, production D1 data, external auth providers, and a public domain are not activated;
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
npm run security:secrets # scan tracked project content for secret patterns
```

The current local validation result is documented in [Testing](docs/testing.md).

## Environment summary

| Variable | Required | Current use |
| --- | --- | --- |
| `HYPIXEL_API_KEY` | Live player analysis only | Server-only authenticated Hypixel requests. Not used for public economy requests. |
| `OPENAI_API_KEY` | AI only | Server-only OpenAI Responses request. All non-AI tools remain available without it. |
| `OPENAI_MODEL` | No | AI model override; defaults to the value in `.env.example`. |
| `SITE_NAME`, `SITE_URL` | Recommended | Central branding, canonical URLs, sitemap, and social metadata. |
| `ADMIN_USER_IDS` | Admin only | Comma-separated Sites/ChatGPT user IDs allowed into admin routes. |
| `DATABASE_URL`, `REDIS_URL` | Reserved | Not wired by the current D1/in-memory adapters. |
| `ENABLE_*` | No | Risky player, economy, AI, and platform-auth integrations are enforced and default off; deferred product flags also stay off. |

The Sites D1 binding is named `DB` in `.openai/hosting.json`. Goal persistence requires that binding and the repository migration to be applied.

## Architecture

```text
Browser
  -> vinext app routes and product APIs
  -> deterministic services/engines
  -> provider-neutral repository and upstream-provider contracts
  -> Drizzle/D1, bounded Hypixel/Minecraft calls, optional OpenAI, worker jobs
```

Player lookups are user-triggered and cached. Public economy ingestion is a separate worker concern. External payloads are normalized before they reach product responses; raw Hypixel proxying is intentionally absent.

Read [Architecture](ARCHITECTURE.md), [architecture overview](docs/architecture.md), and [database guide](docs/database/README.md).

## API surface

Product APIs currently include player lookup, Bazaar and Auction views, health, optional AI, goals, and allowlisted admin actions. They return either `{ "data": ... }` or a safe `{ "error": ... }` envelope.

See [API reference](docs/api.md). SkyPilot does not expose an unrestricted Hypixel proxy.

## Deployment

- [ChatGPT/Codex Sites](docs/deployment/chatgpt-sites.md): current preferred target using the `DB` D1 binding and Sites identity headers.
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
