# Product API Reference

All APIs are product-specific; SkyPilot does not expose a raw or unrestricted Hypixel proxy. Successful responses generally use `{ "data": ... }`. Failures use a safe `{ "error": { "code", "message", "action?", "retryAfterSeconds?" } }` envelope and never include upstream response bodies, database details, or secrets.

## Public reads

### `GET /api/health`

Reports the safe environment label and whether D1, player KV/admission, and the
Hypixel credential are configured, without exposing binding IDs/names or probing
upstreams. It returns HTTP 200 for liveness; inspect `status` and dependency
fields for a feature-enabled misconfiguration.

### `GET /api/player?username=<name-or-uuid>&profile=<profile-id>`

### `GET /api/player/<name-or-uuid>?profile=<profile-id>`

Accepts either a Java Minecraft username or a dashed/undashed Java UUID.
Username requests try Minecraft Services and then the official Mojang lookup.
Source now includes a conditional [PlayerDB](https://playerdb.co/) fallback only
when both official resolvers fail for transport, timeout, unavailable, or
forbidden reasons; it never bypasses an authoritative official not-found result
or uses an unsupported Hypixel name query. SkyPilot application code supplies
only the normalized requested username plus its identifying service user agent;
Cloudflare may add ordinary network headers, including visitor-IP metadata
depending on destination routing. Its response
must contain the expected success code, an exact case-insensitive username
match, and a valid Java UUID. The UUID and display name are then validated
against the authenticated Hypixel player response. Focused tests and the
recorded exact-commit staging egress/schema/error smoke pass. In that smoke, the
username
path reached PlayerDB and then Hypixel, while username and direct-UUID requests
both returned the designed `503 forbidden` response because the configured
Hypixel credential was invalid. This is not evidence of successful live player
data. With a valid credential, both paths fetch available SkyBlock profiles,
normalize only the requested member's supported fields, and return deterministic
analysis. `profile` is optional.

Requires `ENABLE_PLAYER_LOOKUP=true`, `PLAYER_CACHE`, `PROVIDER_BUDGET_DB`,
`PLAYER_ACTOR_LIMITER`, `PLAYER_GLOBAL_LIMITER`, and the web-Worker-only
`HYPIXEL_API_KEY`. Both route forms use the native web composition. The
route-bound actor filter runs before lookup work, and positive/negative
normalized provider values use the environment's KV/L0 cache. Mojang identity
calls do not consume Hypixel quota. Only when a cache miss reaches an
authenticated Hypixel transport does SkyPilot perform one coarse
`PLAYER_GLOBAL_LIMITER` check and one atomic two-token reservation in the shared
provider-budget D1. Responses are `no-store`. Common failures include invalid
input, player/profile not found, no profiles, missing binding/credential, rate
limit, timeout, budget-storage failure, and invalid or unavailable upstream
response.

### `POST /api/player/capability` (legacy rollback only)

Legacy owner-only Sites rollback endpoint for deployments that deliberately set
`ENABLE_BROWSER_PLAYER_GATEWAY=true`. Native staging/production keep it off and
do not configure gateway variables. It accepts an exact JSON object containing
`player` and optional `profileId`, requires an explicit request `Origin`
matching `SITE_URL`, and returns a private/no-store fixed-route capability.

In that historical rollback path, the capability lasts 30 seconds and is bound
to the exact body, opaque actor, timestamp, nonce, fixed Worker path, and
configured Sites origin. It does not expose either gateway secret. A successful
gateway result also carries one ten-minute HMAC save receipt per returned
profile; the capability issuer itself does not fetch or return those receipts.

The rollback capability is not one-time or globally replay-proof: any holder may
replay its exact request and signed origin header during the short validity
window. Keep it off in native and public deployments. The endpoint issues only
a rollback capability; it is not a raw upstream proxy and does not replace the
native server transport.

### `GET /api/economy/bazaar?q=<term>&limit=<1..250>`

Reads the latest published D1 snapshot and returns normalized Bazaar summary fields, source/publish timestamps, product counts, safely skipped records, and a non-guarantee notice. `q` filters the snapshot by product ID. Default limit: 100. The route uses a short public response cache and never calls Hypixel.

### `GET /api/economy/bazaar/history?product=<id>&resolution=<hour|day>&limit=<count>`

Reads worker-built OHLC/average-volume buckets for one canonical Bazaar product. Hour buckets retain up to 90 days and day buckets up to three years; route limits cannot exceed those windows. The response names its canonical product identity, aggregation progress, source/aggregation timestamps, points, deterministic movement summary, and methodology notice. These are Hypixel summary-price observations—not exact trades, guaranteed quotes, or item valuation evidence.

### `GET /api/economy/auctions?page=<0..10000>&q=<term>&limit=<1..250>`

Reads one bounded page from the latest complete D1 active-Auction snapshot. `q` filters item names across that snapshot before counting and pagination. Default page: 0; default limit: 100. Seller, bidder, profile, lore, and raw item payloads are omitted.

### `GET /api/economy/auctions/ended?limit=<1..500>`

Returns a bounded retained ended-sale feed from D1, sorted by end time. Buyer, seller, profile, and raw item data are omitted. Default limit: 100.

All economy reads require the web Worker's `ENABLE_PUBLIC_ECONOMY=true` and a
published private-worker snapshot. The initial web and private economy
configurations keep both flags off and register no Cron. Before enabling them,
confirm Workers Paid, all five remote app migrations, D1 usage/cost and capacity
monitoring, replacement of the current non-incremental active-Auction crawl with
a reviewed incremental or compacted ingestion design, exactly one
reviewed production trigger on `skypilot-economy`, and the first complete
publication. Disabled or pre-first-publish routes return a safe unavailable
response rather than crawling Hypixel or substituting fixtures.

## Optional AI

### `POST /api/ai`

Request:

```json
{
  "question": "What should I upgrade next?",
  "mode": "beginner",
  "context": {
    "source": "player",
    "username": "ExamplePlayer",
    "profileId": "0123456789abcdef0123456789abcdef",
    "budget": 50000000,
    "goals": ["progression"],
    "economyProductIds": ["BOOSTER_COOKIE"]
  }
}
```

- `question`: 3-1,200 characters;
- `mode`: `beginner`, `normal`, or `advanced`; invalid/missing values become `normal`;
- `context.source`: `none`, `demo`, or `player`; a player source accepts only a username and optional profile selector;
- `context`: may also include a bounded budget, up to five goal categories, up to eight Bazaar product IDs, and one validated Farming/Garden/Pet/Minion/Dungeon/Slayer calculator scenario. The server resolves profile and market facts; client-supplied facts/prices are rejected.

Requires `ENABLE_AI_ASSISTANT=true`, `OPENAI_API_KEY`, and an explicit request
`Origin` exactly matching the API URL. When native account auth is enabled, a
verified identity is also required. The route resolves selected profile,
progression/roadmap, non-stale Bazaar, and deterministic calculator context; it
uses a 25-second timeout, `store: false`, strict structured output, and
post-validation that rejects uncited/conflicting numeric claims. Its limiter is
in-memory per runtime and is not a distributed production abuse control.

Successful responses include the validated answer, cited server evidence, assumptions, missing data, category, and a bounded context summary. Hour/day metric buckets persist aggregate counts, failures, tokens, configured cost estimates, latency, model, and category only—never prompts, answers, users, profiles, or IPs.

## Authenticated saved state

Saved-state APIs require `ENABLE_ACCOUNT_AUTH=true`, a cryptographically
verified native identity, the D1 `DB` binding, and all five migrations. The
initial deployment keeps them disabled because optional public sign-in/session
behavior is unresolved. Reads/writes are private/no-store; mutations require an
explicit exact Origin. Owner IDs come only from verified identity.

### `GET /api/saved-state`

Returns the signed-in owner's linked Minecraft accounts, saved profile links, saved builds, favorites, and normalized site preferences. Merely reading does not create a canonical SkyPilot user.

### `POST /api/saved-profiles`

Accepts a bounded Minecraft username plus profile ID and optional
alias/pinned/primary choices. Native mode performs the ordinary current
KV/admission-backed lookup before linking. The legacy browser-gateway rollback
mode instead requires its ten-minute signed receipt. Only bounded identity and
profile-link metadata are persisted under the authenticated owner.

The legacy receipt is not account authentication, Minecraft ownership proof,
or permission to access another owner's state. It may be reused until expiry,
so the route accepts it only with verified identity and the exact-origin
mutation check. Missing, expired, tampered, or mismatched receipts fail in that
mode. Saving a link never schedules player refreshes.

### `PATCH|DELETE /api/saved-profiles/<profile-id>`

Updates the owner's alias/pinned state or removes the saved link. A differently owned or absent ID returns the same safe not-found response.

### `PATCH|DELETE /api/saved-accounts/<account-id>`

Updates the owner's label/primary choice or unlinks that Minecraft account and its owned saved-profile links.

### `GET|PATCH|DELETE /api/preferences`

Reads, replaces, or resets bounded site preferences such as default player, planning budget/focus, and compact account view.

### `GET|POST|DELETE /api/favorites`

Lists, adds/upserts, or removes an owner-scoped favorite for a supported tool, recommendation, profile, or accessible build. The API verifies that saved/profile/build targets are readable by the caller.

### `GET|POST /api/builds` and `GET|PATCH|DELETE /api/builds/<build-id>`

Provide owner-scoped build CRUD for bounded manual armor, weapon/tool, equipment, pet, accessory/power, and note fields. Builds may link only to an owned saved profile. Visibility is explicit: private has no public URL, unlisted is readable only by its unguessable slug, and public is also eligible for the gallery. Updating can rotate a share slug so the old URL stops working.

### `GET /api/builds/public` and `GET /api/builds/shared/<share-slug>`

Return bounded public gallery entries or one non-private shared build, respectively. Owner identity and linked private profile details are omitted. Build sharing is available only when the trusted account/storage feature is enabled.

## Authenticated goals

Goal APIs require `ENABLE_ACCOUNT_AUTH=true`, verified native identity, an
active D1 `DB` binding, applied migrations, and an explicit exact Origin for
every mutation.

### `GET /api/goals?status=<active|paused|completed|archived>`

Returns up to 100 goals owned by the canonical SkyPilot user.

### `POST /api/goals`

```json
{
  "title": "Farming 60",
  "current": 55,
  "target": 60,
  "unit": "level",
  "cadence": "once"
}
```

`cadence` may be `once`, `daily`, or `weekly`. The target must exceed the current value.

### `GET /api/goals/<goal-id>`

Returns one owner-scoped goal. A valid authenticated user receives `404` for an absent or differently owned ID.

### `PATCH /api/goals/<goal-id>`

Field update example:

```json
{
  "action": "update",
  "title": "Farming 60",
  "current": 57,
  "target": 60,
  "unit": "level",
  "cadence": "once"
}
```

Lifecycle actions accept exactly one of `complete`, `pause`, `resume`, or `reset`. Daily/weekly reset starts the next cycle only after a deliberate request.

### `DELETE /api/goals/<goal-id>`

Permanently deletes the owner-scoped goal.

## Authenticated account deletion

### `DELETE /api/account`

Requires enabled verified native identity and an explicit exact Origin. It
deletes the canonical SkyPilot application user found by provider plus subject.
Owned links, preferences, goals, recommendation state, builds, and favorites
cascade; retained operational/audit records lose user attribution. It does not
delete the external identity-provider account or shared Minecraft/profile
facts. An already-absent account returns a safe idempotent result.

## Allowlisted administration

### `GET /api/admin/ai-metrics`

Requires a verified native identity in `ADMIN_USER_IDS`. Returns
private/no-store aggregate AI summaries for the last 24 hours and 30 days. It
never returns prompts, answers, player selectors, user IDs, or IPs.

### `POST /api/admin/actions`

Requires a verified native identity whose subject appears in `ADMIN_USER_IDS`,
plus an explicit exact request Origin.

Allowed action payloads:

```json
{ "action": "refresh-economy" }
```

`refresh-economy` does not execute ingestion in the web Worker. It forwards one
fixed `POST /internal/economy/refresh` request through the environment-matched
`ECONOMY_SERVICE` binding to the private economy Worker. That Worker accepts no
other public path and returns `economy_disabled` while its feature flag is off.
When deliberately activated, the same D1 lease, fencing token, and durable
backoff remain authoritative. No arbitrary job name, cache prefix, endpoint,
URL, or SQL is accepted; targeted cache invalidation is not implemented.

## Caching and retries

- Player/profile: one-hour fresh cache, up to 24 hours stale-on-error.
- Minecraft username identity: 24-hour fresh cache, up to seven days
  stale-on-error. The cache stores only the latest normalized username/UUID
  mapping, regardless of which approved resolver supplied it; it stores no raw
  PlayerDB response, avatar, metadata, or lookup history.
- Published Bazaar/active-Auction snapshots: five-minute freshness marker; product responses use a 30-second public cache.
- Published ended-sale feed: three-minute freshness marker; retained sale rows are bounded by worker policy.

Native player/Minecraft provider values use environment-isolated Workers KV
plus a bounded per-isolate L0 cache. Cross-request I/O Promise single-flight was
removed; Hypixel header backoff remains local to an isolate. Cloudflare rate
bindings are coarse per-location abuse filters: `PLAYER_ACTOR_LIMITER` protects
the player routes, while `PLAYER_GLOBAL_LIMITER` runs only before an actual
authenticated Hypixel transport. Mojang calls do not spend Hypixel quota. The
`provider_request_budgets` reservation in the shared `PROVIDER_BUDGET_DB` is the
globally consistent fixed-window guard for the shared Hypixel key; each admitted
analysis reserves two tokens and fails closed if D1 admission is unavailable.
Economy lease/fencing/backoff/feed state is durable in D1 and writable only by
the private economy Worker when the feature is deliberately activated. Clients
must honor HTTP status and `Retry-After`; they must not retry tightly or supply
additional keys.
