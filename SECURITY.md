# SkyPilot Security Policy

## Reporting a vulnerability

Use the repository’s private GitHub Security Advisory flow when available. Do not open a public issue for an exploitable vulnerability, and do not include active API keys, OAuth credentials, raw authentication headers, private prompts, or full player payloads.

Include the affected route/component, reproducible steps, impact, and a minimal redacted proof. The project is pre-release; only the current `main` branch is maintained.

## Secret handling

- Runtime secrets belong in the local ignored `.env` file or the deployment platform’s secret store.
- `.env.example` contains names and safe defaults only.
- `HYPIXEL_API_KEY` and `OPENAI_API_KEY` are server-only and must never reach client bundles, URLs, logs, API responses, fixtures, screenshots, or documentation. Native production keeps the Hypixel key only in the Worker secret store. `PLAYER_GATEWAY_SECRET` is retained only for the legacy rollback gateway.
- `ADMIN_USER_IDS` is configuration, not an authentication mechanism by itself; a cryptographically verified native identity and server-side checks still apply.
- Any key pasted into chat, an issue, a log, or source control is exposed. Revoke it and create a replacement before activation.
- Never rotate multiple Hypixel keys to bypass rate limits.

## Trust boundaries

SkyPilot treats usernames, query parameters, request JSON, auth headers,
Hypixel/Minecraft/PlayerDB/OpenAI responses, and item/NBT data as untrusted.
Current provider adapters bound input length, response size, request duration,
array sizes, identifiers, and public output fields. Product APIs return
classified safe errors rather than upstream bodies.

Native player lookup uses same-origin product APIs, a web-Worker-only secret,
environment-isolated KV, coarse per-location Cloudflare abuse filters, and an
atomic fixed-window budget in the dedicated shared `PROVIDER_BUDGET_DB`. The
route-bound actor limiter applies before lookup work; Mojang identity calls do
not spend Hypixel quota. Only an authenticated Hypixel transport attempt runs
one shared limiter check and one two-token D1 reservation. The key is
sent only as the `API-Key` request header to Hypixel; bounded normalized results,
not raw upstream bodies, reach product routes. The optional public-economy job
uses keyless feeds and runs only in a private Worker reached through
`ECONOMY_SERVICE`; Bazaar/Auction web routes read D1 snapshots and never call
Hypixel. The private economy Workers expose no `workers.dev` or preview URL. The
older signed gateway remains rollback code only.

