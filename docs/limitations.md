# Known Limitations

This is the honest pre-release status. Architecture, schema, feature maps, or tested engines are not described as complete user-facing systems unless they are wired end to end.

## External activation not performed

- No public production launch, custom domain, or external-host deployment is claimed. An earlier safe-default build is available as an [owner-only Sites preview](https://skypilot-skyblock.tratv.chatgpt.site); it does not contain the current uncommitted workspace delta.
- The private player gateway code/configuration exists, but a production claim requires both replacement Worker secrets, Sites signing configuration, and a successful deployed end-to-end lookup. Any previously exposed credential must be replaced, not reused. OpenAI remains separately optional.
- Production D1, all four migrations, backup/restore, the economy schedule, domain, and observability are not activated for the current source.
- Sites/ChatGPT auth and the administrator allowlist require deployment configuration.

## Player analysis

- Live lookup supports normalized identity, profile choice, several core stats/skills, bounded item-container summaries, detected gear/accessory identities, limited progression analysis, and deterministic recommendation services.
- Minecraft username resolution is an independently activated upstream integration. SkyPilot uses a bounded authenticated Hypixel name fallback only after transport failure, and player forms also accept a dashed or undashed Java UUID. Hypixel's published player schema emphasizes UUID input, so the explicit UUID path remains the reliable workaround if name fallback behavior changes.
- The fixed-budget base64/gzip/NBT boundary safely summarizes five supported containers and classifies hidden/malformed/oversized/unsupported inputs. Raw blobs, NBT trees, lore, and unsupported fields are discarded before shared caching.
- Full modifier-aware gear analysis, pets, additional storage, Museum, Bestiary, Rift, Minion, Garden, and deep Dungeon analysis are not wired to live responses.
- Estimated net worth and item valuation engines exist and are tested, but complete asset coverage and current/historical price evidence are not joined, so net worth remains unavailable rather than fabricated.
- Dashboard recommendation Complete/Ignore/Remind Later actions are client-memory only; persistence exists at the repository level but is not connected to those buttons.
- The displayed profile signal uses the deterministic SkyPilot progression score, but only the currently available profile metrics contribute; it is unofficial and never an official Hypixel stat.

## Modules and calculators

- Accessories, Garden, money-making, core skills, economy labs, Dungeons, Slayers, and Minions now have focused deterministic surfaces. Mining, Foraging, Fishing, Museum, Collections, Bestiary, Rift, gear, and item areas remain incomplete or narrow.
- The focused calculators use explicit manual assumptions; they do not imply profile-derived values, dedicated product APIs, or current live market prices.
- Build creation plus private/unlisted/public sharing, saved profiles/accounts, preferences, favorites, goals, and account deletion are wired for trusted signed-in deployments. Recommendation action history, goal/analysis sharing, Guilds, leaderboards, ads, premium, Discord, and notifications are incomplete or deliberately deferred.
- The minion-slot UI uses four illustrative fixed families; money-making rates/setups and craft/NPC data are editable reference scenarios, not live recommendations or guaranteed earnings.

## Economy

- Bazaar and active-auction pages show normalized D1 snapshots only when the safe-default `ENABLE_PUBLIC_ECONOMY` gate is deliberately enabled and a worker has published data.
- Active Auction search is snapshot-wide, but it is still bounded/paginated and is not variant-aware.
- Ended-auction data has an API route but no complete user-facing history/valuation experience.
- Bazaar history now uses idempotent worker-built OHLC/average-volume buckets with 90-day hourly and three-year daily retention, a bounded API, and an accessible four-range chart. These are Hypixel summary-price observations, not trade history or guaranteed quotes.
- Bazaar UI search covers only the up-to-250 rows loaded into the browser. Auction/item aggregates, variant-aware history, item pages/search, and full valuation/compaction jobs remain absent; ended-sale retention is bounded rather than a complete long-term history system.
- A lease-fenced D1 snapshot store, scheduled worker handler, safe backoff, and admin full-cycle request are implemented and tested. Production D1 migration and exactly one scheduler registration remain external activation work.
- Market estimates are not guaranteed trades or profit.

## Accounts and administration

- Optional account identity and canonical-user mapping exist for Sites/ChatGPT auth. Exact-origin confirmed account deletion removes owned application data through tested cascades without deleting the ChatGPT account.
- Owner-scoped goals support list/item reads, create, field/progress updates, complete, pause/resume, explicit recurring reset, and permanent delete when verified identity, D1, and migrations are active.
- Goal steps are currently generated presentation guidance rather than persisted editable XP/hour/cost-aware decomposition.
- Saved profiles/accounts, preferences, favorites, and builds are owner-scoped UI/API features with privacy-aware share links. Direct browser persistence coverage and a portable external-auth adapter are still missing.
- Admin status is local-runtime oriented. It adds redacted aggregate AI requests/tokens/configured cost/failures/latency/categories, but does not provide full database, scheduler, deployment, user, broad analytics, job retry, feature-flag, or error-log management.

## AI

- The safe-default-off route supports optional stateless Responses API calls, server-resolved bounded live/demo profile, progression/roadmap, non-stale Bazaar, and calculator context, three detail modes, timeout, and safe failure.
- The AI page can request a username/profile directly, but dashboard selection is not carried across automatically and accessory/money-making/item knowledge engines are not grounded yet.
- AI request limiting is per runtime and unsuitable as the only production abuse control.
- Strict output validation rejects uncited/conflicting numeric claims, and aggregate hour/day metrics avoid prompts, answers, users, profiles, and IPs. Live-provider evaluation and broader adversarial/domain coverage remain incomplete.

## Infrastructure and QA

- Hosted player values use shared normalized Workers KV, while player single-flight and Hypixel header backoff remain per isolate. Cloudflare's rate bindings are per-location abuse guards rather than exact global quota accounting. AI throttling remains in-memory per runtime.
- Docker Compose includes only the web service; no database/cache/worker stack.
- PostgreSQL, Redis, external auth, object storage, queue, scheduler, analytics, and secrets adapters are not implemented.
- Automated tests cover engine, service, provider/security, and rendered-route cases including signed gateway boundaries, saved state, Bazaar history, item/NBT safety, AI grounding/metrics, and worker policy, but not full browser E2E, visual regression, automated accessibility, load/soak, live credentials, production D1 application, or current-source deployment smoke tests.
- A final visual, performance, current-policy, security, and complete-specification audit is still required before launch.

Track remaining work in [TODO](../TODO.md).
