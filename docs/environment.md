# Environment and Bindings

Copy `.env.example` to an ignored `.env` for local development. Commit variable names and safe defaults only.

## Variables

| Name | Default/example | Status and behavior |
| --- | --- | --- |
| `HYPIXEL_API_KEY` | blank | Wired. Required only for authenticated player/profile endpoints after `ENABLE_PLAYER_LOOKUP=true`; kept server-side and sent as `API-Key`. Public economy calls omit it. |
| `OPENAI_API_KEY` | blank | Wired. Used by `/api/ai` only after `ENABLE_AI_ASSISTANT=true`; the rest of SkyPilot degrades cleanly without it. |
| `OPENAI_MODEL` | example value | Wired. Overrides the Responses API model used by the AI route. Validate model access before deployment. |
| `OPENAI_INPUT_COST_USD_PER_MILLION` | `0` | Wired. Non-secret configured input-token rate used for aggregate cost estimates; zero means no cost estimate is claimed. |
| `OPENAI_OUTPUT_COST_USD_PER_MILLION` | `0` | Wired. Non-secret configured output-token rate used for aggregate cost estimates; zero means no cost estimate is claimed. |
| `SITE_NAME` | `SkyPilot` | Wired. Central display/application name. |
| `SITE_URL` | `http://localhost:3000` | Wired. Canonical URLs, sitemap, and metadata fallback. Set the real HTTPS origin in production. |
| `ADMIN_USER_IDS` | blank | Wired. Comma-separated verified Sites/ChatGPT user IDs allowed into admin pages/actions. |
| `ENABLE_AI_ASSISTANT` | `false` | Enforced by the AI API. Enable only with a replacement key and durable abuse/cost controls. |
| `ENABLE_CHATGPT_AUTH` | `false` | Enforced by Sites identity helpers and account APIs. Enable only behind a trusted edge that strips spoofed identity headers. |
| `ENABLE_PLAYER_LOOKUP` | `false` | Enforced by both player API routes. Keep off until shared cache, single-flight, rate budget, and abuse controls are coordinated across instances. |
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

## Secret rules

1. Use a deployment secret manager for production values.
2. Revoke any credential previously pasted into chat, logs, issues, screenshots, or commits.
3. Never prefix a client-visible environment variable with a secret value.
4. Do not put keys in URLs, browser storage, fixtures, migration data, analytics, or error context.
5. Keep admin IDs and auth-provider configuration server-side.
6. Verify built client assets and logs contain no secrets before release.

See [Security](../SECURITY.md).
