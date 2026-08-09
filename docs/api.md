# Product API Reference

All APIs are product-specific; SkyPilot does not expose a raw or unrestricted Hypixel proxy. Successful responses generally use `{ "data": ... }`. Failures use a safe `{ "error": { "code", "message", "action?", "retryAfterSeconds?" } }` envelope and never include upstream response bodies or secrets.

## Public reads

### `GET /api/health`

Reports local configuration, cache counters, and Hypixel backoff state without probing upstream services. Returns HTTP 503 when authenticated Hypixel access is not configured even though public economy/Minecraft dependencies may remain available; inspect the JSON dependency fields rather than treating it as a universal outage.

### `GET /api/player?username=<name>&profile=<profile-id>`

### `GET /api/player/<username>?profile=<profile-id>`

Validates a Java Minecraft username, resolves its current UUID through Minecraft Services, fetches the Hypixel player and available SkyBlock profiles, normalizes only the requested member’s supported fields, and returns a deterministic analysis. `profile` is optional.

Requires `HYPIXEL_API_KEY`. Responses are `no-store`; the server provider still shares its bounded request cache. Common failures include invalid input, player/profile not found, no profiles, missing credentials, rate limit, timeout, and upstream invalid/unavailable response.

### `GET /api/economy/bazaar?q=<term>&limit=<1..250>`

Returns normalized public Bazaar quick-status fields, cache/source timestamps, product counts, safely skipped records, and a non-guarantee notice. Default limit: 100. The route returns public short-cache headers.

### `GET /api/economy/auctions?page=<0..10000>&q=<term>&limit=<1..250>`

Returns one bounded normalized active-auction page. `q` filters item names on that fetched page; it is not a global full-snapshot search. Default page: 0; default limit: 100. Seller, bidder, profile, lore, and raw item payloads are omitted.

### `GET /api/economy/auctions/ended?limit=<1..500>`

Returns a bounded latest ended-auction feed sorted by end time. Buyer, seller, profile, and raw item data are omitted. Default limit: 100.

## Optional AI

### `POST /api/ai`

Request:

```json
{
  "question": "What should I upgrade next?",
  "mode": "beginner",
  "context": {}
}
```

- `question`: 3–1,200 characters;
- `mode`: `beginner`, `normal`, or `advanced`; invalid/missing values become `normal`;
- `context`: optional structured object, serialized and bounded before sending upstream.

Requires `OPENAI_API_KEY`. The route uses a 25-second timeout, `store: false`, bounded output, and an in-memory per-runtime short window of eight requests per client key per minute. This limiter is not a distributed production abuse-control system.

## Authenticated goals

### `GET /api/goals`

Requires verified Sites/ChatGPT identity headers and an active D1 `DB` binding with migrations applied. Returns goals owned by the canonical SkyPilot user.

### `POST /api/goals`

Request:

```json
{
  "title": "Farming 60",
  "current": 55,
  "target": 60,
  "unit": "level",
  "cadence": "once"
}
```

`cadence` may be `once`, `daily`, or `weekly`. The target must exceed the current value. The current route creates a goal plus four generic milestone steps. Update/delete/completion/reset APIs are not yet implemented.

## Allowlisted administration

### `POST /api/admin/actions`

Requires a verified Sites/ChatGPT identity whose user ID appears in `ADMIN_USER_IDS`.

Allowed action payloads:

```json
{ "action": "refresh-bazaar" }
```

```json
{ "action": "refresh-ended-auctions" }
```

```json
{ "action": "clear-economy-cache" }
```

The first two invoke bounded worker functions without a persistent sink; the third clears only economy keys in the current runtime’s memory cache. No arbitrary job name, cache prefix, endpoint, or SQL is accepted.

## Caching and retries

- Player/profile: one-hour fresh cache, up to 24 hours stale-on-error.
- Bazaar/active auctions: 60-second fresh cache, up to five minutes stale-on-error.
- Ended auctions: 55-second fresh cache, up to five minutes stale-on-error.
- Minecraft username identity: 24-hour fresh cache, up to seven days stale-on-error.

These caches and rate states are per runtime today. Clients must honor HTTP status and `Retry-After`; they must not retry tightly or supply additional keys.
