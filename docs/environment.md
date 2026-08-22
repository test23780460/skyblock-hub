# Environment and bindings

Copy `.env.example` to an ignored `.env` for the ordinary vinext development
path. For `npm run cf:dev`, copy `.dev.vars.example` to ignored `.dev.vars` and
place only local Worker secrets there. Never commit either populated file or
reuse credentials across environments unless the credential is deliberately
coordinated by one shared budget authority. The current native topology uses one
Hypixel credential in both web environments and one shared provider-budget D1.

## Variables

| Name | Default/example | Status and behavior |
| --- | --- | --- |
| `HYPIXEL_API_KEY` | blank | Required only when live player lookup is enabled. Native staging/production install the same approved credential as an encrypted Worker secret and coordinate it through `PROVIDER_BUDGET_DB`; it is sent only in Hypixel's `API-Key` header. Public economy calls omit it. |
| `OPENAI_API_KEY` | blank | Used by `/api/ai` only when `ENABLE_AI_ASSISTANT=true`; all deterministic tools work without it. |
| `OPENAI_MODEL` | example value | Responses API model override. Validate model access before activation. |
| `OPENAI_INPUT_COST_USD_PER_MILLION` | `0` | Non-secret configured rate for aggregate cost estimates; zero claims no cost estimate. |
| `OPENAI_OUTPUT_COST_USD_PER_MILLION` | `0` | Non-secret configured rate for aggregate cost estimates; zero claims no cost estimate. |
| `SITE_NAME` | `SkyPilot` | Central display/application name. |
| `SITE_URL` | `http://localhost:3000` | Canonical URL/metadata origin. Set the exact HTTPS Worker/custom-domain origin in each remote environment. |
| `SKYPILOT_ENVIRONMENT` | `development` | Safe environment label returned by health; native config sets `local`, `staging`, or `production`. |
| `AUTH_PROVIDER` | `cloudflare-access` | Only supported native identity adapter. It remains inert while account auth is off. |
| `CF_ACCESS_TEAM_DOMAIN` | blank | Exact HTTPS `*.cloudflareaccess.com` team origin, with no path, for the disabled Access adapter. |
| `CF_ACCESS_AUD` | blank | Access application audience for JWT verification. It is not a secret. |
| `ADMIN_USER_IDS` | blank | Comma-separated verified identity subjects allowed into admin routes. Empty authorizes nobody. |
| `ENABLE_AI_ASSISTANT` | `false` | Enable only with a rotated key and distributed abuse/cost controls. |
| `ENABLE_ACCOUNT_AUTH` | `false` | Keep off until optional public sign-in/session behavior passes end-to-end tests. |
| `ENABLE_PLAYER_LOOKUP` | `false` | Named native web environments set this on only with their Hypixel secret, shared `PROVIDER_BUDGET_DB`, KV, and both coarse rate bindings. |
| `ENABLE_BROWSER_PLAYER_GATEWAY` | `false` | Legacy owner-only Sites rollback compatibility; native environments keep it off. |
| `REQUIRE_PLAYER_GATEWAY` | `false` | Legacy rollback transport policy; native environments keep it off. |
| `ENABLE_PUBLIC_ECONOMY` | `false` | Initial web and private economy Workers keep it off. The current active-Auction crawl is non-incremental; enable both copies only after Workers Paid, remote migrations, usage/capacity monitoring, a reviewed incremental or compacted replacement, and one reviewed production Cron on the private Worker are ready. |
| `ENABLE_ADS` | `false` | Parsed only; advertising is not activated. |
| `ENABLE_PREMIUM` | `false` | Parsed only; premium is not activated. |
| `ENABLE_PUBLIC_PROFILES` | `false` | Public profile sharing is not implemented. |
| `ENABLE_GUILD_TOOLS` | `false` | Advanced Guild tooling is deferred. |
| `ENABLE_PRICE_ALERTS` | `false` | Price alerts are deferred. |
| `ENABLE_EXPERIMENTAL_FEATURES` | `false` | Experimental features are not release-ready. |

`PLAYER_GATEWAY_URL`, `PLAYER_GATEWAY_SECRET`, and `SKYPILOT_SITE_ORIGIN` belong
only to the retained Sites/player-gateway rollback deployment. They are not
present in native `wrangler.jsonc`. `DATABASE_URL` and `REDIS_URL` remain
unimplemented external-host placeholders; setting them does not create an
adapter.

