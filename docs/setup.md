# Local Setup

## Prerequisites

- Node.js 22.13 or newer
- npm
- Optional: Docker for the web-only container path

No credential is required to build, test, view the labeled demo, or use deterministic planning surfaces. Live player lookup requires a replacement Hypixel key. AI requires a replacement OpenAI key.

## Install and run

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:3000`.

The local Vite configuration declares a D1 binding named `DB` through the Cloudflare plugin. The schema is not automatically migrated by `npm run dev`; signed-in goal persistence can return `persistence_not_ready` until the repository migration is applied to the selected D1 environment.

## Safe local modes

- `/dashboard?demo=1` uses an explicitly labeled fixture.
- `/dashboard?player=<username>` makes a request-driven live lookup and needs `HYPIXEL_API_KEY`.
- `/bazaar` and `/auctions` use public Hypixel economy endpoints and do not send the profile key.
- `/ai?demo=1` sends bounded labeled demo context only when `OPENAI_API_KEY` is configured.
- account, goal, and admin identity behavior depends on Sites-injected headers; ordinary local requests are anonymous unless a supported local identity harness is provided.

Production code never silently falls back from failed live data to the demo.

## Validate changes

```powershell
npm run lint
npm run typecheck
npm run db:check
npm run security:secrets
npm test
```

`npm test` builds first, then runs engine, service, provider, and rendered-HTML tests. See [Testing](testing.md).

After a schema change:

```powershell
npm run db:generate
.\node_modules\.bin\drizzle-kit.cmd check --config=drizzle.config.ts
```

Review generated SQL before applying it. See [Database migrations](database/migrations.md).

## Docker

```powershell
docker compose up --build
```

The current Compose file starts only the web image on port 3000 and optionally reads `.env`. It does not provision D1/PostgreSQL, Redis, a scheduler, a persistent economy worker, or external auth. Treat it as a web-runtime smoke path, not the complete production stack.

## Common failures

| Symptom | Meaning/action |
| --- | --- |
| Live player analysis returns `missing_credentials` | Install a replacement `HYPIXEL_API_KEY` in server-only configuration. |
| AI returns `ai_not_configured` | AI is optional; install a replacement `OPENAI_API_KEY` or use deterministic tools. |
| Goals return `authentication_required` | The request lacks verified Sites/ChatGPT identity headers. |
| Goals return `persistence_not_ready` | Configure the `DB` binding and apply the migration. |
| Health returns HTTP 503 | Authenticated Hypixel profile access is not configured; inspect the JSON dependency states. |
| Market API returns rate-limit/upstream errors | Respect `Retry-After`; do not loop or add keys. A bounded stale cache may be served when available. |
