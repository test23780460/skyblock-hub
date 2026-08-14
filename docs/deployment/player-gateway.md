# Private Player Gateway

SkyPilot isolates authenticated Minecraft/Hypixel player lookup in a dedicated Cloudflare Worker. The browser never calls that Worker directly. A SkyPilot server route validates the user request, signs a bounded JSON body, verifies the signed response, and returns only the existing normalized `PlayerAnalysis` product model.

This gateway is for request-driven player lookup only. It must not become a raw Hypixel proxy, a scheduled player refresher, or a player-history collector.

## Runtime boundary

```text
Browser
  -> SkyPilot `/api/player` (same-origin GET)
  -> signed server-to-server POST `/v1/player-analysis`
  -> private player gateway
  -> bounded Minecraft/Hypixel providers
  -> normalized latest snapshot in shared KV
  -> signed `PlayerAnalysis` response
```

The request signature binds the method, fixed path, timestamp, nonce, opaque actor, and body hash. The response signature binds the status, request nonce, and response body. The Worker emits no CORS permission, accepts no arbitrary provider path, bounds request and response reads, and never logs credentials or player payloads.

Workers KV stores only normalized provider values with fresh/stale expiry metadata. A small per-isolate L0 cache reduces repeated KV reads. Cloudflare Rate Limiting bindings provide per-actor and shared abuse headroom, but they are not an exact global Hypixel quota ledger; continue honoring Hypixel rate headers and monitor real production allocation.

## Required Worker bindings

- `PLAYER_CACHE`: Workers KV namespace.
- `PLAYER_ACTOR_LIMITER`: per-opaque-actor rate limiter.
- `PLAYER_GLOBAL_LIMITER`: shared gateway guard sized below the approved Hypixel application limit.
- `HYPIXEL_API_KEY`: Worker secret; never install this in the browser or commit it.
- `PLAYER_GATEWAY_SECRET`: at least 32 random characters; install the same value in the Worker and the SkyPilot server secret store.

The checked-in configuration is `cloudflare/player-gateway/wrangler.jsonc`. Generate types and validate the bundle with current Wrangler before deployment:

```powershell
npx wrangler types --config cloudflare/player-gateway/wrangler.jsonc --include-runtime false --strict-vars false
npx wrangler deploy --config cloudflare/player-gateway/wrangler.jsonc --dry-run
```

Install production secrets through the Cloudflare secret manager. Do not pass secret values as command-line arguments, write them to generated configuration, or copy them into deployment logs. The ignored local `.env` is an input source for an operator-controlled installation step, not a deploy artifact.

## Required Sites configuration

Set these on the SkyPilot server deployment:

- `PLAYER_GATEWAY_URL=https://<private-or-signed-gateway-origin>`
- `PLAYER_GATEWAY_SECRET=<same secret as the Worker>`
- `REQUIRE_PLAYER_GATEWAY=true`
- `ENABLE_PLAYER_LOOKUP=true` only after the full live smoke test passes
- `SITE_URL=<exact deployed HTTPS origin>`

After cutover, remove `HYPIXEL_API_KEY` from Sites. It belongs only in the gateway Worker. A missing or invalid gateway configuration must fail closed; do not silently fall back to direct production Hypixel access when `REQUIRE_PLAYER_GATEWAY=true`.

## Deployment order

1. Revoke every key previously exposed outside a secret manager and create a replacement tied to SkyPilot's own approved Hypixel application.
2. Create/verify the KV and rate-limit bindings.
3. Install both Worker secrets.
4. Deploy the gateway and confirm an unsigned request receives `401` without CORS or secret-bearing detail.
5. Configure Sites with the gateway URL/shared secret, exact `SITE_URL`, and `REQUIRE_PLAYER_GATEWAY=true`; remove the Hypixel key from Sites.
6. Redeploy the exact validated SkyPilot commit privately.
7. From the deployed Sites origin, test a valid username and UUID, selected-profile handling, not-found, invalid-input, rate-limit, timeout, and unavailable paths.
8. Check gateway/Sites logs for bounded structured events only, and scan deployed browser assets/responses for secrets.
9. Keep the site private until Hypixel Production approval, privacy/terms review, current-policy review, and the full launch checklist are complete.

Enabling a `workers.dev` route is acceptable only with the signed fixed-route protocol above. Prefer an authenticated private service binding when the hosting platform preserves it. Never replace server authentication with CORS, `Origin`, an unbound query token, or a browser-visible API key.
