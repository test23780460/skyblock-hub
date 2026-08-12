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

The local Vite configuration declares a D1 binding named `DB` through the Cloudflare plugin. The schema is not automatically migrated by `npm run dev`; saved account state, goals, aggregate AI metrics, and public-economy snapshots/history can return unavailable/not-ready responses until all four repository migrations are applied to the selected D1 environment.

## Safe local modes

- `/dashboard?demo=1` uses an explicitly labeled fixture.
- `/dashboard?player=<username-or-java-uuid>` makes a request-driven live lookup and needs `HYPIXEL_API_KEY`. A UUID bypasses Minecraft username resolution when that separate service is unavailable.
- `/bazaar` and `/auctions` read durable D1 snapshots and do not call Hypixel from web requests. Bazaar history begins collecting only after elected worker cycles run; public Hypixel feeds do not use the profile key.
- `/money-making`, `/skills`, `/economy`, `/dungeons`, `/minions`, and `/calculators` expose labeled manual deterministic scenarios without credentials.
- `/ai?demo=1` asks the server to resolve bounded labeled demo context when AI is enabled. The AI page may instead request a user-triggered live profile and fresh D1 Bazaar selectors when their separate gates are enabled; the browser never supplies those facts or prices.
- account, saved-state, build, goal, and admin identity behavior depends on Sites-injected headers; ordinary local requests are anonymous unless a supported local identity harness is provided.

Production code never silently falls back from failed live data to the demo.

## Validate changes

```powershell
npm run lint
npm run typecheck
npm run db:check
npm run db:smoke
npm run security:secrets
npm test
```

`npm test` builds first, then runs engine, service, provider, and rendered-HTML tests. See [Testing](testing.md).

After a schema change:

```powershell
npm run db:generate
npm run db:check
npm run db:smoke
```

Review generated SQL before applying it. See [Database migrations](database/migrations.md).

## Docker

```powershell
docker compose up --build
```

The current Compose file starts only the web image on port 3000 and optionally reads `.env`. It does not provision D1/PostgreSQL, Redis, a scheduled economy trigger, or external auth. Treat it as a web-runtime smoke path, not the complete production stack.

## Common failures

| Symptom | Meaning/action |
| --- | --- |
| Live player analysis returns `missing_credentials` | Install a replacement `HYPIXEL_API_KEY` in server-only configuration. |
| AI returns `ai_not_configured` | AI is optional; install a replacement `OPENAI_API_KEY` or use deterministic tools. |
| Goals return `authentication_required` | The request lacks verified Sites/ChatGPT identity headers. |
| Saved state or goals return `persistence_not_ready` | Configure the `DB` binding and apply all four migrations. |
| Economy returns `upstream_unavailable` before any rows | Apply all four migrations, register exactly one worker schedule (or request an allowlisted admin cycle), and wait for a complete snapshot publish. |
| Bazaar history says it is collecting | Run later elected worker cycles. History is created from newer source timestamps and no prior prices are fabricated. |
| Health JSON shows a disabled/degraded dependency | Liveness remains HTTP 200; inspect the dependency state and activate only the intended integration. |
| Economy worker reports leased/backing off | Do not bypass the D1 lease/circuit. Respect `Retry-After` and continue serving the last complete stale-labeled snapshot when available. |