## Native Cloudflare bindings and Workers

Root `wrangler.jsonc` defines the web Workers; `wrangler.economy.jsonc` defines
the private economy Workers. Both use compatibility date `2026-08-21`.

| Binding | Purpose | Isolation |
| --- | --- | --- |
| `ASSETS` | Generated `dist/client` and public files through Workers Static Assets | Generated per build |
| `DB` | D1 application records, aggregate metrics, economy feeds/history/lease state | Different staging and production databases |
| `PROVIDER_BUDGET_DB` | Atomic fixed-window Hypixel credential reservations | One dedicated database shared by the staging and production web Workers |
| `PLAYER_CACHE` | Normalized request-driven player/Minecraft provider values with fresh/stale metadata | Different staging and production KV namespaces |
| `PLAYER_ACTOR_LIMITER` | Route-bound coarse per-location opaque-actor abuse filter | Different staging and production namespace IDs |
| `PLAYER_GLOBAL_LIMITER` | Coarse per-location authenticated-Hypixel-call filter; not the exact global ledger | Different staging and production namespace IDs |
| `ECONOMY_SERVICE` | Web-to-private-Worker service binding | Production targets `skypilot-economy`; staging targets `skypilot-economy-staging` |

The private economy Workers use the same environment-matched `DB` binding but
have no Static Assets, player KV/rate bindings, runtime secrets, public
`workers.dev` hostname, or preview URL. Their service-binding endpoint and
scheduled handler both fail closed while `ENABLE_PUBLIC_ECONOMY=false`.

There is no Images or R2 binding. All five application migrations must be
applied to each selected app `DB` before durable features are enabled. Apply the
one additive migration in `drizzle-provider-budget/` once to the shared
`PROVIDER_BUDGET_DB`; its `provider_request_budgets` table atomically guards the
one shared Hypixel key across locations and environments. Cloudflare rate-limit
bindings remain coarse per-location abuse filters. The route actor filter is
checked on player endpoints. Mojang identity calls do not consume Hypixel
quota; only an authenticated Hypixel transport attempt performs one
`PLAYER_GLOBAL_LIMITER` check and one two-token D1 reservation.

Production and staging web Workers both enable player lookup and therefore each
require an encrypted copy of the one approved `HYPIXEL_API_KEY`. The private economy Workers
use keyless public feeds and must not receive that secret. Web Workers keep
account auth, AI, and the browser gateway off; both Workers in each environment
keep public economy and every Cron Trigger off in the initial posture.

The native web build sets `CLOUDFLARE_ENV` through the repository scripts.
`main` resolves to production and every other `WORKERS_CI_BRANCH` to staging.
The economy scripts select the matching environment in
`wrangler.economy.jsonc`. Wrangler environments do not inherit
bindings/variables, so review all four named Worker configurations whenever a
binding or variable changes. Deploy the matching private economy Worker before
the web Worker so `ECONOMY_SERVICE` resolves.

## Identity boundary

The Cloudflare Access adapter verifies the assertion signature with the team
JWK set plus exact issuer, audience, algorithm, expiry, and bounded subject/email
claims. It does not trust a header merely because it exists.

Access can protect an intentionally private hostname. It is not automatically
an optional public-account system: whole-host protection would block anonymous
tools, while protecting only `/auth/login` does not create an application
session across unprotected routes. Keep `ENABLE_ACCOUNT_AUTH=false` unless that
boundary is replaced or proven end to end.

## Secret rules

1. Use Cloudflare Worker secrets for remote credentials and separate values per
   environment.
2. Revoke any credential previously pasted into chat, logs, issues,
   screenshots, or commits.
3. Never put keys in URLs, client variables/storage, fixtures, migration data,
   analytics, or error context.
4. Treat Workers Builds variables as build-time configuration, not runtime
   secrets.
5. Native build scripts scrub generated `.dev.vars*`, `.env*`, and Sites
   packaging before dry-run/deploy; verify deploy artifacts without printing
   file contents.
6. Scan client/server bundles, source maps, logs, and responses before release.

See [Native Cloudflare setup](CLOUDFLARE_SETUP.md),
[Security](../SECURITY.md), and the [legacy Sites rollback
guide](deployment/chatgpt-sites.md).
