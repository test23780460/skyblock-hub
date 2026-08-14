# Environment and Bindings

Copy `.env.example` to an ignored `.env` for local development. Commit variable names and safe defaults only.

## Variables

| Name | Default/example | Status and behavior |
| --- | --- | --- |
| `HYPIXEL_API_KEY` | blank | Wired. Local direct-provider mode may read it, but production installs it only as a private player-gateway Worker secret. It is sent to Hypixel as `API-Key`; public economy calls omit it. |
| `PLAYER_GATEWAY_URL` | blank | Wired. HTTPS origin for the signed private player gateway. The fixed `/v1/player-analysis` path is added server-side. |
| `PLAYER_GATEWAY_SECRET` | blank | Wired. At least 32 random characters, held only by the SkyPilot server and gateway Worker for body-bound signatures and ten-minute profile-save receipts. Browsers receive derived signatures, never this secret. |
| `REQUIRE_PLAYER_GATEWAY` | `false` | Wired. Set `true` in hosted production so player lookup fails closed instead of using the local direct-provider composition. |
| `OPENAI_API_KEY` | blank | Wired. Used by `/api/ai` only after `ENABLE_AI_ASSISTANT=true`; the rest of SkyPilot degrades cleanly without it. |
| `OPENAI_MODEL` | example value | Wired. Overrides the Responses API model used by the AI route. Validate model access before deployment. |
| `OPENAI_INPUT_COST_USD_PER_MILLION` | `0` | Wired. Non-secret configured input-token rate used for aggregate cost estimates; zero means no cost estimate is claimed. |
| `OPENAI_OUTPUT_COST_USD_PER_MILLION` | `0` | Wired. Non-secret configured output-token rate used for aggregate cost estimates; zero means no cost estimate is claimed. |
| `SITE_NAME` | `SkyPilot` | Wired. Central display/application name. |
| `SITE_URL` | `http://localhost:3000` | Wired. Canonical URLs, sitemap, and metadata fallback. Set the real HTTPS origin in production. |
| `ADMIN_USER_IDS` | blank | Wired. Comma-separated verified Sites/ChatGPT user IDs allowed into admin pages/actions. |
| `ENABLE_AI_ASSISTANT` | `false` | Enforced by the AI API. Enable only with a replacement key and durable abuse/cost controls. |
| `ENABLE_CHATGPT_AUTH` | `false` | Enforced by Sites identity helpers and account APIs. Enable only behind a trusted edge that strips spoofed identity headers. |
| `ENABLE_PLAYER_LOOKUP` | `false` | Enforced by player and saved-profile APIs. Keep off until the signed gateway, shared normalized KV cache, abuse guards, replacement key, and live Sites-to-gateway smoke test are verified. |
| `ENABLE_BROWSER_PLAYER_GATEWAY` | `false` | Enforced by the capability issuer, player-lookup UIs, and saved-profile create route. Enables the owner-only 30-second exact-body browser capability and requires a matching ten-minute HMAC receipt for each saved live profile when Sites server egress cannot reach the gateway. The capability is replayable during its window and must remain off for public access until authoritative coordination exists or the residual risk is explicitly accepted. |
| `ENABLE_PUBLIC_ECONOMY` | `false` | Enforced by economy APIs and the scheduled handler. Durable D1 ingestion/history is implemented; keep off until all four migrations and exactly one production schedule are active and verified. |
| `ENABLE_ADS` | `false` | Parsed default only. Advertising is not implemented or activated. |
| `ENABLE_PREMIUM` | `false` | Parsed default only. Premium is not implemented or activated. |
| `ENABLE_PUBLIC_PROFILES` | `false` | Parsed default only. Public profile sharing is not implemented. |
| `ENABLE_GUILD_TOOLS` | `false` | Parsed default only. Advanced Guild tooling is deferred. |
| `ENABLE_PRICE_ALERTS` | `false` | Parsed default only. Price alerts are deferred. |
| `ENABLE_EXPERIMENTAL_FEATURES` | `false` | Parsed default; experimental build/profile features are not fully wired. |
| `DATABASE_URL` | blank | Reserved for a future external/PostgreSQL adapter. The current application uses the D1 `DB` binding. |
| `REDIS_URL` | blank | Reserved for a future distributed cache/rate/queue adapter. The current runtime uses in-memory state. |

## Sites bindings

`.openai/hosting.json` declares:

```json
{
  "d1": "DB",
  "r2": null
}
```

`DB` is a platform binding, not a secret placed in `.env`. After all four migrations are applied, it stores optional saved account/goal/build state, aggregate AI metrics, and durable public-economy lease/feed/snapshot/history/ended-sale rows. R2/object storage is not currently configured.

Sites sign-in supplies trusted identity headers at dispatch. External hosts must replace that mechanism; never accept equivalent headers directly from an untrusted client or edge that does not strip spoofed values.

The player gateway has its own KV/rate-limit bindings and secret store; it is not declared in `.openai/hosting.json`. Its non-secret `SKYPILOT_SITE_ORIGIN` Worker variable must be the exact deployed HTTPS `SITE_URL`, without a path, query, fragment, or trailing slash. See [Private player gateway](deployment/player-gateway.md). After production cutover, Sites holds `PLAYER_GATEWAY_URL` and `PLAYER_GATEWAY_SECRET`, while only the gateway holds `HYPIXEL_API_KEY`.

When browser capability mode is enabled, SkyPilot's CSP adds only the validated `PLAYER_GATEWAY_URL` origin to `connect-src`. The dashboard and money-making UI may use the capability transport. The dashboard can save a selected live profile by forwarding its exact ten-minute receipt to the authenticated same-origin saved-profile route, which verifies it locally with `PLAYER_GATEWAY_SECRET`; `/api/player` and AI player context still require working server-to-server gateway egress. Keep AI disabled when that path is unavailable.

## Secret rules

1. Use a deployment secret manager for production values.
2. Revoke any credential previously pasted into chat, logs, issues, screenshots, or commits.
3. Never prefix a client-visible environment variable with a secret value.
4. Do not put keys in URLs, browser storage, fixtures, migration data, analytics, or error context.
5. Keep admin IDs and auth-provider configuration server-side.
6. Verify built client assets and logs contain no secrets before release.

See [Security](../SECURITY.md).
