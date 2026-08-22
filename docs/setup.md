# Local setup

## Prerequisites

- Node.js 22.13 or newer
- npm
- Optional: Docker for the web-image smoke path
- Optional: a **rotated** Hypixel key for an intentional live player lookup

No credential is required to build, test, use the labeled demo, or use the
deterministic planning surfaces. Never reuse a key that appeared in chat, a
screenshot, a log, an issue, or a commit.

## Ordinary application development

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:3000`. The ignored `.env` is for the ordinary vinext
development path. Keep secret values blank unless the corresponding feature is
being tested deliberately.

The Vite configuration exposes a local D1 binding named `DB`, but `npm run dev`
does not apply the schema. Apply all five repository migrations before testing
saved state, goals, aggregate AI metrics, or economy snapshots/history.

## Native Worker development

Use the native path when testing the web Worker entry and binding composition
prepared for Cloudflare. The private economy Worker uses
`wrangler.economy.jsonc` and the `cf:economy:*` scripts:

```powershell
Copy-Item .dev.vars.example .dev.vars
npx wrangler d1 migrations apply DB --local
npx wrangler d1 migrations apply PROVIDER_BUDGET_DB --local
npm run cf:dev
```

Put a local Hypixel key only in the ignored `.dev.vars`. Do not populate both
`.env` and `.dev.vars` for the same Wrangler session. Local workerd storage is
separate from remote staging and production resources.

`npm run cf:dev` selects the staging-shaped configuration locally: Static
Assets, local app D1/KV, local rate-limit emulation, the dedicated
`PROVIDER_BUDGET_DB`, player
lookup composition, and no economy Cron. Account auth, AI, the legacy browser
gateway, and public economy remain off. Remote deployment must create the
matching private economy Worker before the web Worker so `ECONOMY_SERVICE`
resolves.

## Safe local modes

- `/dashboard?demo=1` uses an explicitly labeled fixture.
- `/dashboard?player=<username-or-java-uuid>` performs a request-driven lookup
  only when `ENABLE_PLAYER_LOOKUP=true` and the native key/cache/admission
  dependencies are configured. Username resolution uses Minecraft Services
  with a bounded official Mojang fallback. Source also includes a conditional
  PlayerDB fallback after both official resolvers fail for transport/access.
  Focused tests and the public privacy disclosure pass; staging egress verification remains.
  Identity-only traffic does not spend Hypixel quota. A UUID skips all identity
  services and is the actionable recovery path during an identity-service
  outage. A username-derived UUID and display name must both agree with the
  authenticated Hypixel player record before analysis continues.

PlayerDB needs no SkyPilot secret. Its official documentation asks API clients
to send an identifying user agent. SkyPilot application code supplies that plus
the normalized username and copies no browser cookies, authentication, profile
selectors, or Hypixel key. Cloudflare may add network headers, including
visitor-IP metadata depending on destination routing. Before treating the
fallback as active, review the
[PlayerDB API](https://playerdb.co/), the [Nodecraft privacy policy](https://nodecraft.com/legal/privacy-policy),
passing focused provider tests, and a staging lookup where both official hosts fail.
- `/bazaar` and `/auctions` read D1 snapshots; page requests never call Hypixel.
  With public economy off or before a real first publication, they show a
  designed unavailable state rather than fixture data.
- `/money-making`, `/skills`, `/economy`, `/dungeons`, `/minions`, and
  `/calculators` provide labeled deterministic/manual scenarios without an
  account.
- `/ai?demo=1` remains unavailable unless AI is explicitly enabled with its own
  server secret and controls.
- account, saved-state, goal, build, and admin routes remain anonymous while
  `ENABLE_ACCOUNT_AUTH=false`. Native account auth does not use Sites headers.

Production code never silently substitutes the demo after a live-data failure.

## Validate changes

```powershell
npm run lint
npm run typecheck
npm run cf:types:check
npm run db:check
npm run db:smoke
npm run security:secrets
npm test
npm run cf:build:staging
npm run cf:build:production
```

`npm test` builds first, then runs engine, service, provider/security, native
Cloudflare-configuration, and rendered-HTML tests. See [Testing](testing.md).

After a schema change:

```powershell
npm run db:generate
npm run db:check
npm run db:smoke
```

Review generated SQL before applying it. Never edit an already-applied
migration. See [Database migrations](database/migrations.md).

## Docker

```powershell
docker compose up --build
```

The Compose file starts only the web image on port 3000 and may read `.env`. It
does not provision D1/PostgreSQL, KV/Redis, rate bindings, a scheduler, or
external auth. Treat it as a web-runtime smoke path, not a production stack.

## Common failures

| Symptom | Meaning/action |
| --- | --- |
| Player analysis returns `missing_credentials` or a binding error | Enable lookup only in the intended environment, install its rotated `HYPIXEL_API_KEY` as a web-Worker secret, apply the one provider-budget migration, and verify `PROVIDER_BUDGET_DB`, `PLAYER_CACHE`, and both coarse rate bindings. The app `DB` is not the active credential budget, and native lookup does not require gateway variables. |
| AI returns `ai_not_configured` | AI is optional and safe-default off; deterministic tools remain available. |
| Goals return `authentication_required` | Account auth is off or the configured native identity assertion failed verification. |
| Saved state or goals return `persistence_not_ready` | Configure `DB` and apply all five migrations to the selected environment. |
| Economy is unavailable before any rows | This is the expected initial posture. Keep both flags and every Cron off while the active-Auction crawl is non-incremental and until Workers Paid, remote app migrations, capacity/usage monitoring, and a reviewed incremental replacement are ready on the private economy Worker. |
| Bazaar history says it is collecting | History begins only from newer real source timestamps; no earlier prices are fabricated. |
| Health JSON shows a disabled/degraded dependency | Liveness remains HTTP 200; inspect the safe dependency state and enable only the intended integration. |

For remote resources, Builds, secrets, smoke tests, and rollback, use the
[native Cloudflare setup](CLOUDFLARE_SETUP.md). The [separate player gateway](deployment/player-gateway.md)
is retained only for rollback of the historical Sites deployment.
