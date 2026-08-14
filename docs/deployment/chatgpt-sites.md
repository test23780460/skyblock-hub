# ChatGPT/Codex Sites Deployment

Sites is SkyPilot’s preferred initial host. The validated safe-default build is deployed at the [owner-only SkyPilot preview](https://skypilot-skyblock.tratv.chatgpt.site). This is not a public production launch and does not enable live integrations.

## Current readiness

- vinext production build passes;
- `.openai/hosting.json` declares the logical D1 binding `DB` and no R2 binding;
- four generated Drizzle SQLite migrations and metadata are present and pass clean-database smoke;
- the Cloudflare worker entry expects `ASSETS`, `DB`, and image bindings;
- the worker entry includes a scheduled public-economy handler backed by a durable D1 lease/snapshot store;
- optional Sites/ChatGPT identity helpers and canonical-user mapping exist;
- production gateway secrets, D1 data, scheduler, admin allowlist, domain, and public access require separate activation and verification.

## Preflight

1. Revoke and replace any credential previously exposed outside a secret manager.
2. Run `npm run lint`, `npm run typecheck`, `npm run db:check`, `npm run db:smoke`, and `npm test` on the exact source to publish.
3. Verify all four generated migrations match `db/schema.ts`, inspect the forward SQL, and run the migration smoke.
4. Review [Known limitations](../limitations.md), [Security](../../SECURITY.md), and the current [Hypixel policy](../policies/hypixel-api.md).
5. Decide whether this version is private. Private is the safe default; do not make it shared/public without explicit owner approval.

## Hosting configuration

`.openai/hosting.json` may contain only the Sites project ID when assigned plus logical `d1`/`r2` binding names. Runtime values and secrets are managed through Sites, not committed to this file.

Required/optional runtime configuration:

- D1 binding `DB` and all four repository migrations for saved account/goals/build state, aggregate AI metrics, and durable public-economy state/history;
- `PLAYER_GATEWAY_URL`, `PLAYER_GATEWAY_SECRET`, and `REQUIRE_PLAYER_GATEWAY=true` for hosted player lookup; keep the replacement `HYPIXEL_API_KEY` only in the separately deployed gateway Worker;
- replacement `OPENAI_API_KEY` and an accessible `OPENAI_MODEL` for optional AI;
- real `SITE_URL` and optional `SITE_NAME`;
- verified `ADMIN_USER_IDS` for administrators;
- launch-deferred flags kept off.

Public Bazaar/Auction web reads use D1 snapshots and do not use the authenticated Hypixel key. Configure exactly one intended schedule before enabling public economy.

Deploy and verify the [private player gateway](player-gateway.md) before enabling player lookup. Remove any legacy `HYPIXEL_API_KEY` from the Sites environment after cutover.

## Sites publish flow

Use the Sites hosting workflow rather than hand-assembling a public archive:

1. Build and validate the exact source.
2. Create or reuse the Site/project and its source write credential.
3. Commit/push the exact validated source without storing credentials in Git configuration or remote URLs.
4. Package the built `dist/`, hosting metadata, and versioned migrations through the Sites packaging helper.
5. Save one version and deploy privately by default.
6. Poll the deployment until it succeeds or fails; only then report/open the deployed URL.

If a shared or public deployment is the only available mode, obtain explicit approval for that resolved access level before publishing.

## Identity behavior

Sites dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, and `/callback`, including OAuth cookies and identity-header injection. Do not add application routes for those paths.

Public lookup/economy pages remain anonymous. Goal/account/admin routes read Sites identity headers on the server. Sites identity establishes the external identity, while SkyPilot maps it to an internal canonical user. Admin access also requires `ADMIN_USER_IDS`.

Verify the deployed access policy and that untrusted clients cannot spoof the trusted headers.

## Post-deploy checks

- homepage, navigation, labeled demo, privacy/about/status pages;
- `/api/health` dependency states;
- a completed economy worker cycle followed by Bazaar and snapshot-wide bounded Auction search;
- live player lookup only after the replacement key is installed on the gateway, Sites signing configuration is active, and a request initiated from the deployed Sites origin succeeds;
- AI unavailable state or one bounded request after activation;
- anonymous goal rejection, signed-in goal lifecycle, account deletion on a test identity, and database migration state;
- non-admin rejection and allowlisted admin access/actions;
- metadata, sitemap, robots exclusions, social image, responsive layouts, and error/loading states;
- no secret in browser assets, responses, logs, source maps, or hosting metadata.

## Operational limitations

Sites source includes the durable D1 economy sink and scheduled handler, but saving a web version does not apply migrations or register/verify the production trigger. The separately deployed player gateway supplies normalized KV caching and Cloudflare abuse guards; its per-location limiter is not an exact global Hypixel quota ledger. If the host cannot schedule the economy worker safely, deploy a compatible worker/store separately and keep the Sites frontend on product-specific snapshot APIs. Do not poll player profiles as a substitute.
