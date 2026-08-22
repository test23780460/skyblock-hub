# Cloudflare migration

**Audit date:** 2026-08-21
**Repository:** `test23780460/skyblock-hub`
**Migration branch:** `codex/cloudflare-migration`

This document records the repository-wide migration boundary. The goal is to
move the existing SkyPilot application to separate native Cloudflare web and
private economy Workers without rebuilding or redesigning it. The old
owner-only Sites deployment remains the rollback target until the native Worker
pair passes every cutover gate.

This is an implementation audit, not proof of a live deployment. Repository
changes can prepare native packaging and runtime composition, but they cannot
confirm account plan, remote resources, secrets, migrations, GitHub App
installation, Access policy, DNS, production logs, or Hypixel approval.

| Migration boundary | Audit status |
| --- | --- |
| Native web Workers, Static Assets, D1/KV/rate/service bindings, environment selection | Implemented; native production/staging builds and prior local web-Worker smoke exist, while exact-final-head remote dry-run/deploy remains unverified |
| Private economy Workers | `skypilot-economy` and `skypilot-economy-staging` are separately configured with matching D1, `workers_dev=false`, preview URLs off, economy disabled, and no Cron; deploy and service-binding smoke remain unverified |
| Sites rollback | Retained in source, but native build scripts exclude `dist/.openai` |
| Production/staging resource isolation | App D1/KV/rate IDs are distinct; one dedicated provider-budget D1 is deliberately shared because both environments use one Hypixel key. Remote ownership and actual account bindings still require operator verification. |
| Public economy runtime | Implemented only in the private Worker but disabled with no Cron because the active-Auction crawl is non-incremental; remote migrations, Workers Paid, capacity evidence, an incremental/compacted replacement, a reviewed single-Cron activation, first publication, and usage monitoring are external gates |
| Native player lookup | KV-backed cache, route actor filtering, authenticated-Hypixel-call filtering, and a globally consistent shared D1 provider budget are wired; Mojang calls do not spend Hypixel quota. Prior local lookup/cache smoke exists, while production load/monitoring evidence remains. |
| Identity | Cloudflare Access JWT verifier implemented and all account features off; optional public-account sign-in remains unresolved |
| GitHub Workers Builds | Repository commands are ready; the GitHub App and web/private-economy Worker connections are one-time dashboard work |
| Domain/public launch | Not completed by repository work |

## Repository audit

| Area | Existing implementation | Native Cloudflare decision |
| --- | --- | --- |
| Frontend | React 19, vinext App Router, React Server Components, Vite 8 | Keep the application and visual source unchanged; run the same vinext output in a Worker |
| Package/build | npm, committed `package-lock.json`, Node 22.13+, `vinext build` | Keep npm and the current build; use Cloudflare's Vite plugin and generated Worker/asset output |
| Routes | File-based `app/` pages and route handlers, plus dynamic `[section]` modules | Preserve every path and server-render nested routes through the Worker |
| Web runtime | `worker/index.ts` delegates to `vinext/server/app-router-entry` | Make it the native web entry Worker, keep security headers at the edge, and remove scheduled ingestion |
| Economy runtime | Scheduler-independent jobs previously shared a composition edge | Compose them only in private `worker/economy.ts`, configured by `wrangler.economy.jsonc` with public and preview URLs off |
| Static assets | Vite client output and `public/og.png` | Serve through Workers Static Assets; no Workers Sites or R2 |
| Image handling | The current UI uses ordinary generated/static assets and has no `next/image` usage | Serve through Static Assets; do not require Cloudflare Images or R2 without a real use case |
| Player providers | Validated Minecraft/Mojang/PlayerDB/Hypixel adapters and deterministic analysis; both official identity hosts currently fail from Worker egress, and focused fallback tests pass | Run provider calls server-side, use PlayerDB only after official transport/access failures, validate its username/UUID strictly, require final Hypixel UUID/display-name agreement, and keep direct UUID recovery; do not call the fallback live before staging egress verification |
| Public economy | Scheduler-independent Bazaar/Auction jobs, durable D1 lease/fencing/backoff, D1-only public reads | Bind jobs only to the private economy Worker; web admin reaches its fixed action through `ECONOMY_SERVICE`, and a future Cron belongs only there |
| Cache | Portable `TtlCache`, per-isolate memory cache, KV adapter, durable D1 economy snapshots | D1 remains authoritative for economy; native player routes use environment-isolated KV with bounded L0 memory |
| Persistence | Drizzle SQLite app schema, five migrations, 37 D1 tables, plus a one-migration dedicated provider-budget D1; repository interfaces/adapters | Keep environment-isolated app D1 databases, but bind both web environments to one dedicated provider-budget database for the one shared Hypixel credential |
| Authentication | Sites-injected `oai-authenticated-user-*` headers and reserved ChatGPT auth paths | Replace with a cryptographically verified native identity adapter or keep all auth features disabled |
| AI | Optional server-side OpenAI Responses route, deterministic grounding, aggregate metrics | Keep disabled unless a rotated secret, identity policy, and distributed abuse/cost control are verified |
| Tests | Engine, service, provider/security, rendered-route, database, build, and secret checks | Preserve them; native config/types/dry-run tests are repository gates, while remote bindings, browser flows, auth, first Cron, and deployment rollback remain live gates |
| Git/deploy | GitHub Actions validates; Sites publishing was a separate source/deploy flow | Keep GitHub history and CI; add native Cloudflare Workers Builds from the same repository |

