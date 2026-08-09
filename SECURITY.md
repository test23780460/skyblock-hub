# SkyPilot Security Policy

## Reporting a vulnerability

Use the repository’s private GitHub Security Advisory flow when available. Do not open a public issue for an exploitable vulnerability, and do not include active API keys, OAuth credentials, raw authentication headers, private prompts, or full player payloads.

Include the affected route/component, reproducible steps, impact, and a minimal redacted proof. The project is pre-release; only the current `main` branch is maintained.

## Secret handling

- Runtime secrets belong in the local ignored `.env` file or the deployment platform’s secret store.
- `.env.example` contains names and safe defaults only.
- `HYPIXEL_API_KEY` and `OPENAI_API_KEY` are server-only and must never reach client bundles, URLs, logs, API responses, fixtures, screenshots, or documentation.
- `ADMIN_USER_IDS` is configuration, not an authentication mechanism by itself; Sites identity headers and server-side checks still apply.
- Any key pasted into chat, an issue, a log, or source control is exposed. Revoke it and create a replacement before activation.
- Never rotate multiple Hypixel keys to bypass rate limits.

## Trust boundaries

SkyPilot treats usernames, query parameters, request JSON, auth headers, Hypixel/Minecraft/OpenAI responses, and item/NBT data as untrusted. Current provider adapters bound input length, response size, request duration, array sizes, identifiers, and public output fields. Product APIs return classified safe errors rather than upstream bodies.

The authenticated Hypixel key is sent only as the `API-Key` request header from the server adapter. Public Bazaar/Auction requests intentionally omit it. Product APIs expose normalized fields needed by SkyPilot rather than forwarding arbitrary endpoints or raw co-op member data.

## Authentication and authorization

Optional Sites sign-in is represented by dispatch-injected identity headers. Those identities map to a canonical SkyPilot user before business records are written. Reserved Sites sign-in/sign-out/callback paths are not implemented by the application.

Goals require a signed-in identity. Admin pages and actions additionally require an exact server-side `ADMIN_USER_IDS` allowlist match. Administrator actions are a fixed allowlist; targeted cache invalidation asks for confirmation in the UI.

Before production, verify the hosting layer strips user-supplied copies of trusted identity headers and injects its own values. External hosting must replace Sites identity with a verified auth adapter. AI, goal, and admin mutations enforce bounded JSON and an exact-origin browser guard; an external cookie-backed deployment must still validate that guard against its real proxy/origin topology.

## Data and privacy

- Player lookup is request-driven; saved data must not start profile polling or session history.
- Canonical users are independent of auth-provider IDs.
- Demo data is explicitly labeled and never silently substituted for live production data.
- Analytics and error context must be minimal and redacted; raw prompts and unnecessary personal data do not belong in telemetry.
- Database foreign keys, uniqueness, checks, and repository boundaries protect durable state; backups and retention still require deployment configuration.

## Current hardening gaps

These are release blockers or scale limitations, not hidden assurances:

- provider cache, single-flight state, Hypixel rate state, and AI throttling are in-memory per runtime, not distributed;
- no production database, backup, retention, scheduler, or observability service has been activated or verified;
- the mutation origin guard still needs deployment-specific proxy/origin validation before any non-Sites cookie-backed launch;
- full NBT inventory parsing is not wired into live routes;
- dependency/security scanning beyond the repository CI secret-pattern check is not documented as passing;
- external-host authentication and secrets adapters are not implemented.

See [Known limitations](docs/limitations.md), [operations](docs/operations.md), and the current [Hypixel policy guide](docs/policies/hypixel-api.md).

## Release checklist

Before a public launch:

1. Rotate every credential previously shared outside a secret manager.
2. Apply migrations to an isolated production database and verify backup/restore.
3. Configure verified auth, admin allowlists, CSRF/origin protection, and secure cookies at the host.
4. Replace per-instance cache/rate state where more than one runtime can serve traffic.
5. Re-read current Hypixel policy and run the documented policy/security audits.
6. Run lint, typecheck, the full test/build suite, secret scanning, and deployment smoke tests.
7. Verify no client asset, response, log, or source map contains a secret.
