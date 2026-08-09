# SkyPilot engineering guide

## Product rules

- Keep the user-facing name in `lib/config.ts`; the repository may remain `skyblock-hub`.
- Core lookup and planning must work without an account. Accounts add durable saved state.
- Never present fixture, preview, or fallback values as live data. Label demonstrations at the data boundary and in the UI.
- Player/profile fetches are user-triggered, shared-cached, latest-snapshot only. Never add scheduled player refreshes, stat/session histories, or selected-player monitoring.
- Public Bazaar, auction, ended-auction, and resource ingestion belongs to the separate economy worker.
- Deterministic engines own calculations. AI may explain them but may not replace, modify, or invent numeric results.
- Do not automate gameplay, trades, the Minecraft client, or prohibited unfair advantages.

## Architecture boundaries

- `app/` and `components/`: transport and presentation.
- `lib/engines/`: deterministic portable calculations.
- `lib/providers/`: external transports and payload validation.
- `lib/services/`: orchestration over normalized inputs.
- `lib/repositories/`: persistence interfaces and adapters.
- `worker/jobs/`: scheduler-independent public-resource jobs.
- `db/` and `drizzle/`: portable schema and migrations.

Business logic must not depend directly on D1, Sites, SIWC, a scheduler, or a queue. Keep provider-specific code in adapters. Treat external payloads, NBT, query strings, and client JSON as untrusted.

## Completion gate

For a substantial change, run lint, typecheck, focused tests, the production build, and relevant browser flows. Verify responsive, loading, empty, error, keyboard, focus, and reduced-motion behavior. Keep `TODO.md` accurate; a checked item needs implementation and validation evidence.

## Secrets

Never commit `.env`, API keys, tokens, raw credentials, or secret-bearing logs. `.env.example` contains names and safe defaults only. Keys shared in chat or another non-secret channel are compromised and must be rotated before production activation.
