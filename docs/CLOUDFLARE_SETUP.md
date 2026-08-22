# Cloudflare setup

This runbook is for the native Cloudflare Workers deployment of SkyPilot. Each
environment uses a public web Worker and a separately deployed private economy
Worker, plus Workers Static Assets, D1, Workers KV, service/rate bindings,
Wrangler, and Cloudflare Workers Builds. It does not use the deprecated Workers
Sites product, and it must not depend on ChatGPT Sites at runtime.

The repository configuration is the source of truth. Before copying a command
from this guide, confirm that the checked-out commit contains the root
`wrangler.jsonc`, `wrangler.economy.jsonc`, and the corresponding `package.json`
scripts. Both native configs pin compatibility date `2026-08-21`.

## Requirements

- A Cloudflare account with permission to create Workers, D1 databases, KV
  namespaces, rate-limit bindings, secrets, Cron Triggers, and Workers Builds.
- Workers Paid plus a reviewed D1 usage/cost and capacity budget, monitoring,
  and replacement of the current non-incremental active-Auction crawl with an
  incremental or compacted ingestion design before enabling public
  economy. The Free plan is suitable for a prototype, not the current row-heavy
  one-minute baseline.
- GitHub access to `test23780460/skyblock-hub`, including permission to install
  the Cloudflare Workers & Pages GitHub App for that repository.
- Node.js 22.13 or newer and npm for local validation.
- A rotated Hypixel Production application key before public player lookup is
  enabled. A key that appeared in chat, a screenshot, a log, an issue, or a
  commit is exposed and must not be reused.