## Architecture before migration

```text
GitHub branch
  -> Sites source/version packaging
  -> ChatGPT Sites dispatcher
       -> vinext UI and API routes
       -> Sites-injected identity headers
       -> Sites-managed D1 binding
       -> browser capability -> separate player-gateway Worker
                                  -> KV/rate bindings -> Hypixel
```

The Sites deployment solved private preview hosting, identity, and D1 wiring,
but it also forced a cross-origin player transport because the Sites server
could not reliably reach the gateway. The browser capability is replayable for
its short validity window and the gateway rate-limit bindings are not an exact
global credential ledger.

## Target architecture

```text
GitHub repository
  -> Cloudflare Workers Builds
       -> production/staging private economy deploys first
       -> matching web build + wrangler deploy second
  -> SkyPilot web Worker (`skypilot` or `skypilot-staging`)
       -> Workers Static Assets (vinext client and public assets)
       -> vinext server routes and /api/* handlers
       -> environment-isolated D1 DB (accounts, feed reads, history, metrics)
       -> shared PROVIDER_BUDGET_DB (one Hypixel credential budget)
       -> KV PLAYER_CACHE (latest request-driven normalized player/provider cache)
       -> ECONOMY_SERVICE
            -> private economy Worker (`skypilot-economy*`)
                 -> D1 DB (feeds, history, leases)
                 -> optional future production Cron Trigger
       -> Hypixel/Minecraft/conditional PlayerDB/OpenAI upstreams behind provider adapters
```

The UI, navigation, CSS, branding, page layouts, deterministic engines, provider
normalizers, API envelopes, and repository contracts stay intact. Cloudflare is
the runtime composition, not the owner of SkyBlock business rules.

## Sites coupling audit and disposition

| Coupling | Why it cannot remain active | Required disposition |
| --- | --- | --- |
| `.openai/hosting.json` | Declares a Sites project and logical D1 binding | Retain only as rollback metadata; native scripts remove `dist/.openai` before deployment |
| `build/sites-vite-plugin.ts` and the `sites()` Vite plugin | Copies Sites metadata/migrations into `dist/.openai` | Keep only on the default rollback build; setting native `CLOUDFLARE_ENV` skips it, while Wrangler owns native bindings |
| Vite's `site-creator-d1` placeholder | It is not a deployable native D1 resource | Limit to rollback packaging; root `wrangler.jsonc` and local D1 own the native path |
| former `app/chatgpt-auth.ts` | Trusted dispatcher-only headers and reserved routes that native Workers do not provide | Replaced by a host-neutral current-user contract and disabled Cloudflare Access verifier |
| hard-coded external identity provider `chatgpt` | New provider subjects would not resolve to existing users | Native identities use `cloudflare-access`; link old canonical users only through an audited migration |
| sign-in UI and legal copy naming ChatGPT Sites | Becomes false after cutover | Migrated to host-neutral/Cloudflare wording; rerun legal/rendered tests and verify no live-host claim remains |
| `SKYPILOT_SITE_ORIGIN` set to a `chatgpt.site` URL | Cross-origin gateway trust would keep the old host in the live path | Remove the browser gateway from the active same-origin path; retain its old configuration only for rollback |
| `PLAYER_GATEWAY_URL`, `PLAYER_GATEWAY_SECRET`, browser capability and receipt mode | Solves the old cross-origin transport problem and adds replay/CORS complexity | Disable/remove from native production; use server-side direct provider composition and revalidate saved profiles against the shared lookup cache |
| D1 error text referencing `.openai/hosting.json` | Gives incorrect operator guidance | Refer to the Wrangler `DB` binding instead |
| Sites deployment guides/status assertions | Could be mistaken for the active runtime | Keep clearly historical/rollback-only; update root status documents after runtime/economy shape is accepted |

