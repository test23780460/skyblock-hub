# Private Player Gateway

SkyPilot isolates authenticated Minecraft/Hypixel player lookup in a dedicated Cloudflare Worker. The Worker owns the Hypixel key, accepts only the fixed `/v1/player-analysis` product route, and returns a bounded normalized `PlayerAnalysis` model rather than raw upstream payloads.

The preferred transport is a signed server-to-server request from SkyPilot's `/api/player` route. For an owner-only Sites deployment whose server runtime cannot reach the Worker, SkyPilot also has an explicitly gated browser-capability transport. The same-origin Sites route mints a short-lived signature for one exact request body; the browser then sends those exact bytes to the fixed Worker route. Neither transport exposes `HYPIXEL_API_KEY` or `PLAYER_GATEWAY_SECRET` to browser code.

This gateway is for request-driven player lookup only. It must not become a raw Hypixel proxy, a scheduled player refresher, or a player-history collector.

## Runtime boundaries

Preferred server transport:

```text
Browser
  -> SkyPilot `/api/player` (same-origin GET)
  -> signed server-to-server POST `/v1/player-analysis`
  -> player gateway Worker
  -> bounded Minecraft/Hypixel providers
  -> normalized latest snapshot in shared KV
  -> signed `PlayerAnalysis` response verified by the SkyPilot server
```

Owner-only browser-capability transport:

```text
Browser
  -> SkyPilot `/api/player/capability` (same-origin POST)
  -> 30-second capability for one exact serialized player/profile body
  -> direct POST of those exact bytes to `/v1/player-analysis`
  -> Worker verifies signature, timestamp, actor, body hash, and exact Sites origin
  -> bounded providers, shared KV, normalized `PlayerAnalysis`, and per-profile save receipts
```

The browser request uses `credentials: "omit"`, rejects redirects, sends no referrer, and reuses the exact body supplied by the issuer. The Worker grants CORS only to the configured exact HTTPS `SKYPILOT_SITE_ORIGIN`, rejects an unapproved `Origin`, and permits only the required method and headers. CORS is a browser boundary, not the authorization mechanism; the origin-bound HMAC signature remains required.

The browser capability signature binds a protocol version, `POST`, the fixed path, exact Sites origin, timestamp, nonce, opaque actor, and exact body hash. It expires after 30 seconds, but it is **not consume-once**: any holder of a captured valid capability can replay the exact request with its signed origin header during that window. The current nonce and Cloudflare rate-limit bindings do not provide authoritative global replay prevention or an exact global Hypixel credential ledger. Keep this mode owner-only until either:

- a strongly consistent coordinator enforces consume-once capabilities and global credential budgeting; or
- the residual short-window replay and quota risk is explicitly reviewed and accepted for the intended public exposure.

## Narrow saved-profile attestation

Each successful live gateway response includes one versioned HMAC save receipt for every returned profile. A receipt expires after ten minutes and binds the exact player UUID, canonical username, profile ID/name, game mode, selected state, complete/partial data state, and lookup `fetchedAt` timestamp.

The browser accepts only an exact bounded receipt set whose profile IDs match that same analysis. When a signed-in user chooses **Save profile**, the dashboard forwards only the chosen profile's receipt to the same-origin `/api/saved-profiles` mutation. Sites verifies the HMAC and expiry with `PLAYER_GATEWAY_SECRET`, checks the submitted player selector and profile ID against the signed claims, and then persists the link under the authenticated SkyPilot owner without making another gateway request.

This receipt is deliberately narrow. It is not gateway access, account authentication, proof of Minecraft account ownership, or evidence that the snapshot stayed fresh after `fetchedAt`. It contains no secret and cannot authorize reads or changes to another owner's data. It is bearer-style, is not bound to a SkyPilot owner, actor, or origin, and can be reused until it expires; accept it only on the authenticated exact-origin saved-profile mutation. A missing, expired, tampered, or mismatched receipt must fail and require a fresh live lookup.

Workers KV stores only normalized provider values with fresh/stale expiry metadata. A small per-isolate L0 cache reduces repeated KV reads. Cloudflare Rate Limiting bindings provide per-actor and shared abuse headroom, but they are not an exact global Hypixel quota ledger; continue honoring Hypixel rate headers and monitor the approved production allocation.

## Required Worker bindings and configuration

