# Product API Reference

All APIs are product-specific; SkyPilot does not expose a raw or unrestricted Hypixel proxy. Successful responses generally use `{ "data": ... }`. Failures use a safe `{ "error": { "code", "message", "action?", "retryAfterSeconds?" } }` envelope and never include upstream response bodies, database details, or secrets.

## Public reads

### `GET /api/health`

Reports local configuration, cache counters, and Hypixel backoff state without probing upstream services. It is a web-process liveness endpoint; inspect its JSON dependency fields rather than treating an intentionally disabled optional integration as a universal outage.

### `GET /api/player?username=<name>&profile=<profile-id>`

### `GET /api/player/<username>?profile=<profile-id>`

Validates a Java Minecraft username, resolves its UUID through Minecraft Services, fetches the Hypixel player and available SkyBlock profiles, normalizes only the requested member's supported fields, and returns deterministic analysis. `profile` is optional.

Requires `ENABLE_PLAYER_LOOKUP=true` and `HYPIXEL_API_KEY`. Responses are `no-store`; the server provider still shares its bounded request cache. Common failures include invalid input, player/profile not found, no profiles, missing credentials, rate limit, timeout, and upstream invalid/unavailable response.

### `GET /api/economy/bazaar?q=<term>&limit=<1..250>`

Reads the latest published D1 snapshot and returns normalized Bazaar summary fields, source/publish timestamps, product counts, safely skipped records, and a non-guarantee notice. `q` filters the snapshot by product ID. Default limit: 100. The route uses a short public response cache and never calls Hypixel.

### `GET /api/economy/bazaar/history?product=<id>&resolution=<hour|day>&limit=<count>`

Reads worker-built OHLC/average-volume buckets for one canonical Bazaar product. Hour buckets retain up to 90 days and day buckets up to three years; route limits cannot exceed those windows. The response names its canonical product identity, aggregation progress, source/aggregation timestamps, points, deterministic movement summary, and methodology notice. These are Hypixel summary-price observations—not exact trades, guaranteed quotes, or item valuation evidence.

### `GET /api/economy/auctions?page=<0..10000>&q=<term>&limit=<1..250>`

Reads one bounded page from the latest complete D1 active-Auction snapshot. `q` filters item names across that snapshot before counting and pagination. Default page: 0; default limit: 100. Seller, bidder, profile, lore, and raw item payloads are omitted.

### `GET /api/economy/auctions/ended?limit=<1..500>`

Returns a bounded retained ended-sale feed from D1, sorted by end time. Buyer, seller, profile, and raw item data are omitted. Default limit: 100.

All economy reads require `ENABLE_PUBLIC_ECONOMY=true` and a published worker snapshot. Before the first publish they return a retryable unavailable response rather than calling upstream from a request.

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

Requires `ENABLE_AI_ASSISTANT=true`, `OPENAI_API_KEY`, and an explicit request `Origin` exactly matching the API URL. When Sites auth is enabled, a verified identity is also required. The route resolves selected profile, progression/roadmap, non-stale Bazaar, and deterministic calculator context; it uses a 25-second timeout, `store: false`, strict structured output, and post-validation that rejects uncited/conflicting numeric claims. Its eight-request-per-minute limiter is in-memory per runtime and is not a distributed production abuse-control system.

Successful responses include the validated answer, cited server evidence, assumptions, missing data, category, and a bounded context summary. Hour/day metric buckets persist aggregate counts, failures, tokens, configured cost estimates, latency, model, and category only—never prompts, answers, users, profiles, or IPs.

## Authenticated saved state

Saved-state APIs require `ENABLE_CHATGPT_AUTH=true`, trusted Sites/ChatGPT identity, the D1 `DB` binding, and all four migrations. Reads and writes are private/no-store; every mutation also requires an explicit exact request Origin. Owner IDs are derived from authentication and cannot be supplied in request JSON.

### `GET /api/saved-state`

Returns the signed-in owner's linked Minecraft accounts, saved profile links, saved builds, favorites, and normalized site preferences. Merely reading does not create a canonical SkyPilot user.

### `POST /api/saved-profiles`

Accepts a bounded Minecraft username plus profile ID and optional alias/pinned/primary choices. Before linking, the server performs the ordinary request-driven current profile lookup and confirms that the selected profile belongs to that Minecraft account. Saving a link never schedules player refreshes.

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

Goal APIs require `ENABLE_CHATGPT_AUTH=true`, verified Sites/ChatGPT identity headers, an active D1 `DB` binding, applied migrations, and an explicit exact Origin for every mutation.

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

Requires enabled trusted Sites/ChatGPT identity and an explicit exact request Origin. It deletes the canonical SkyPilot application user found by provider plus provider subject. Owned links, preferences, goals, recommendation state, builds, and favorites cascade; retained operational/audit records lose the canonical user reference. It does not delete the ChatGPT account or shared Minecraft/profile facts. An already-absent account returns a safe idempotent result.

## Allowlisted administration

### `GET /api/admin/ai-metrics`

Requires verified Sites/ChatGPT identity in `ADMIN_USER_IDS`. Returns private/no-store aggregate AI summaries for the last 24 hours and 30 days: request/failure counts, tokens, configured cost estimates, average/maximum latency, and categories. It never returns prompts, answers, player selectors, user IDs, or IPs.

### `POST /api/admin/actions`

Requires a verified Sites/ChatGPT identity whose user ID appears in `ADMIN_USER_IDS`, plus an explicit exact request Origin.

Allowed action payloads:

```json
{ "action": "refresh-economy" }
```

```json
{ "action": "clear-economy-cache" }
```

`refresh-economy` asks the same D1-elected, lease-fenced worker cycle to refresh ended sales, Bazaar, and the complete active-Auction snapshot. Existing leases and global backoff remain authoritative. Cache invalidation clears only economy keys in the current runtime. No arbitrary job name, cache prefix, endpoint, or SQL is accepted.

## Caching and retries

- Player/profile: one-hour fresh cache, up to 24 hours stale-on-error.
- Minecraft username identity: 24-hour fresh cache, up to seven days stale-on-error.
- Published Bazaar/active-Auction snapshots: five-minute freshness marker; product responses use a 30-second public cache.
- Published ended-sale feed: three-minute freshness marker; retained sale rows are bounded by worker policy.

Player/Minecraft caches and provider rate state are per runtime today. The public-economy worker lease, fencing token, backoff, feed markers, and snapshots are durable in D1. Clients must honor HTTP status and `Retry-After`; they must not retry tightly or supply additional keys.