Historical links in migration evidence may remain when they are explicitly
labeled as old deployment records. There must be no `chatgpt.site` URL, OAI
identity header, Sites packaging path, `.dev.vars`, or `.env*` file in the
native deploy artifact. The native runner scrubs generated secret files; the
release check must verify that behavior without printing file contents.

## Route preservation

The native deployment must directly render and refresh all existing product
routes:

```text
/
/dashboard
/progression
/gear
/accessories
/economy
/goals
/bazaar
/auctions
/money-making
/items
/skills
/garden
/mining
/foraging
/fishing
/dungeons
/slayers
/minions
/museum
/collections
/bestiary
/rift
/calculators
/builds
/builds/share/:shareSlug
/ai
/account
/admin
/more
/status
/about
/privacy
/terms
/robots.txt
/sitemap.xml
```

The Worker also preserves all current `/api/*` route handlers for health,
player lookup, economy feeds/history, account and saved state, goals, builds,
favorites, preferences, AI, and allowlisted administration. Static asset
routing must not turn this server-rendered application into a generic SPA
fallback. A miss must reach the vinext Worker so framework routing and 404
behavior remain authoritative.

## Player lookup and caching

The native web Worker can hold `HYPIXEL_API_KEY`, so the browser uses only relative
same-origin SkyPilot APIs. It never receives a key, gateway secret, capability,
or general-purpose Hypixel proxy.

The active design must preserve:

- user-triggered lookup only;
- Minecraft Services username resolution with a bounded Mojang fallback, plus
  an actionable dashed/undashed Java UUID path when both identity services are
  unavailable;
- a conditional PlayerDB lookup only after both official resolvers fail for
  transport/access, never after authoritative not-found; strict success,
  case-insensitive exact-username, UUID, and final Hypixel UUID/display-name validation;
- application code copies no browser cookies/auth/profile selectors/Hypixel key
  into the PlayerDB request; disclose and revalidate Cloudflare-added network
  headers, which may contain visitor-IP metadata depending on routing; cache
  only the latest normalized mapping and discard raw metadata;
- one-hour shared fresh player cache and bounded stale-on-error behavior;
- latest snapshot only, with no player history, monitoring, or saved-profile
  refresh schedule;
- bounded upstream responses, timeouts, classified errors, and no fabricated
  fields;
- feature-specific normalized responses rather than raw Hypixel payloads.

The native player composition consumes `PLAYER_CACHE`, `PROVIDER_BUDGET_DB`,
`PLAYER_ACTOR_LIMITER`, and `PLAYER_GLOBAL_LIMITER`. Positive provider values,
one-hour player snapshots with bounded stale-on-error, and 30-second negative
results use KV with a bounded per-isolate L0. The product routes hash the actor
subject and apply the coarse `PLAYER_ACTOR_LIMITER` before lookup work. Mojang
identity calls do not spend Hypixel quota. Only an actual authenticated Hypixel
transport performs one coarse `PLAYER_GLOBAL_LIMITER` check and one atomic
two-token reservation in the shared `PROVIDER_BUDGET_DB`. Both
`/api/player?username=` and `/api/player/:username` use this
composition. The former module-global Promise single-flight was removed so no
request retains another invocation's binding or fetch promise.

