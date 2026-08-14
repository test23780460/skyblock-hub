# SkyPilot Security Policy

## Reporting a vulnerability

Use the repository’s private GitHub Security Advisory flow when available. Do not open a public issue for an exploitable vulnerability, and do not include active API keys, OAuth credentials, raw authentication headers, private prompts, or full player payloads.

Include the affected route/component, reproducible steps, impact, and a minimal redacted proof. The project is pre-release; only the current `main` branch is maintained.

## Secret handling

- Runtime secrets belong in the local ignored `.env` file or the deployment platform’s secret store.
- `.env.example` contains names and safe defaults only.
- `HYPIXEL_API_KEY`, `PLAYER_GATEWAY_SECRET`, and `OPENAI_API_KEY` are server-only and must never reach client bundles, URLs, logs, API responses, fixtures, screenshots, or documentation. Hosted production keeps the Hypixel key only on the private player gateway.
- `ADMIN_USER_IDS` is configuration, not an authentication mechanism by itself; Sites identity headers and server-side checks still apply.
- Any key pasted into chat, an issue, a log, or source control is exposed. Revoke it and create a replacement before activation.
- Never rotate multiple Hypixel keys to bypass rate limits.

## Trust boundaries

SkyPilot treats usernames, query parameters, request JSON, auth headers, Hypixel/Minecraft/OpenAI responses, and item/NBT data as untrusted. Current provider adapters bound input length, response size, request duration, array sizes, identifiers, and public output fields. Product APIs return classified safe errors rather than upstream bodies.

Hosted player lookup uses a fixed-route, body-bound signed request from the SkyPilot server to the private player gateway. The authenticated Hypixel key is sent only as the `API-Key` request header from that Worker; signed gateway responses are bounded and revalidated before reaching product routes. The public-economy worker calls keyless public feeds; Bazaar/Auction web routes read normalized D1 snapshots and never call Hypixel. Product APIs expose only fields needed by SkyPilot rather than forwarding arbitrary endpoints or raw co-op member data.

## Authentication and authorization

Optional Sites sign-in is represented by dispatch-injected identity headers. Those identities map to a canonical SkyPilot user before business records are written. Reserved Sites sign-in/sign-out/callback paths are not implemented by the application.

Saved accounts/profiles, preferences, favorites, builds, goals, and application-account deletion require a signed-in identity and owner-scoped repository operations. Public/unlisted build reads expose only the bounded shared view. Admin pages/actions additionally require an exact server-side `ADMIN_USER_IDS` allowlist match. Administrator actions are fixed; targeted cache invalidation and account deletion have explicit UI confirmation.

Before production, verify the hosting layer strips user-supplied copies of trusted identity headers and injects its own values. External hosting must replace Sites identity with a verified auth adapter. AI, goal, account, and admin mutations require an explicit exact request Origin; JSON routes also enforce bounded bodies. A non-browser client can forge ordinary headers, so this guard is not a replacement for the trusted identity boundary.

## Data and privacy

- Player lookup is request-driven; saved data must not start profile polling or session history.
- Canonical users are independent of auth-provider IDs.
- Demo data is explicitly labeled and never silently substituted for live production data.
- Analytics and error context must be minimal and redacted; raw prompts and unnecessary personal data do not belong in telemetry.
- Database foreign keys, uniqueness, checks, and repository boundaries protect durable state. Tests verify owned account-data cascades and retained operational/audit records remove canonical-user attribution; backups and retention still require deployment configuration.

## Current hardening gaps

These are release blockers or scale limitations, not hidden assurances:

- hosted player/provider values use shared normalized Workers KV, but in-flight coalescing and Hypixel response-header backoff remain per isolate; Cloudflare rate bindings are per-location abuse guards rather than an exact global quota ledger, and AI throttling remains in-memory per runtime;
- no production database, backup, retention policy, economy schedule, or observability service has been activated or verified;
- the mutation origin guard still needs deployment-specific proxy/origin validation before any non-Sites cookie-backed launch;
- bounded live item decoding covers five supported containers and discards raw base64, NBT trees, lore, and unsupported fields before caching, but full modifier/pet/storage analysis and a release-level parser audit remain incomplete;
- comprehensive application/deployment security scanning and review are not documented as passing;
- external-host authentication and secrets adapters are not implemented.

See [Known limitations](docs/limitations.md), [operations](docs/operations.md), and the current [Hypixel policy guide](docs/policies/hypixel-api.md).

## Release checklist

Before a public launch:

1. Rotate every credential previously shared outside a secret manager.
2. Apply all four migrations to an isolated production database and verify backup/restore.
3. Configure verified auth, admin allowlists, CSRF/origin protection, and secure cookies at the host.
4. Verify the signed player gateway, shared KV, abuse guards, approved Hypixel quota headroom, and live Sites-to-gateway request; add stricter upstream-call coordination if observed multi-region misses require it.
5. Re-read current Hypixel policy and run the documented policy/security audits.
6. Run lint, typecheck, the full test/build suite, secret scanning, and deployment smoke tests.
7. Verify no client asset, response, log, or source map contains a secret.