- Review the [PlayerDB API](https://playerdb.co/) and [Nodecraft privacy policy](https://nodecraft.com/legal/privacy-policy),
  keep SkyPilot's public privacy disclosure current, and pass focused plus
  staging tests before relying on the conditional username fallback. Focused
  tests and staging egress/schema/error smoke pass; successful live player data
  still requires a valid rotated Hypixel credential. PlayerDB requires no secret.
- A verified authentication design before any account, saved-state, AI-with-
  auth, or administrator feature is enabled. See [Identity](#identity).

Cloudflare's current primary references are [Workers Builds], [Workers Static
Assets], [Cloudflare Vite], [Wrangler configuration], [Workers secrets], [D1
migrations], [D1 limits], [D1 pricing], [Cron Triggers], [Access JWT
validation], and [Worker rollbacks].

## Deployment environments

Production and staging are physically separated except for the dedicated
provider-budget database that deliberately coordinates their one shared Hypixel
credential. A staging build must not write
to the production database, use the production player cache or rate-limit
namespaces, run the production economy schedule, or inherit production-only
  secrets other than the deliberately shared Hypixel credential. Local development uses workerd's local persistence, not either remote
database.

| Concern | Production | Staging | Local |
| --- | --- | --- | --- |
| Web Worker | `skypilot` | `skypilot-staging` | local workerd process |
| Private economy Worker | `skypilot-economy` | `skypilot-economy-staging` | focused tests and Wrangler dry-run; not composed by `cf:dev` |
| Build selection | `main` | every other `WORKERS_CI_BRANCH` | `npm run cf:dev` selects staging config |
| D1 `DB` | `skypilot-production` | `skypilot-staging` | local D1 |
| D1 `PROVIDER_BUDGET_DB` | `skypilot-provider-budget` | the same `skypilot-provider-budget` | local D1 |
| KV `PLAYER_CACHE` | production namespace | separate staging namespace | local KV |
| Rate-limit namespaces | production actor/global IDs | separate staging actor/global IDs | local emulation |
| Economy service binding | web targets `skypilot-economy` | web targets `skypilot-economy-staging` | not composed by `cf:dev` |
| Economy public/preview URL | disabled | disabled | disabled |
| Economy Cron | none in the initial deploy | none | none |
| Hypixel key | one rotated approved credential installed as a production Worker secret | the same credential installed separately as a staging Worker secret | ignored `.dev.vars`, only for intentional live testing |
| Public economy | off until Paid/migrations/capacity/monitoring gates pass and the active-Auction crawl is incremental | off | off |
| Account/auth features | off | off | off |
| Browser player gateway | off | off | off |
| AI | off | off | off |

Player lookup is enabled in both named remote environments and therefore
requires `HYPIXEL_API_KEY` in both. The encrypted values intentionally represent
one approved credential, and both Workers bind the same `PROVIDER_BUDGET_DB` so
the key has one global budget. Do not expose those deployments publicly until
staging load/caching/global-budget checks and monitoring in [Player lookup](#player-lookup)
are complete.

Wrangler bindings and `vars` are not automatically inherited into named
environments. Review every environment block independently whenever a binding
or variable changes.

## Install and validate locally

```powershell
npm ci
npm run lint
npm run typecheck
npm run db:check
npm run db:smoke
npm run security:secrets
npm test
```

Use the repository's Cloudflare development script after it is present in the
checked-out migration commit. Wrangler local development uses local storage by
default. Do not point an ordinary local session at production D1 or KV.

Copy the committed example to an ignored local secret file. Use either
`.dev.vars` or `.env` for Wrangler development, not both. Never commit the
result.

```powershell
Copy-Item .dev.vars.example .dev.vars
```

Apply the committed D1 migrations to local storage before testing durable
features:

```powershell
npx wrangler d1 migrations apply DB --local
npx wrangler d1 migrations apply PROVIDER_BUDGET_DB --local
```

After a binding change, regenerate the checked Worker types and verify they are
current:

```powershell
npm run cf:typegen
npm run cf:types:check
npm run cf:economy:typegen
npm run cf:economy:types:check
```

Before an initial or high-risk deployment, produce the Cloudflare build and run
Wrangler's dry run:

```powershell
npm run cf:dry-run:staging
npm run cf:dry-run
npm run cf:economy:dry-run:staging
npm run cf:economy:dry-run
```

Use `wrangler.jsonc` for web and `wrangler.economy.jsonc` for the private economy
Worker; do not deploy the legacy `cloudflare/player-gateway/wrangler.jsonc` by
mistake. `npm run build` retains Sites rollback packaging. Native web builds must
use `npm run cf:build`, `npm run cf:build:staging`, or
`npm run cf:build:production`. Private-economy validation/deployment must use the
`cf:economy:*` scripts. In every environment, deploy economy before web so the
`ECONOMY_SERVICE` target exists.

## Create Cloudflare resources

Create separate application resources for production and staging, plus one
dedicated provider-budget database shared by both web environments. Place their
names and identifiers in the matching Wrangler environments. The two Workers
within one environment deliberately share that environment's app `DB`; they
must never cross-bind production and staging. Only `PROVIDER_BUDGET_DB` crosses
that boundary. Resource IDs are configuration, not credentials. Do not put API
keys or tokens in either file.

```powershell
npx wrangler d1 create skypilot-production
npx wrangler d1 create skypilot-staging
npx wrangler d1 create skypilot-provider-budget
npx wrangler kv namespace create skypilot-production-player-cache
npx wrangler kv namespace create skypilot-staging-player-cache
```

Copy each returned ID into only its matching environment. The two numeric
Cloudflare rate-limit namespace IDs must also be distinct per environment; the
root `wrangler.jsonc` is the source of truth for the IDs already provisioned.
Do not substitute production IDs in staging.

Only the web Worker declares `ASSETS`, which serves `dist/client`. SkyPilot
currently
uses no Cloudflare Images binding and needs no R2 bucket. Bundled UI assets and
`public/og.png` belong in Workers Static Assets until an actual object-storage
requirement exists.

### D1 migration order

The five-file versioned `drizzle/` chain is the application schema source and
currently creates 37 tables. It retains the portable
`provider_request_budgets` table shape, but native authenticated-call admission
uses the dedicated shared database. `drizzle-provider-budget/` contains that
database's one additive migration. Never edit an already-applied migration.
Export production before an app schema change, then apply migrations by binding
so the target is unambiguous.

```powershell
npx wrangler d1 migrations apply DB --env staging --remote
npx wrangler d1 migrations apply DB --env production --remote
npx wrangler d1 migrations apply PROVIDER_BUDGET_DB --env staging --remote
```

Apply the five app migrations to staging first and run the full smoke flow
before production. Apply the provider-budget migration once: production and
staging bindings point at the same database, so the production web Worker must
see that already-migrated table. A Worker rollback does not roll back D1 data or
schema.

### Existing Sites data

The old Sites-managed D1 database and the new native D1 database are different
resources. To preserve durable account or economy rows:

1. Stop or disable writes and economy ingestion on the old deployment for the
   final copy window.
2. Export the old database without exposing credentials.
3. Keep an encrypted, access-controlled copy of that export.
4. Apply the complete `drizzle/` schema to the new D1 database.
5. Import the data into the new database.
6. Compare table and row counts, run foreign-key checks, and verify a
   representative saved profile, goal, build, feed marker, and snapshot.

Do not claim data preservation if the Sites control plane cannot provide an
export. In that case, keep the old deployment available and obtain an explicit
decision about resetting the small private-preview dataset.

## Runtime variables and secrets

Use `vars` in `wrangler.jsonc` only for non-sensitive configuration. Use
Cloudflare encrypted secrets for credentials. Workers Builds build variables
are build-time only and do not replace runtime variables or secrets.

### Server-only secrets

| Name | Required when | Rule |
| --- | --- | --- |
| `HYPIXEL_API_KEY` | live authenticated player lookup is enabled | Install the same rotated approved credential separately as an encrypted secret in both web environments; coordinate it through the shared `PROVIDER_BUDGET_DB`; send it only in Hypixel's `API-Key` header |
| `OPENAI_API_KEY` | optional AI is enabled | Keep AI disabled without distributed abuse/cost controls; install only in the environment that uses it |
| Future auth/session secret | a public optional-account adapter requires one | The included Cloudflare Access JWT verifier does not use an application session secret; any later adapter must use an independently rotated value per environment |

The native same-origin web Worker does not need `PLAYER_GATEWAY_URL` or
`PLAYER_GATEWAY_SECRET`. Those values belong only to the retained rollback
deployment while it uses the separate player gateway. Do not copy them into the
new production Workers merely because they existed on Sites. The keyless private
economy Worker must not receive `HYPIXEL_API_KEY`.

Install a secret interactively so it does not enter shell history:

```powershell
npx wrangler secret put HYPIXEL_API_KEY --env staging
npx wrangler secret put HYPIXEL_API_KEY --env production
```

Use the appropriate Wrangler environment flag when setting a secret for a
named environment. List secret names after installation, but never print their
values. Re-run `npm run security:secrets` and scan generated client assets,
server output, and source maps before release. The tracked-file scan deliberately
ignores `dist/`; it is not an artifact scan. A native build must contain neither
`dist/.openai` nor `dist/server/.dev.vars` before dry-run or deployment.

### Non-secret variables

The checked-in config owns safe defaults and feature gates. At minimum, verify:

- `SITE_NAME=SkyPilot`;
- `SITE_URL` is the exact HTTPS production origin with no path or trailing
  slash;
- `ENABLE_PLAYER_LOOKUP`, `ENABLE_ACCOUNT_AUTH`, and `ENABLE_AI_ASSISTANT` on the
  web Worker match the environment matrix above;
- `ENABLE_PUBLIC_ECONOMY=false` on both web and private economy Workers while
  the active-Auction crawl is non-incremental and until a single reviewed
  post-capacity-gate activation changes them together;
- `ENABLE_BROWSER_PLAYER_GATEWAY=false` and `REQUIRE_PLAYER_GATEWAY=false` on
  the native web Worker;
- `AUTH_PROVIDER=cloudflare-access` remains inert while
  `ENABLE_ACCOUNT_AUTH=false`;
- `ADMIN_USER_IDS` is empty until the new identity provider's verified subject
  format is known;
- preview URLs never use the production `SITE_URL` or production identity
  audience.

Also verify that each web environment's `ECONOMY_SERVICE` targets only its
matching private Worker, and that the private production/staging configurations
retain `workers_dev=false`, `preview_urls=false`, no secrets, and no Cron.

When a custom domain changes, update `SITE_URL`, the authentication callback or
audience configuration, CSP/origin tests, sitemap, and social metadata in one
release.

## Player lookup

The native web Worker performs provider calls server-side and does not need the
separate browser gateway. The deployed browser must receive neither the Hypixel
key nor a gateway capability/secret.

Both official username hosts currently fail from native Cloudflare Worker
egress. Source includes a conditional PlayerDB fallback after bounded
transport/access failures from both official resolvers; authoritative not-found
responses stop the chain. SkyPilot's application-supplied fields are only the
normalized username and identifying service user agent. It copies no browser
cookie, authentication, profile selector, or Hypixel key. Cloudflare may add
network headers to the Worker subrequest, including visitor-IP metadata depending
on destination routing; review the public privacy disclosure and revalidate this
behavior before activation. The
response must match PlayerDB's expected success code and requested username,
contain a valid Java UUID, and then match the authenticated Hypixel player UUID and display name.
Only the normalized latest mapping enters the existing identity cache. Focused
tests and the public privacy disclosure pass. Exact commit `e380eedd37bf` also
passes staging egress/schema and safe-error smoke, but its configured Hypixel
credential is invalid; public activation still requires a valid rotated key and
a successful response with final UUID/display-name agreement.

The root Wrangler configuration declares environment-isolated `DB`,
`PLAYER_CACHE`, `PLAYER_ACTOR_LIMITER`, and `PLAYER_GLOBAL_LIMITER` bindings,
plus the same `PROVIDER_BUDGET_DB` in both named environments.
`worker/player-runtime.ts` consumes the player bindings for both API forms. It layers a
bounded per-isolate L0 over KV, stores positive and negative provider results in
the shared namespace, and does not retain request-bound I/O promises in
module-global state. `PLAYER_ACTOR_LIMITER` hashes and filters the request actor
at the route boundary. Mojang identity calls do not spend Hypixel quota. Only an
actual authenticated Hypixel transport performs one coarse
`PLAYER_GLOBAL_LIMITER` check and one atomic two-token reservation in
`PROVIDER_BUDGET_DB`; failure to reserve or reach that D1 fails closed.

The public-scale gate must preserve user-triggered, latest-snapshot-only lookup,
one-hour fresh caching with bounded stale-on-error behavior, negative caching,
input bounds, upstream timeouts, and normalized responses. KV is eventually
consistent, and Cloudflare rate-limit bindings remain coarse per-location abuse
filters. The shared dedicated D1's `provider_request_budgets` fixed-window
reservation is the global credential guard. Verify staging
cold-hit/cached/stale/error behavior, concurrent
multi-region reservations, D1 failure behavior, and configured capacity against
the actual Hypixel Production allocation and response headers. Add monitoring
before public traffic; do not treat the coarse Cloudflare bindings as a quota
ledger.

## Identity

ChatGPT Sites previously injected `oai-authenticated-user-*` headers and owned
the sign-in, sign-out, and callback routes. Native Workers do none of that.
Never reproduce those headers at a proxy and treat them as authenticated.

The included adapter is intentionally disabled. When configured, it accepts
only `AUTH_PROVIDER=cloudflare-access`, validates the
`Cf-Access-Jwt-Assertion` JWT with Cloudflare's remote JWK set and RS256, checks
issuer, audience, and expiry, and requires bounded subject and email claims.
Set the exact team origin as `CF_ACCESS_TEAM_DOMAIN` (for example,
`https://team-name.cloudflareaccess.com`, with no path) and the Access
application audience as `CF_ACCESS_AUD`; then regenerate Worker types. A
header's presence alone is never proof.

For an owner-only or administrator-only deployment, Cloudflare Access may
protect the whole hostname only if making every route private is intentional.
For the public SkyPilot launch, never protect the whole hostname: core lookup
and planning must work without an account.

Cloudflare Access is not automatically a suitable optional public-account
system: an Access policy normally protects the matching route. SkyPilot's core
lookup and planning must remain usable without an account. Before public
account features are enabled, choose and validate an identity/session design
that supports optional sign-in, secure cookies, CSRF protection, logout,
account deletion, and canonical-user mapping without gating public tools.

Until that boundary passes its tests, keep `ENABLE_ACCOUNT_AUTH=false`.
That disables account, saved-profile, goal, private build, authenticated AI,
and administrator mutations while leaving account-free tools available.

When changing providers, add the new provider subject to
`external_identities`; do not replace business-table user IDs. Link an existing
Sites canonical user only through an audited one-time mapping. Do not silently
merge accounts by an unverified email address.

## Connect GitHub to Workers Builds

This is a one-time Cloudflare dashboard action. It cannot be completed by a
repository commit alone. The checked-in environments resolve to four Worker
names: two web Workers and two private economy Workers. A connection targets one
dashboard Worker/configuration; it must not switch environment bindings by
branch accident. Automate all four independently, or keep private-economy and/or
staging deploys manual until their dedicated connections exist.

1. Authorize the Cloudflare Workers & Pages GitHub App for
   `test23780460/skyblock-hub`. Grant only this repository.
2. Open the `skypilot` web Worker, choose **Settings → Builds → Connect**, select
   the repository, set root directory `/`, production branch `main`, and
   disable non-production branch deploys on this production Worker.
3. Open the separate `skypilot-staging` web Worker and connect the same repository.
   Use a dedicated non-`main` staging branch for its active deployment and
   allow the desired non-production branch preview builds there. If that branch
   does not exist yet, leave automatic staging deploys off instead of pointing
   the staging Worker at `main`.
4. For both web connections, set build command `npm run cf:build`. The script maps
   `main` (or `SKYPILOT_PRODUCTION_BRANCH`) to the production Wrangler
   environment and every other `WORKERS_CI_BRANCH` to staging. Do not use
   `npm run build`; that command retains Sites rollback packaging.
5. For `skypilot-economy` and `skypilot-economy-staging`, either create separate
   Builds connections that explicitly use `wrangler.economy.jsonc` with the
   matching environment, or keep them manual using the repository's
   `cf:economy:*` scripts. Never deploy the web/Vite output as an economy Worker,
   and never give an economy Worker the Hypixel secret.
6. Use `npx wrangler deploy` for each web connection's active branch and
   `npx wrangler versions upload` for branch previews. The Vite build writes a
   flattened deployment config under `dist/server` and points Wrangler to it;
   adding `--env` after the build cannot change those flattened bindings.
7. Keep dependency installation enabled for the committed `package-lock.json`.
   Set `NODE_VERSION=22.16.0` and
   `SKYPILOT_PRODUCTION_BRANCH=main` as non-secret build variables if explicit
   pinning is desired. `WORKERS_CI_BRANCH` is supplied by Workers Builds.
8. Do not copy runtime API keys into **Build variables and secrets**. Install
   them under each Worker's runtime **Variables and Secrets** instead.
9. Confirm the dashboard Worker name exactly matches the selected environment's
   resolved `name`. A mismatch stops Workers Builds.
10. In web build logs, verify the environment, Worker name, D1/KV/rate/service
    bindings, and no-Cron posture, and verify that neither `dist/.openai` nor
    `dist/server/.dev.vars` exists. In private-economy logs, verify only the
    matching D1, economy-off/no-Cron posture, and public/preview URL disablement.
11. Deploy `skypilot-economy-staging` before `skypilot-staging`, then smoke-test
    staging and record both Worker version IDs plus the exact Git commit. Only
    then merge that commit to `main`; deploy `skypilot-economy` before
    `skypilot` and verify the production service binding.

Workers Builds preview versions are not production deployments. A successful
GitHub check also does not create D1/KV resources, install secrets, migrate D1,
configure Access, or attach a domain; complete those one-time account steps
separately.

## Initial smoke test

Recorded narrow staging evidence: application commit `e380eedd37bf` is deployed
at `https://skypilot-staging.ptravis022.workers.dev` as web Worker version
prefix `51f5f3e6`. Health returned 200 with player
configured and economy disabled, and the private-economy service binding
resolved. Blank input returned `400 invalid_input`; `NoSuchPilotzzzz` returned
`404 player_not_found`; and `Justiwantdreams` traversed the PlayerDB path to
Hypixel. That username and a known UUID then returned `503 forbidden` because
the configured Hypixel credential was invalid; direct provider validation
returned HTTP 403 `Invalid API key` without recording the credential value.

This evidence does not complete the sequence below: successful live player
data, final identity agreement, valid credential, production deploy/public
launch, domain, browser/accessibility/performance, load/multi-region behavior,
remote migrations/backups, and GitHub Workers Builds remain unverified.

Run this sequence against staging first, then production:

1. Confirm the matching private economy Worker was deployed first, has no public
   or preview URL, and is the web Worker's `ECONOMY_SERVICE` target. Then verify
   `GET /api/health` returns HTTP 200, reports the intended safe feature posture,
   and exposes no secrets or internal binding IDs.
2. Open `/`, `/dashboard`, `/progression`, `/gear`, `/accessories`, `/economy`,
   `/money-making`, `/items`, `/skills`, `/garden`, `/dungeons`, `/minions`,
   `/calculators`, `/status`, `/privacy`, and `/terms` directly in a fresh tab.
3. Refresh nested routes and verify HTML, JavaScript, CSS, and `og.png` load
   from the Cloudflare origin with no request to `chatgpt.site`.
4. With the approved shared key, look up `Justiwantdreams` and a Java UUID.
   Confirm each request passes the route actor filter; the first authenticated
   Hypixel transport performs one coarse shared check and atomically reserves
   two tokens in `PROVIDER_BUDGET_DB`, while the repeat uses KV-backed cache without spending
   another reservation, concurrent reservations cannot exceed the configured
   window, and hidden or unavailable profile fields stay unavailable. Also
   confirm a Mojang-only not-found request does not spend Hypixel quota.
5. Verify an invalid username, Hypixel timeout, `429`, and `503` produce the
   designed error state rather than demo data or a blank page.
   Separately simulate transport/access failure from both official identity
   hosts and verify SkyPilot supplies only the normalized username plus service
   user agent, observe any Cloudflare-added network headers, strictly validates
   username/UUID, and still
   requires Hypixel UUID/display-name agreement. Confirm an official not-found does not fall
   through and direct UUID input skips every identity service.
6. Only after Workers Paid, five app migrations, capacity/usage monitoring,
   replacement of the non-incremental active-Auction crawl with a reviewed
   incremental or compacted design, both `ENABLE_PUBLIC_ECONOMY`
   values, and exactly one reviewed production Cron on the private Worker are
   active, verify Bazaar, active Auctions,
   ended sales, timestamps, and Bazaar hour/day history from D1. Exercise
   `/api/economy/bazaar`, `/api/economy/bazaar/history`,
   `/api/economy/auctions`, and `/api/economy/auctions/ended`; confirm successful
   responses use `public, max-age=30, stale-while-revalidate=60`. Public page
   requests must not crawl Hypixel.
7. Force a refresh failure and verify the last real D1 snapshot remains
   readable with `cacheStatus: "stale"`; a missing first snapshot or storage
   failure must return a retryable `503`, never fixture data.
8. If identity is enabled, test sign-in, owner isolation, saved profile, goal,
   build, sign-out, CSRF/origin rejection, admin denial, and application-account
   deletion.
9. Inspect both web and private-economy Workers Logs for safe structured events
   only. Confirm no key, token, full player payload, raw NBT, prompt, or
   authentication header appears.
10. Repeat responsive, keyboard, focus, reduced-motion, accessibility,
   performance, and load/security checks before public access.

## Custom domain

The first verified web deployment may use its `*.workers.dev` URL. The private
economy Workers must never receive one. To attach a domain later, open the web
Worker, choose **Settings → Domains & Routes → Add →
Custom Domain**, and select a hostname in a zone on the same account. Do not
hard-code the generated or custom hostname into application fetches; product
APIs use relative same-origin URLs.

Update `SITE_URL` and identity configuration, redeploy, then verify canonical
metadata, sitemap, robots, cookies, CSP, direct-route refresh, and account
callbacks on the final hostname before moving traffic.

## Manual deployment and rollback

Workers Builds is the normal release path. For an incident-only manual release,
validate the exact commit, then use the repository's production build and
Wrangler deploy commands. Do not deploy an uncommitted worktree.

```powershell
npm run cf:economy:deploy:staging
npm run cf:deploy:staging
npm run cf:economy:deploy
npm run cf:deploy
```

The order is mandatory: economy first, web second, in each environment. The
deploy scripts reject an uncommitted worktree.

For a code-only regression, select compatible last-verified versions for both
Workers in **Worker → Deployments** and choose **Rollback**, or use `npx wrangler
rollback` with the correct config/environment. A Worker rollback does not undo
D1 migrations, data writes, deleted KV namespaces, secrets, service bindings,
routes, or DNS. Database changes require a verified export and a forward
corrective migration.

During initial cutover, leave the owner-only Sites deployment unchanged. If the
Cloudflare version fails, route users back to that known-good URL, disable any
newly enabled private-economy Cron plus both economy flags and write features,
and investigate without
deleting the new D1 database. Retire Sites only after the Cloudflare deployment
and rollback drill are verified.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Worker build says the name does not match | The dashboard Worker and selected environment in `wrangler.jsonc` or `wrangler.economy.jsonc` must resolve to the same name. |
| Web deployment reports a missing economy service | Deploy the matching private economy Worker first and verify `ECONOMY_SERVICE` does not cross production/staging. |
| Private economy Worker has a public URL | Stop release and restore `workers_dev=false` plus `preview_urls=false` in `wrangler.economy.jsonc`. |
| Nested route returns 404 | Deploy the Worker entry and generated Static Assets configuration together; SkyPilot is server-rendered, not an assets-only SPA fallback. |
| `DB` is undefined or a table is missing | Verify the environment-specific D1 binding and apply every migration in `drizzle/`. |
| `PROVIDER_BUDGET_DB` is undefined or its table is missing | Verify both web environments target the same dedicated database and apply the one migration in `drizzle-provider-budget/`. |
| Staging app data appears in production | Stop deployment; staging is bound to a production app resource. Split app D1/KV/rate IDs and non-shared secrets before continuing; do not split the intentionally shared provider-budget DB. |
| Player lookup reports missing credentials | Verify the feature flag and server-only secret name; never add the key to browser-visible variables. |
| Username lookup needs PlayerDB while UUID lookup works | Both official identity hosts may be rejecting Worker egress. Staging proves the conditional PlayerDB egress/schema path, but inspect only aggregate safe resolver codes and verify exact username, UUID normalization, `429`/`Retry-After`, and final Hypixel UUID/display-name agreement before public activation. |
| Username and UUID both return `503 forbidden` | Identity resolution is not the common failure. Treat health configuration as presence-only, validate the server-side Hypixel credential directly, rotate it if invalid, and never print or move it into browser-visible configuration. |
| Bazaar says the snapshot is not ready | Keep economy off while the active-Auction crawl is non-incremental. After the activation gate is satisfied, verify all five production app migrations, both feature flags, exactly one private-Worker Cron Trigger, elected cycle logs, and first complete D1 publication. |
| Account routes always show anonymous | Sites headers are gone. Configure and validate the selected native identity adapter or keep auth disabled. |
| Rollback fails after a binding change | Restore the referenced resource or deploy a compatible forward version; Worker rollback cannot recreate deleted resources. |

[Workers Builds]: https://developers.cloudflare.com/workers/ci-cd/builds/
[Workers Static Assets]: https://developers.cloudflare.com/workers/static-assets/
[Cloudflare Vite]: https://developers.cloudflare.com/workers/vite-plugin/
[Wrangler configuration]: https://developers.cloudflare.com/workers/wrangler/configuration/
[Workers secrets]: https://developers.cloudflare.com/workers/configuration/secrets/
[D1 migrations]: https://developers.cloudflare.com/d1/reference/migrations/
[D1 limits]: https://developers.cloudflare.com/d1/platform/limits/
[D1 pricing]: https://developers.cloudflare.com/d1/platform/pricing/
[Cron Triggers]: https://developers.cloudflare.com/workers/configuration/cron-triggers/
[Access JWT validation]: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
[Worker rollbacks]: https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/