- `PLAYER_CACHE`: Workers KV namespace.
- `PLAYER_ACTOR_LIMITER`: per-opaque-actor rate limiter.
- `PLAYER_GLOBAL_LIMITER`: shared gateway guard sized below the approved Hypixel application limit.
- `HYPIXEL_API_KEY`: Worker secret; never install this in Sites, the browser, or source control.
- `PLAYER_GATEWAY_SECRET`: at least 32 random characters; install the same value in the Worker and the SkyPilot server secret store.
- `SKYPILOT_SITE_ORIGIN`: non-secret exact deployed HTTPS origin allowed to use browser capabilities, with no path, query, fragment, or trailing slash.

The checked-in configuration is `cloudflare/player-gateway/wrangler.jsonc`. Generate types and validate the bundle with current Wrangler before deployment:

```powershell
npx wrangler types --config cloudflare/player-gateway/wrangler.jsonc --include-runtime false --strict-vars false
npx wrangler deploy --config cloudflare/player-gateway/wrangler.jsonc --dry-run
```

Install production secrets through the Cloudflare secret manager. Do not pass secret values as command-line arguments, write them to generated configuration, or copy them into deployment logs. The ignored local `.env` is an input source for an operator-controlled installation step, not a deploy artifact.

## Required Sites configuration

Set these on the SkyPilot server deployment:

- `PLAYER_GATEWAY_URL=https://<gateway-origin>`
- `PLAYER_GATEWAY_SECRET=<same secret as the Worker>`
- `REQUIRE_PLAYER_GATEWAY=true`
- `ENABLE_PLAYER_LOOKUP=true` only after the relevant live smoke test passes
- `SITE_URL=<exact deployed HTTPS origin>`
- `ENABLE_BROWSER_PLAYER_GATEWAY=true` only for the deliberately approved owner-only capability transport

`SITE_URL` must exactly match the deployed request origin and the Worker's `SKYPILOT_SITE_ORIGIN`. The browser security policy adds only the validated `PLAYER_GATEWAY_URL` origin to `connect-src`.

After cutover, remove `HYPIXEL_API_KEY` from Sites. It belongs only in the gateway Worker. A missing or invalid gateway configuration must fail closed; do not silently fall back to direct production Hypixel access when `REQUIRE_PLAYER_GATEWAY=true`.

`ENABLE_BROWSER_PLAYER_GATEWAY` changes the dashboard and money-making browser lookup transport. The receipt path also lets the dashboard save a selected live profile without Sites-to-gateway egress, provided trusted account storage is enabled. `/api/player` and AI player context still need working server-to-server gateway egress; keep AI disabled in an egress-limited Sites deployment.

## Deployment order

1. Revoke every key previously exposed outside a secret manager and create a replacement tied to SkyPilot's own approved Hypixel application.
2. Create or verify the KV and rate-limit bindings; set the exact `SKYPILOT_SITE_ORIGIN`.
3. Install both Worker secrets.
4. Deploy the gateway. Confirm an unsigned no-origin request receives `401`, a hostile-origin request receives `403` without an allow-origin header, and an exact-origin preflight allows only the fixed POST headers.
5. Configure Sites with the gateway URL/shared secret, exact `SITE_URL`, and `REQUIRE_PLAYER_GATEWAY=true`; remove the Hypixel key from Sites. Enable the browser transport only for the intended owner-only deployment.
6. Redeploy the exact validated SkyPilot commit privately.
7. From the deployed Sites origin, test a valid username and UUID, selected-profile handling, not-found, invalid-input, rate-limit, timeout, and unavailable paths. Verify the capability route succeeds before the Worker request and that the browser sends the issuer's exact body without credentials.
8. With a test identity, select a non-default returned profile, save it within ten minutes, and verify the stored UUID/profile/name/state match the receipt. Confirm missing, expired, tampered, mismatched-player, and mismatched-profile receipts fail without persistence.
9. Independently test any server-only player consumers that remain enabled; keep AI disabled when its gateway egress is not proven.
10. Check gateway/Sites logs for bounded structured events only, and scan deployed browser assets, responses, source maps, and hosting metadata for secrets.
11. Keep the site private until the capability coordination/risk decision, Hypixel Production approval, privacy/terms review, current-policy review, and the full launch checklist are complete.

Enabling a `workers.dev` route is acceptable for this owner-only transport only with the signed fixed-route protocol and exact-origin controls above. Prefer an authenticated private service binding when the hosting platform preserves it. Never replace signature authentication with CORS, `Origin`, an unbound query token, or a browser-visible API key.
