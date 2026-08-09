# ChatGPT/Codex Sites Deployment

Sites is SkyPilot’s preferred initial host. An owner-only preview can validate the packaged build without being treated as a public production launch or enabling live integrations.

## Current readiness

- vinext production build passes;
- `.openai/hosting.json` declares the logical D1 binding `DB` and no R2 binding;
- a generated Drizzle SQLite migration and metadata are present in the repository workspace;
- the Cloudflare worker entry expects `ASSETS`, `DB`, and image bindings;
- optional Sites/ChatGPT identity helpers and canonical-user mapping exist;
- production secrets, D1 data, scheduler, admin allowlist, domain, and public access are not activated.

## Preflight

1. Revoke and replace any credential previously exposed outside a secret manager.
2. Run `npm run lint`, `npm run typecheck`, and `npm test` on the exact source to publish.
3. Verify the generated migration matches `db/schema.ts` with Drizzle’s migration check.
4. Review [Known limitations](../limitations.md), [Security](../../SECURITY.md), and the current [Hypixel policy](../policies/hypixel-api.md).
5. Decide whether this version is private. Private is the safe default; do not make it shared/public without explicit owner approval.

## Hosting configuration

`.openai/hosting.json` may contain only the Sites project ID when assigned plus logical `d1`/`r2` binding names. Runtime values and secrets are managed through Sites, not committed to this file.

Required/optional runtime configuration:

- D1 binding `DB` and the repository migration for goal/account persistence;
- replacement `HYPIXEL_API_KEY` for player lookup;
- replacement `OPENAI_API_KEY` and an accessible `OPENAI_MODEL` for optional AI;
- real `SITE_URL` and optional `SITE_NAME`;
- verified `ADMIN_USER_IDS` for administrators;
- launch-deferred flags kept off.

Public Bazaar/Auction reads do not use the authenticated Hypixel key.

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
- Bazaar and one bounded Auction page;
- live player lookup only after the replacement Hypixel key is installed;
- AI unavailable state or one bounded request after activation;
- anonymous goal rejection, signed-in goal persistence, and database migration state;
- non-admin rejection and allowlisted admin access/actions;
- metadata, sitemap, robots exclusions, social image, responsive layouts, and error/loading states;
- no secret in browser assets, responses, logs, source maps, or hosting metadata.

## Operational limitations

Sites deployment alone does not activate a durable economy scheduler/sink or distributed cache/rate budget. If the web host cannot provide those safely, deploy the worker/supporting services separately and have the Sites frontend consume product-specific data. Do not remove the feature or poll player profiles as a substitute.