The conditional [PlayerDB API](https://playerdb.co/) fallback is implemented in
source to address the observed official-host Worker egress failures. Focused
tests and the public privacy disclosure pass, but staging smoke remains. It remains
part of the identity path, not the authenticated Hypixel credential path, and
therefore spends no Hypixel reservation. No resolver authorizes monitoring,
history, scheduled refresh, or mass username enumeration.

KV is eventually consistent and suitable for shared latest-value cache, not an
authoritative global counter. Cloudflare rate-limit bindings are coarse
per-location abuse filters. Before an authenticated Hypixel transport, the web
Worker atomically reserves two fixed-window tokens in the dedicated shared D1's
`provider_request_budgets`; if that global guard is unavailable or exhausted,
lookup fails closed. Before public traffic, validate cache/filter/budget behavior
under multi-region load, confirm the configured reservation capacity against the
actual Hypixel Production allocation and response headers, and add monitoring.
Do not use more keys or regions to evade a limit.

## Economy cutover

Public web requests read D1 only. The web Worker cannot import or execute
ingestion; its allowlisted admin action sends one fixed internal request through
`ECONOMY_SERVICE`. When explicitly activated, exactly one production UTC
schedule on the private economy Worker invokes the elected cycle, which uses D1 lease and
fencing state to prevent overlapping or stale publication. The cycle fetches
ended Auctions, Bazaar, and the complete active-Auction page set with an
invocation-local provider and no API key; validates and normalizes them;
publishes only coherent snapshots; and maintains 90 days of hourly plus three
years of daily Bazaar OHLC history. Ended-auction rows retain 180 days.

Successful economy APIs use
`Cache-Control: public, max-age=30, stale-while-revalidate=60`:

- `GET /api/economy/bazaar?q=&limit=1..250`;
- `GET /api/economy/bazaar/history?product=&resolution=hour|day&limit=`;
- `GET /api/economy/auctions?page=0..10000&q=&limit=1..250`;
- `GET /api/economy/auctions/ended?limit=1..500`.

Provider requests use an eight-second timeout, manual redirects, bounded
responses, and schema normalization. A stale upstream response never
overwrites D1. The last real expired snapshot remains readable with
`cacheStatus: "stale"`; a missing first snapshot or storage failure returns a
retryable `503`, never a fixture fallback.

All initial web and private economy Workers have no Cron Trigger and
`ENABLE_PUBLIC_ECONOMY=false`. Production economy remains disabled until:

1. the Cloudflare account is on Workers Paid with an approved usage/cost
   budget and D1 monitoring;
2. all five app migrations are applied to the native production `DB`, and the
   provider-budget database's one additive migration is applied once;
3. the old Sites schedule is confirmed absent or disabled;
4. production capacity/soak evidence validates replacement of the current
   non-incremental active-Auction crawl with a reviewed incremental or compacted
   ingestion design rather than activating the row-heavy baseline by assumption;
5. one reviewed config change enables the flag on both production Workers and
   registers exactly one production Cron on `skypilot-economy`;
6. the first cycle publishes complete feed markers and rows;
7. Bazaar, Auctions, ended sales, and history routes pass freshness/stale/error
   smoke tests;
8. upstream cadence and volume are reviewed against current Hypixel policy.

This row-heavy writer and full active-Auction crawl are not approved for the
Free plan. Cloudflare limits and pricing are time-sensitive, so verify the
current [D1 limits] and [D1 pricing] immediately before activation. Workers
Paid, an incremental or compacted design, and ongoing rows-read/rows-written
capacity monitoring remain launch requirements.

A genuinely Free-plan-safe design would need a new compact current-hour and
per-product series schema, migration, API compatibility work, lower retention,
and renewed storage/accuracy tests. That is a follow-up architecture change,
not a safe last-minute substitution during this cutover.

The lease protects publication integrity; it is not permission to configure
duplicate noisy schedules. Market values remain estimates, never guaranteed
trades or profit.

## Database decision

SkyPilot already uses D1-compatible SQLite and repository adapters, so moving
to another database would add risk without solving a migration need. The native
deployment keeps D1 and the existing schema.

The migration changes resource ownership and binding, not the domain model:

- old: Sites-managed logical `DB`;
- new: explicit native app `DB` per production and staging environment, plus one
  dedicated `PROVIDER_BUDGET_DB` shared by both web environments because they
  use one Hypixel credential;
- unchanged: `db/schema/**`, `drizzle/**`, repository contracts, Drizzle
  adapters, application-generated IDs, and data-validation rules.

The app database uses the five-migration, 37-table chain. The shared
provider-budget database uses its own one additive migration under
`drizzle-provider-budget/`.

An old-to-new data export is a separate operation from applying schema. Worker
version rollback cannot restore a D1 export or reverse a migration. Use
expand/contract releases and forward corrective migrations for production
schema changes.

## Identity replacement

Identity is the largest functional migration boundary. The pre-migration code
assumed that Sites stripped spoofed OAI headers, injected verified user fields,
and owned sign-in/sign-out routes. A public Worker must not trust equivalent
client headers.

The replacement contract must provide:

- a stable provider name and subject;
- optional verified email/display name;
- cryptographic issuer, audience, signature, expiry, and claim validation;
- secure session/cookie behavior and CSRF/origin enforcement;
- safe sign-in, callback, and sign-out paths;
- canonical-user mapping and owner-scoped authorization;
- administrator allowlisting using verified identities;
- account deletion that removes SkyPilot data without claiming to delete the
  external identity-provider account.

The migration includes a disabled Cloudflare Access adapter. It accepts only
`AUTH_PROVIDER=cloudflare-access`, reads `Cf-Access-Jwt-Assertion`, verifies
RS256 against the team JWK set, checks issuer/audience/expiry, and requires
bounded subject and email claims. Enabling it also requires exact
`CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` variables plus Access policy tests.

Cloudflare Access is acceptable for a private preview or restricted operations
surface when the Worker validates its JWT. Protecting the whole public hostname
would violate the account-free product rule, while protecting only a login path
does not by itself establish an optional application session across unprotected
routes. If no optional public-account adapter has passed end-to-end tests, keep
`ENABLE_ACCOUNT_AUTH=false` and every dependent feature disabled at launch.

Existing `chatgpt` external identities cannot be automatically reinterpreted as
new provider subjects. Link them through an explicit audited mapping or leave
the old data in rollback storage. Email-only merging is not safe without
verified uniqueness and operator review.

## Static assets and storage

Workers Static Assets serves the generated vinext client, CSS, JavaScript, and
`public/og.png` through `ASSETS`. There is no Images or R2 binding.
Minecraft-style imagery retains the existing pixelated CSS. SkyPilot currently
has no user uploads or large asset corpus. Add a portable storage interface and
R2 only when a real blob workflow exists. Preserve third-party licenses and do
not copy incompatible item-art libraries.

## Worker-runtime review findings

The following patterns require explicit validation in the native runtime:

- generated binding types must come from `wrangler types`; hand-written `Env`
  shapes must not drift from `wrangler.jsonc` or `wrangler.economy.jsonc`;
- both configs pin compatibility date `2026-08-21`; the web config declares only
  the environment-matched `ECONOMY_SERVICE`, and private economy configs keep
  `workers_dev` and preview URLs disabled;
- promises that perform binding or network I/O cannot float;
- request-bound Promise single-flight cannot live in module state; the native
  path removes that cross-request coalescer and relies on KV plus the route actor
  filter, authenticated-Hypixel-call filter, and shared `PROVIDER_BUDGET_DB`
  reservation; Mojang calls do not spend Hypixel quota;
- mutable in-memory request windows, negative cache, rate headers, and AI limits
  are best-effort per isolate only;
- large upstream JSON remains size-bounded before parsing;
- secrets are accessed only through server bindings and never logged;
- Cloudflare Vite may emit a local `dist/server/.dev.vars`; the native runner
  must scrub every generated `.dev.vars*`/`.env*` before dry-run or deployment,
  and the check must never print contents;
- native output contains no `dist/.openai`, while the default rollback build
  may intentionally retain Sites metadata;
- Worker-to-Cloudflare storage uses bindings, not Cloudflare's public REST API;
- production observability emits one bounded structured economy-cycle outcome
  with status/job counts/duration and a sanitized error code, never player
  selectors, raw payloads, NBT, prompts, or credentials.

## GitHub and release flow

Git history stays in the existing repository. GitHub Actions remains the code
quality gate; Cloudflare Workers Builds becomes the deployment gate. Each
environment has a web Worker and a private economy Worker. If all four are
automated, give each its own environment-correct connection/configuration; it is
also acceptable to keep private-economy deployment manual until those
connections exist. Never point staging at production bindings, and do not enable
non-main branch deploys on either production Worker.

```text
pull request
  -> GitHub Actions validation
  -> deploy skypilot-economy-staging first
  -> Cloudflare build/deploy on skypilot-staging second
  -> route/API/security/economy smoke
merge exact verified commit to main
  -> deploy skypilot-economy first
  -> Cloudflare production build/deploy on skypilot second
```

Connecting the GitHub App, choosing the branch/build commands, and installing
Cloudflare resources/secrets are one-time account actions. Deploy each private
economy Worker before its web Worker so `ECONOMY_SERVICE` resolves. Follow
[Cloudflare setup](CLOUDFLARE_SETUP.md). Do not maintain a second generated
source repository. Web connections use `npm run cf:build`;
`WORKERS_CI_BRANCH` selects production only for `main`, otherwise staging. The
private economy connections use `wrangler.economy.jsonc` and the matching
repository economy script/configuration.

## Cutover and rollback

1. Record the exact owner-only Sites version, gateway Worker version, flags,
   secret names, D1 state, and URLs. Do not delete them.
2. Confirm Workers Paid and an economy usage/capacity budget, create isolated
   staging app resources plus the shared provider-budget D1, apply all five app
   migrations to staging and the provider database's one migration, and install
   the rotated shared Hypixel key only as a Worker secret.
3. Deploy private `skypilot-economy-staging` first, with its flag off, no Cron,
   and no public/preview URL. Then deploy `skypilot-staging`, verify its
   `ECONOMY_SERVICE` target, and run all automated checks and the complete
   route/API/browser smoke list.
4. Export old D1 data and import/verify it if durable data must be preserved.
   Quiesce old writers during the final copy window.
5. Create/verify production app D1/KV/rate/service bindings plus the existing
   shared `PROVIDER_BUDGET_DB`, apply all five production app migrations, and
   install only rotated production web secrets, including the same coordinated
   Hypixel credential.
   Deploy private `skypilot-economy` first, then the `skypilot` web Worker, with
   both economy flags off and no Cron.
6. Confirm the old Sites/economy schedule is absent or disabled. In a second
   reviewed release, after the Paid/capacity gates pass and the non-incremental
   active-Auction crawl is replaced,
   enable both economy flags and register exactly one production Cron on the
   private economy Worker without changing public DNS or retiring Sites.
7. Observe that scheduled event and the first complete Bazaar/active/ended
   publication. Verify stale/no-overwrite and D1 usage metrics.
8. Keep public player lookup gated until staging load/cache/filter/global-budget
   behavior, configured capacity, and monitoring are approved. Test secret absence,
   origin/CSRF behavior, logs, responsive/accessibility behavior, and current
   policy approval.
9. Attach or switch the final domain only after those gates pass.
10. Keep the old owner-only Sites deployment for a defined rollback window and
    perform a code rollback drill before retirement.

For a code regression, roll the web/private-economy pair back to compatible
recorded versions. For a database regression, stop writes/jobs, preserve/export
D1, and deploy a forward corrective migration. If the native deployment cannot
serve safely, disable the private Worker's Cron and both economy flags, disable
other state-changing features, and direct users back to the old known-good
deployment. Never try to roll back by deleting the new database or rewriting an
applied migration.

## Public-launch blockers

Cloudflare deployment is not the same as approval for public access. Do not
describe SkyPilot as public-ready until all applicable items are closed:

- Hypixel has approved SkyPilot's Production application and quota, and every
  credential ever disclosed outside a secret manager has been rotated;
- authenticated player admission, shared cache behavior, atomic D1 budget, and
  quota headroom have tested multi-region load/capacity and monitoring evidence;
- the conditional PlayerDB resolver has focused tests, staging egress evidence,
  strict username/UUID/Hypixel-match validation, aggregate-only operations
  telemetry, and an updated public privacy disclosure;
- the account is on Workers Paid, current D1 request/query limits are covered by
  tested bounded ingestion, and rows-read/rows-written usage plus cost alerts
  are monitored for the economy workload;
- optional public accounts have a verified non-Sites identity/session adapter,
  or all account-dependent features remain disabled;
- production D1 export/import, backup, restore, retention, and account-deletion
  behavior are verified;
- the current non-incremental active-Auction crawl is replaced by a verified
  capacity-safe incremental/compacted design, and exactly one
  private-economy schedule has produced complete live Bazaar/Auction data and
  stale/error behavior has passed;
- client/server bundles, source maps, generated deploy files, responses, and
  logs pass secret scanning, including an explicit check that no generated
  `.dev.vars*` or `.env*` reaches deployment;
- security, dependency, abuse, CORS/origin/CSRF, input-bound, and permission
  reviews pass;
- every route passes desktop, tablet, phone, keyboard, focus, reduced-motion,
  automated accessibility, performance, load/soak, and browser-console checks;
- privacy and terms identify the real host and identity provider;
- root/API/environment/architecture/operations status documentation no longer
  describes Sites as the active or preferred native runtime;
- a custom domain, alerts, and an exercised rollback procedure are in place if
  they are part of the intended launch.

Until then, use an isolated preview or owner-restricted deployment and label
disabled or unavailable integrations honestly. Never substitute fixture or
demo data for a failed live request.

[D1 limits]: https://developers.cloudflare.com/d1/platform/limits/
[D1 pricing]: https://developers.cloudflare.com/d1/platform/pricing/
