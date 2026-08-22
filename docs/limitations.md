# Known limitations

This is the honest pre-release status. Implemented code, historical deployment
evidence, and externally activated production behavior are different things.

## Deployment and external activation

- No native public deployment, custom domain, DNS cutover, or public launch is
  claimed. The migration worktree builds production/staging web Workers plus
  matching private economy Workers; remote resources, Builds connections,
  exact-final-head dry-runs, deployment, and smoke tests remain operator work.
- Commit `3b4064d` at the owner-only Sites URL is historical rollback evidence,
  not the current preferred runtime or exact-head native verification.
- Native staging and production have separate configured application D1/KV/rate
  bindings, one shared dedicated `PROVIDER_BUDGET_DB`, and environment-matched
  `ECONOMY_SERVICE` targets, but all five app migrations plus the provider
  database's one additive migration still need remote application and
  backup/restore validation.
- Any Hypixel or OpenAI key previously shared outside a secret manager is
  compromised and must be rotated before activation. Hypixel Production
  approval and a final current-policy review remain public-launch gates.

## Player analysis

- Native request-driven lookup supports normalized identity/profile selection,
  several core stats/skills, bounded supported item-container summaries,
  detected gear/accessory identities, and deterministic recommendations.
- Minecraft username resolution uses Minecraft Services with a bounded Mojang
  fallback. If both identity services are unavailable, the user receives an
  actionable direct-Java-UUID recovery path; SkyPilot does not attempt an
  unsupported Hypixel name query.
- Base64/gzip/NBT handling is bounded and discards raw blobs, trees, lore, and
  unsupported fields before shared caching.
- Full modifier-aware gear analysis, pets, additional storage, Museum,
  Bestiary, Rift, Minion, Garden, and deep Dungeon profile analysis are not
  wired end to end.
- Valuation/net-worth engines are tested, but complete asset coverage and
  current/historical price joins are absent; unavailable results are shown
  rather than fabricated.
- Recommendation Complete/Ignore/Remind Later buttons remain client-memory
  only. Saving a profile never starts polling, history, or scheduled refresh.
- Workers KV is eventually consistent, response-header backoff is per isolate,
  and Cloudflare rate bindings are coarse per-location abuse filters. The actor
  binding is route-bound; Mojang calls do not spend Hypixel quota. Only an actual
  authenticated Hypixel transport performs one shared-filter check and one
  two-token atomic reservation in the shared `PROVIDER_BUDGET_DB`. That D1
  reservation globally guards the shared Hypixel key, but
  public exposure still needs load/capacity evidence, monitoring, and validation
  of the configured budget against the approved quota.

## Modules and calculators

- Accessories, Garden, money-making, core skills, economy labs, Dungeons,
  Slayers, and Minions have focused deterministic surfaces. Several other
  domains remain narrow feature maps or planners.
- Calculator inputs and example rates are explicit editable assumptions, not
  profile-derived facts, current recipes, or guaranteed earnings.
- Build sharing, saved state, goals, and account deletion are implemented in
  repository/API/UI layers but disabled until native identity/session behavior
  is proven. Recommendation history, goal/analysis sharing, Guilds,
  leaderboards, ads, premium, Discord, and notifications are incomplete or
  deferred.

## Economy

- Bazaar, active-Auction, ended-sale, and history routes read only complete D1
  publications. Ingestion exists only in the matching private economy Worker;
  both its flag and the web flag are initially false, and no Cron exists, so
  these surfaces are unavailable until deliberately activated.
- Activation requires Workers Paid, all five remote app migrations, D1 usage/cost
  and capacity monitoring, replacement of the current non-incremental
  active-Auction crawl with a reviewed incremental or compacted ingestion
  design, exactly one reviewed production Cron on `skypilot-economy`, and a
  verified first real publication. The existing row-heavy one-minute design is
  not Free-plan safe and does not yet have production capacity evidence.
- Active Auction search is bounded and not variant-aware. Ended sales lack a
  complete user-facing valuation/history experience.
- Bazaar history is based on summary-price observations, not trades or
  guaranteed quotes. Browser search covers at most the loaded 250-row slice.
- A compact Free-safe series would require a new schema/migration/API and lower
  retention; it is future work, not an activation shortcut.
- Market estimates never guarantee trades or profit.

## Accounts, administration, and AI

- Account auth is disabled. The native Cloudflare Access verifier exists, but
  whole-host Access would block anonymous tools and a protected login path alone
  does not establish an optional session on public routes.
- Historical Sites identities cannot be silently merged into native identities
  by email. Canonical-user migration/relinking needs an explicit verified
  process.
- Account/goal/build/admin behavior still needs browser identity, owner
  isolation, permission, lifecycle, and deletion QA against the selected native
  session design.
- Admin status is intentionally narrow and does not manage arbitrary SQL,
  secrets, deployments, schedules, users, or broad cache prefixes.
- AI is optional and off. It has bounded structured grounding and numeric
  conflict validation, but its limiter is per runtime and broader domain
  grounding/live-provider security evaluation remains incomplete.

## Infrastructure and QA

- Native Cloudflare uses separate web/private-economy Workers, Static Assets,
  D1, KV, rate bindings, and `ECONOMY_SERVICE`; it has no Images or R2
  dependency. The private Workers expose neither `workers.dev` nor preview URLs.
  Docker Compose is only a web-image smoke path.
- PostgreSQL, Redis, non-Cloudflare auth, queue, external scheduler,
  observability, and backup adapters are not implemented.
- The exact-head suite contains 196 tests: 40 engine, 16 service, 106
  provider/security, and 34 rendered/configuration/legal. See
  [Testing](testing.md) for the distinction between current local evidence,
  historical smoke, and still-unverified remote deployment/browser evidence.
- Full responsive/browser, accessibility, visual-regression, load/soak,
  remote-migration, account/auth, dependency, current-policy, and release-level
  security audits are still required.

Track remaining work in [TODO](../TODO.md) and exact validation evidence in
[Testing](testing.md).