Both official username resolvers currently fail from native Cloudflare Worker
egress. Source therefore includes a conditional [PlayerDB API](https://playerdb.co/)
fallback after transport/access failures only; it never bypasses an authoritative
official not-found response. SkyPilot's fixed HTTPS request explicitly contains
the normalized requested username and identifying service `User-Agent`, as
PlayerDB requests. Application code does not copy browser cookies,
authentication, profile selectors, or the Hypixel key. [Cloudflare documents](https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-connecting-ip)
that it may add network headers to Worker subrequests; depending on destination
routing those headers can contain the visitor IP. Do not rely on PlayerDB remaining
Cloudflare-proxied as an IP-redaction control. Revalidate routing/header behavior
before activation and keep the public privacy disclosure conservative. The
response must have PlayerDB's expected
success code, a case-insensitive exact username match, and a valid Java UUID;
the UUID and display name must then match Hypixel's authenticated player response. Invalid or
mismatched data fails closed.

## Authentication and authorization

Native account features are default-off. The included Cloudflare Access adapter
validates `Cf-Access-Jwt-Assertion` with RS256, the team JWK set, exact issuer
and audience, expiry, and bounded subject/email claims before mapping to a
canonical SkyPilot user. Header presence alone is not authentication.

Saved accounts/profiles, preferences, favorites, builds, goals, and application-account deletion require a signed-in identity and owner-scoped repository operations. Public/unlisted build reads expose only the bounded shared view. Admin pages/actions additionally require an exact server-side `ADMIN_USER_IDS` allowlist match. The only current administrator action is a fixed, confirmed private-economy refresh request; account deletion also has explicit UI confirmation.

Cloudflare Access may protect an intentionally private hostname, but protecting
the whole public hostname would violate account-free lookup/planning. A
path-only Access login also does not by itself establish an optional app session
on unprotected routes. Keep `ENABLE_ACCOUNT_AUTH=false` until that public
session design passes end-to-end tests. AI, goal, account, and admin mutations
require an explicit exact request Origin; JSON routes also enforce bounded
bodies. Origin checks are not a replacement for verified identity.

## Data and privacy

- Player lookup is request-driven; saved data must not start profile polling or session history.
- When the conditional PlayerDB fallback is used, PlayerDB receives the requested
  Minecraft username, SkyPilot's identifying user agent, and ordinary
  server-request metadata. Cloudflare-added network headers may include a
  visitor IP depending on destination routing. SkyPilot retains only the
  normalized latest username/UUID mapping under the existing identity-cache TTL;
  it stores no PlayerDB avatar, metadata, raw response, or lookup history. Review
  the [PlayerDB API](https://playerdb.co/) and [Nodecraft privacy policy](https://nodecraft.com/legal/privacy-policy)
  before activation. Focused tests and the public `/privacy` disclosure pass;
  staging verification is still required, so the fallback is not yet claimed
  deployed live.
- Canonical users are independent of auth-provider IDs.
- Demo data is explicitly labeled and never silently substituted for live production data.
- Analytics and error context must be minimal and redacted; raw prompts and unnecessary personal data do not belong in telemetry.
- Database foreign keys, uniqueness, checks, and repository boundaries protect durable state. Tests verify owned account-data cascades and retained operational/audit records remove canonical-user attribution; backups and retention still require deployment configuration.

## Current hardening gaps

These are release blockers or scale limitations, not hidden assurances:

- hosted player/provider values use shared normalized Workers KV without
  cross-request I/O Promise coalescing; Cloudflare rate bindings are coarse
  per-location abuse filters, the shared dedicated D1 credential budget still needs
  production load/capacity monitoring, Hypixel response-header backoff is per
  isolate, and AI throttling remains in-memory per runtime;
- the PlayerDB username fallback and public privacy disclosure pass focused
  tests, but staging egress smoke and production monitoring/incident validation
  remain incomplete;
- no production database migration, backup/retention policy, economy schedule,
  alerting, or remote observability verification has been activated;
- the mutation origin guard still needs deployment-specific proxy/origin
  validation before any optional cookie-backed public-account launch;
- bounded live item decoding covers five supported containers and discards raw base64, NBT trees, lore, and unsupported fields before caching, but full modifier/pet/storage analysis and a release-level parser audit remain incomplete;
- comprehensive application/deployment security scanning and review are not documented as passing;
- optional public-account authentication and non-Cloudflare secrets adapters
  are not implemented.

See [Known limitations](docs/limitations.md), [operations](docs/operations.md), and the current [Hypixel policy guide](docs/policies/hypixel-api.md).

## Release checklist

Before a public launch:

1. Rotate every credential previously shared outside a secret manager.
2. Apply all five app migrations to the isolated production `DB`, apply the one
   provider-budget migration to the shared `PROVIDER_BUDGET_DB`, and verify
   backup/restore for both database roles.
3. Keep accounts off or configure a verified optional-session design, admin
   allowlists, CSRF/origin protection, and secure cookies.
4. Verify native KV caching, the route-bound actor filter, authenticated-call
   shared filter, atomic reservations in `PROVIDER_BUDGET_DB`, approved Hypixel
   quota headroom, monitoring, and a live
   multi-region staging lookup.
5. Deploy each private economy Worker before its web Worker. Confirm Workers
   Paid, migrations, D1 usage/capacity monitoring, replacement of the current
   non-incremental active-Auction crawl with a reviewed incremental or compacted
   design, and exactly one private-Worker Cron before enabling both
   public-economy flags.
6. Re-read current Hypixel policy and run the documented policy/security audits.
7. Run lint, typecheck, the full test/build suite, secret and deploy-artifact
   scanning, and deployment smoke tests.
8. Verify no client/server asset, generated environment file, response, log, or
   source map contains a secret.
