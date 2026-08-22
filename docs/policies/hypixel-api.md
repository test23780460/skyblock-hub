# Hypixel Public API policy and SkyPilot implementation rules

**Reviewed:** 2026-08-08  
**Current Hypixel API Policy page:** last updated 2026-07-16  
**Applies to:** SkyPilot web app, API, workers, scheduled jobs, caches, databases, admin tooling, and future companion clients

This is an engineering compliance guide, not legal advice. Hypixel says its policies can change and developers are responsible for staying current. Re-check the live policy before every production launch, before enabling monetization, and at least quarterly.

## Official sources

- [Hypixel API Policy](https://developer.hypixel.net/policies/) — primary policy source
- [Hypixel Public API v2 reference](https://api.hypixel.net/) — authentication, rate-limit headers, endpoint contracts, and response codes
- [Hypixel Developer Dashboard](https://developer.hypixel.net/) and [application registration](https://developer.hypixel.net/create/) — key and application types
- [Hypixel Terms of Service](https://hypixel.net/terms) — incorporated by the API Policy
- [Hypixel Server Rules](https://support.hypixel.net/hc/en-us/articles/4427624493330-Hypixel-Server-Rules) — game-integrity and unfair-advantage context

If this document and a current official source disagree, the current official source wins.

## Executive decision for SkyPilot

SkyPilot is supportable under the current policy when it is a request-driven, unofficial analytics product that caches authenticated player data, ingests public economy feeds at respectful intervals, and returns its own user-facing views and derived insights.

SkyPilot must not become any of the following:

- a continuous player-profile or session tracker;
- a bulk collector of authenticated player data;
- a raw Hypixel API proxy, mirror, or data-download service for other developers;
- a system that rotates keys, applications, or IP addresses to evade limits;
- an official-looking Hypixel product or a product that uses Hypixel branding as its own;
- a gameplay automation, nick de-anonymization, gambling, or unfair-advantage service.

## Authentication, registration, and secret handling

The [API reference](https://api.hypixel.net/) defines authenticated access as an API key sent in the HTTP request header named exactly:

```http
API-Key: <server-side-secret>
```

Implementation requirements:

1. Send the key only from a trusted SkyPilot server or worker. Never send it to a browser, mobile client, mod, or other third party.
2. Never put the key in a URL, query string, source file, fixture, client-side environment variable, telemetry field, error message, screenshot, or log.
3. Load it from a server-only secret provider. `HYPIXEL_API_KEY` may appear as an empty name in `.env.example`; the value must never be committed.
4. Redact `API-Key` case-insensitively in HTTP tracing, exception capture, request dumps, and admin tooling.
5. Treat any key pasted into chat, an issue, a log, or a commit as exposed. Revoke/rotate it in the Developer Dashboard before using the integration.
6. Do not ask users to supply their own Hypixel keys. The policy prohibits sharing keys with third parties and prohibits using multiple keys to bypass an application's limit.
7. Register SkyPilot as its own application for every authenticated endpoint. A public website should use an approved **Production** application before launch; the registration page says production applications are intended for a large public user base and may request a justified increase.
8. A web frontend, API, and worker may use the same application when they are parts of the same SkyPilot service and share the same backend. A materially separate product needs its own application.
9. Do not rely on short-lived developer keys for production. The policy warns that developer keys may expire sooner under sustained use and that extreme long-term use may be treated as abuse.
10. Monitor application activity. Hypixel currently considers an application inactive if it has made no request within 14 days of creation or no requests during a 28-day period.

If the hosting layer cannot keep the key server-side, cannot reliably redact it, or exposes it through browser-accessible configuration, authenticated Hypixel calls must run in a separate secure backend.

## Rate limits and request control

The [API reference](https://api.hypixel.net/) says key limits depend on application type and describes a maximum number of requests over five-minute intervals. It also documents per-response headers in minute terms:

| Header | Official meaning |
| --- | --- |
| `RateLimit-Limit` | Request limit for the provided key for the current minute |
| `RateLimit-Remaining` | Requests remaining for the current minute |
| `RateLimit-Reset` | Seconds until the next minute/reset |

Because the official overview describes both a five-minute maximum and minute-oriented response headers, SkyPilot must not assume one fixed quota model. The live headers and actual Developer Dashboard allocation are authoritative for runtime behavior.

SkyPilot's Hypixel transport must:

- route every authenticated request through one server-only provider
  composition with shared normalized cache/admission; public economy feeds stay
  in their separate keyless worker path;
- record the three rate-limit headers as metrics without logging the key or full user payload;
- reserve headroom for interactive requests instead of consuming the full advertised limit with background work;
- stop dispatching when `RateLimit-Remaining` reaches zero and wait at least `RateLimit-Reset` seconds;
- reuse an invocation-local result when the same bounded operation asks for it,
  but never retain request-bound I/O promises in module-global state across
  Worker requests; use KV plus admission to bound duplicate cold misses;
- queue bounded work instead of spawning unbounded parallel requests;
- treat HTTP `429` as a hard signal to pause, use reset-aware exponential backoff with jitter, and surface a friendly stale-data/rate-limit state;
- remember that the reference says `429` can also be caused by a global throttle, not only the application's key limit;
- back off on `503` from public SkyBlock economy endpoints rather than retrying in a tight loop;
- never add another key, application, account, proxy, or IP address to get around a limit.

Rate-limit increases must be requested through the production application with a truthful capacity justification. They must not be treated as a way to fetch public/no-key data faster than its natural update cadence.

## Player/profile polling and caching

The [API Policy](https://developer.hypixel.net/policies/) prohibits automated collection of player data at scale. It specifically disallows continuously polling player data to calculate stat changes or provide either long-term history or temporary "session tracking," even when a user initiates that tracking. It also prohibits projects whose sole purpose is tracking selected players.

Accordingly, SkyPilot player data is **request-driven only**:

- A user search, profile page navigation, or explicit analysis action may request data after the shared cache expires.
- A dashboard view must not start an interval that repeatedly refreshes the player.
- Saved players, saved goals, public profile pages, alerts, recommendation jobs, and account login must not schedule profile refreshes.
- A "Refresh" button may invalidate only presentation state. It must still honor the server-side shared TTL and must not guarantee a new upstream request.
- Cache entries must be shared by normalized UUID/profile ID across all users, not scoped per viewer.
- Repeated snapshots must not be appended to create a stat timeline. Replace the latest cache value.
- Recommendation history may store user actions such as completed/ignored/remind-later. It must not silently become a history of Hypixel stat snapshots.
- The UI must show `fetchedAt`, label stale data, and explain that refreshes are intentionally limited.

Hypixel does not publish one universal cache TTL. Its policy says developers should cache to the best of their ability and gives an example where player-related values can be cached for hours or days. The following are conservative SkyPilot operating defaults, not Hypixel-granted entitlements:

| Data class | Upstream trigger | SkyPilot cache/ingestion baseline | Persistence rule |
| --- | --- | --- | --- |
| `/v2/player`, `/v2/skyblock/profiles`, `/profile`, `/museum`, `/garden` | User request only | Shared 60-minute fresh TTL; 5-minute negative cache; optionally serve the last success for up to 24 hours during an outage with a visible stale label | Keep one latest raw snapshot only; overwrite it; no automatic time series |
| SkyBlock resource endpoints such as items, skills, and collections | Scheduled or first use | 6–24 hours; skip processing when `lastUpdated` is unchanged | Keep the current normalized resource version; retain old versions only for schema/debug purposes with a bounded policy |
| `/v2/skyblock/bazaar` | One global economy worker | Start at once per 60 seconds with jitter; slow down on unchanged data, errors, or throttling | Raw snapshot no more than 24 hours; normalized hourly/daily aggregates may be retained for product analytics |
| `/v2/skyblock/auctions` | One global economy worker | Check page 0 about once per 60 seconds; fetch the page set only when `lastUpdated` changes | Retain current normalized listings; expire raw pages after the ingestion cycle and active listings after they end |
| `/v2/skyblock/auctions_ended` | One global economy worker | One request approximately every 55–60 seconds with jitter; deduplicate by auction ID | Keep only fields needed for valuation; discard buyer/seller UUIDs unless a documented feature genuinely needs them |

Any throttle, updated policy, or Developer Dashboard instruction overrides these defaults. Intervals should become slower under load, never faster to compensate for failures.

### Guild exception is not a production-profile loophole

The policy has a narrow exception for guild activity tracking: it suggests no more than one request per player per hour, prefers less frequent calls, allows only a personal application owned by the guild owner, and does not grant production applications or increased limits for that purpose. SkyPilot must keep public guild activity/session tracking disabled unless Hypixel explicitly approves a compliant separate design. This exception does not authorize player history elsewhere in SkyPilot.

## Data retention and privacy guardrails

The current API Policy does **not** specify a numeric maximum retention period for API responses. That silence does not override the bans on continuous player polling, targeted player tracking, proxying, or unfair use.

SkyPilot must apply these retention rules:

1. **Authenticated player data:** maintain only the latest cached snapshot, plus at most a short outage copy. Do not append periodic or user-triggered snapshots into a historical profile table.
2. **Derived profile results:** overwrite current net-worth estimates, recommendation inputs, and progression summaries. Persist user-created goals and explicit recommendation actions separately from raw Hypixel state.
3. **Public economy data:** normalize only what is needed for charts, valuations, and aggregate insights. Raw Bazaar snapshots should be short-lived; raw auction pages should be deleted after ingestion. Longer-lived data should be transformed sale records or aggregates, not a raw API mirror.
4. **Identifiers:** do not retain auction buyer/seller UUIDs for price research when auction ID, item attributes, timestamp, and price are sufficient. Do not build player-facing buyer/seller dossiers.
5. **Logs:** never log raw NBT/inventory payloads, full profile responses, authentication headers, or credentials. Use endpoint name, status, latency, cache outcome, and coarse error category.
6. **Deletion:** run TTL cleanup jobs and support deletion of SkyPilot account-linked cached/derived data. Cache deletion must not immediately refetch the player unless a new user request arrives after the TTL rules permit it.
7. **Access:** raw API caches and ingestion tables are internal service data, not public downloads. Limit staff/admin access and audit it.

These are minimum SkyPilot controls. Separate privacy-law and user-consent requirements may demand shorter retention.

### Third-party username resolution

Both official Minecraft username hosts currently fail from native Cloudflare
Worker egress. Source includes a conditional PlayerDB fallback, but it is not a
license to monitor players or expand collection. It may run only for a
user-triggered lookup after both official resolvers fail for transport/access;
an authoritative not-found response stops resolution. Application code should
supply only the normalized requested username and SkyPilot's identifying service user agent. Application
code must not copy browser cookies, authentication, profile selectors, or the
Hypixel key. Cloudflare may add network headers, including visitor-IP metadata
depending on destination routing; disclose and revalidate that behavior. Cache
only the latest strictly validated username/UUID mapping,
discard raw response/avatar/metadata, and require the UUID and display name to match Hypixel's
authenticated player response. Review the [PlayerDB API](https://playerdb.co/)
and [Nodecraft privacy policy](https://nodecraft.com/legal/privacy-policy) before
activation. Focused tests and the public privacy disclosure pass; keep the
fallback off until staging egress verification passes.

## Redistribution and proxying

The [API Policy](https://developer.hypixel.net/policies/) says an application may not be created for the purpose of proxying the Public API to third-party developers.

Allowed SkyPilot pattern:

```text
Hypixel API -> private SkyPilot transport/cache -> SkyPilot analysis/view model -> SkyPilot user interface
```

Disallowed patterns:

```text
Hypixel API -> /api/hypixel/* raw passthrough -> arbitrary clients
Hypixel API -> downloadable raw profile/auction dumps -> third-party developers
SkyPilot key -> browser/mod/customer-supplied request
```

The backend-for-frontend must authenticate or origin-limit internal calls as appropriate, return only fields required by the SkyPilot feature, and prefer derived/transformative results. Do not preserve upstream route names and response bodies as a general-purpose public mirror. If SkyPilot later offers a developer API, it must expose SkyPilot-created aggregates or analyses under a separately reviewed policy design, not raw or near-raw Hypixel responses.

## Branding, independence, and monetization

The [API Policy](https://developer.hypixel.net/policies/) requires projects not to infringe Hypixel trademarks/branding and to make clear that they are neither affiliated with nor endorsed by Hypixel.

SkyPilot should therefore:

- use **SkyPilot** as the product name and its own logo, colors, domain, and visual identity;
- use "Hypixel SkyBlock" only descriptively where necessary, not as SkyPilot's source-identifying brand;
- avoid Hypixel logos, official-looking badges, copied site trade dress, or claims such as "official" or "partner" without written permission;
- display a persistent footer/about disclaimer such as: **"SkyPilot is an independent project and is not affiliated with or endorsed by Hypixel Inc."**;
- distinguish SkyPilot estimates and scores from official Hypixel stats;
- contact [Hypixel Support](https://support.hypixel.net/) before any branding or commercial use that is unclear.

Monetization is allowed by the current API Policy only when SkyPilot is registered as a **Production** application. The policy additionally requires:

- a free tier available to every user; advertising may appear in that tier;
- API-derived content behind a paywall to be transformative through new information, presentation, insights, or understanding;
- no betting or gambling;
- no currencies that cannot be exchanged back to fiat;
- no pricing that gouges players or is unfair.

The policy lists advertisements, donations, subscriptions, and crowdfunding as acceptable models. A safe product split keeps core player lookup and basic public economy access free, while any paid tier sells SkyPilot-created convenience or analysis rather than access to raw Hypixel data. Obtain Hypixel Support guidance before enabling an ambiguous model.

## Game integrity

SkyPilot may analyze, explain, plan, compare, estimate, and alert from permitted data. It must not:

- control the Minecraft client or automate gameplay;
- provide macros, scripts, exploits, or prohibited unfair advantages;
- encourage rule-breaking;
- identify a nicked player's real account;
- profile or target specific players as the product's purpose;
- recreate the Hypixel server or a Hypixel minigame experience.

Economy scores and profit estimates must be labeled estimates, include liquidity/risk, and never claim guaranteed profit. Price alerts may use the public economy pipeline; they must not trigger player-profile polling or gameplay actions.

## SkyBlock endpoint rules

Authorization below follows the current [API reference](https://api.hypixel.net/): endpoints that show an `ApiKey` authorization require the `API-Key` header; the public economy/resource operations are documented without that authorization.

| Endpoint | Official contract relevant to SkyPilot | SkyPilot use |
| --- | --- | --- |
| [`GET /v2/player`](https://api.hypixel.net/v2/player) | Authenticated; player UUID query; `403` for invalid key and `429` for key/global throttle | Request-driven identity/stats support only; shared cache; no polling |
| [`GET /v2/skyblock/profiles`](https://api.hypixel.net/v2/skyblock/profiles) | Authenticated; all SkyBlock profiles for a player UUID; response can reflect the player's in-game API settings | Main user-requested lookup; do not infer hidden/disabled data or track changes |
| [`GET /v2/skyblock/profile`](https://api.hypixel.net/v2/skyblock/profile) | Authenticated; one profile UUID; response can reflect in-game API settings | Request-driven selected-profile refresh only |
| [`GET /v2/skyblock/museum`](https://api.hypixel.net/v2/skyblock/museum) | Authenticated; profile ID; data can depend on player API settings | Fetch with the same request-driven cache policy, not a worker schedule |
| [`GET /v2/skyblock/garden`](https://api.hypixel.net/v2/skyblock/garden) | Authenticated; profile ID; documents `403`, `404`, `422`, and `429` | Fetch with the selected profile analysis and cache it |
| [`GET /v2/skyblock/auction`](https://api.hypixel.net/v2/skyblock/auction) | Authenticated; exactly one of auction UUID, player UUID, or profile UUID per request | Targeted interactive lookup only; never call once per ended auction or use it to track a player's activity |
| [`GET /v2/skyblock/auctions`](https://api.hypixel.net/v2/skyblock/auctions) | Public; active auctions sorted by last update, paginated from page 0; includes `totalPages` and `lastUpdated`; can return `503` while unpopulated | One global snapshot ingestion cycle; do not let each web request crawl all pages |
| [`GET /v2/skyblock/auctions_ended`](https://api.hypixel.net/v2/skyblock/auctions_ended) | Public; auctions that ended in the last 60 seconds; includes `lastUpdated` | One global minimal sale-ingestion job with deduplication |
| [`GET /v2/skyblock/bazaar`](https://api.hypixel.net/v2/skyblock/bazaar) | Public; each product has top-30 buy/sell summaries and computed `quick_status`; prices are weighted averages of the top 2% of orders by volume and moving-week fields cover seven-day transacted volume plus live state | Global cached feed; do not describe it as exact transaction history or guaranteed executable prices |
| [`GET /v2/resources/skyblock/items`](https://api.hypixel.net/v2/resources/skyblock/items) | Public SkyBlock item resource with `lastUpdated` | Long-lived shared resource cache; validate payloads before use |

### Active-auction ingestion algorithm

1. A single elected worker requests page 0 at the configured interval.
2. If `lastUpdated` matches the completed snapshot, stop.
3. If it changed, use `totalPages` to fetch that snapshot once with bounded concurrency.
4. Require every page to report the same `lastUpdated`. If the dataset changes mid-crawl, discard the partial cycle and retry on the next scheduled interval; do not immediately spin.
5. Upsert by auction UUID, mark the snapshot complete atomically, and expire listings absent from a later complete snapshot.
6. Delete raw page bodies after normalization. Parse NBT as untrusted, size-bounded input.

### Ended-auction ingestion algorithm

1. A single worker calls the public endpoint roughly once per returned 60-second window.
2. Deduplicate idempotently by `auction_id`.
3. Normalize item attributes, timestamp, price, and BIN status needed for valuation.
4. Drop buyer/seller identifiers unless an approved feature needs them.
5. Never fan out authenticated `/v2/skyblock/auction` calls for every sale.

### Bazaar ingestion algorithm

1. One worker fetches the public payload and compares `lastUpdated`.
2. Skip database writes when it is unchanged.
3. Store a short-lived normalized snapshot and produce hourly/daily aggregates.
4. Preserve the API field semantics in code and tests. Do not casually relabel `buyPrice`/`sellPrice` as guaranteed instant-buy/instant-sell execution prices.
5. Show source timestamp, staleness, spread/liquidity methodology, and an estimates-not-guarantees notice.

## Implementation checklist

### Before any authenticated integration

- [ ] Revoke/rotate every credential that has appeared in chat, logs, screenshots, issues, commits, or client bundles.
- [ ] Register SkyPilot as its own application in the Hypixel Developer Dashboard.
- [ ] Obtain Production approval before public launch or monetization.
- [ ] Put the new key only in server-side secret storage.
- [ ] Verify client bundles, source maps, server responses, logs, and error reporting contain no key.
- [ ] Add automated secret scanning and an `API-Key` redaction test.

### Transport and cache

- [ ] Implement one Hypixel HTTP client; prohibit ad hoc direct fetches elsewhere in the codebase.
- [ ] Send authentication only through the `API-Key` header.
- [ ] Add a shared distributed limiter that consumes all three `RateLimit-*` headers.
- [ ] Add reset-aware `429` handling, jittered backoff, bounded retries, and a circuit breaker.
- [ ] Add bounded `503` backoff for public economy endpoints.
- [ ] Add shared cache keys, negative caching, and stale labels; keep any
  in-invocation reuse request-local and never use a module-global cross-request
  I/O Promise map.
- [ ] Reserve rate-limit headroom for user-triggered requests.
- [ ] Add admin metrics for request count, cache hit rate, latency, `403`, `429`, `503`, remaining limit, and reset time without sensitive payloads.

### Player data

- [ ] Confirm there is no cron, queue, login hook, public-profile job, saved-player job, alert job, websocket, or browser interval that fetches player/profile/museum/garden data.
- [ ] Enforce the shared player/profile TTL on the server; a UI refresh cannot bypass it.
- [ ] Keep only the latest raw player/profile snapshot and a bounded stale copy.
- [ ] Prevent schema creation or writes for automatic player stat/session history.
- [ ] Keep recommendation completion history as user actions, not upstream stat snapshots.
- [ ] Respect missing fields and in-game API settings; never manufacture private values.
- [ ] Keep guild activity tracking disabled unless a separately approved design satisfies the personal-application exception.

### Economy data

- [ ] Run one global Bazaar worker, one active-auction worker, and one ended-auction worker across all replicas using a lease/lock.
- [ ] Key ingestion on `lastUpdated`, use bounded concurrency, and deduplicate idempotently.
- [ ] Verify a complete active-auction snapshot is internally consistent before publishing it.
- [ ] Store derived/minimal auction sale fields and discard unneeded player identifiers.
- [ ] Expire raw page payloads and Bazaar snapshots on schedule.
- [ ] Label prices, net worth, flips, and profits as estimates; expose freshness and methodology.
- [ ] Ensure public user/API traffic reads SkyPilot's cache/database and cannot trigger a full upstream crawl.

### Product, API, and branding

- [ ] Use SkyPilot branding and the independent/non-endorsed disclaimer on the home page, footer, about page, and API documentation.
- [ ] Do not use Hypixel marks, logos, official badges, or official-looking trade dress without permission.
- [ ] Do not expose a raw or near-raw Hypixel proxy route or bulk dump.
- [ ] Restrict internal backend-for-frontend routes to SkyPilot clients and return feature-specific view models.
- [ ] Mark every SkyPilot-created progression score, valuation, and recommendation as unofficial/estimated where relevant.
- [ ] Verify no feature automates gameplay, de-anonymizes nicked players, enables gambling, or creates an unfair advantage.

### Monetization and ongoing review

- [ ] Keep a meaningful free tier for all users.
- [ ] Put only genuinely transformative SkyPilot-created value behind a paywall.
- [ ] Use only policy-listed or otherwise approved monetization models; no gambling or prohibited currency model.
- [ ] Ask Hypixel Support before enabling any unclear branding or monetization design.
- [ ] Review the live API Policy before each production release and at least quarterly; record the reviewed date and policy `Last updated` date here.
- [ ] Re-run this checklist after any Hypixel policy, endpoint, worker cadence, caching, public-profile, alerting, developer-API, or monetization change.

## Conflicts and constraints from the master build specification

The master specification is directionally aligned with the current policy because it already says player/profile data should be request-driven and distinguishes it from public economy/resource data. The following requirements need strict interpretation:

- **Player history:** an automated Hypixel stat history or temporary session tracker cannot be built. Only the latest cached profile and explicit SkyPilot user actions may be retained.
- **Public profiles and saved players:** these pages may display cached/request-driven current data, but they cannot cause scheduled refreshes or become tracking pages.
- **Recommendation recalculation and goals:** recalculate from the shared current cache on a user action; do not poll in the background to detect completion.
- **Price alerts:** schedule from the public Bazaar/auction economy pipeline only. They must not refresh a player's profile or automate a trade.
- **Auction history and valuation:** build transformed, minimal price/sale records from public economy endpoints. Do not expose raw dumps or create buyer/seller tracking.
- **Guild tools:** general stats can remain request-driven, but automated guild activity tracking is not compatible with a public Production application under the stated exception. Keep it disabled unless Hypixel gives specific approval.
- **Developer/public API:** any future SkyPilot API must serve SkyPilot-derived insights or aggregates, not act as a Hypixel API proxy.
- **Monetization:** ads, premium, or subscriptions cannot be enabled until the Hypixel application is approved for Production, a free tier exists, and paid API-derived features are transformative.
- **ChatGPT Sites or another shared host:** authenticated calls require a backend capable of keeping and redacting the secret. If the site runtime cannot guarantee this, move the Hypixel transport to the isolated server/worker rather than shipping the key to the frontend.

The credential activation step is currently unsafe if the only available key is one that has been disclosed outside secret storage. Rotation is required before live authenticated API testing or deployment; development should continue with fixtures and a missing-credential state meanwhile.
