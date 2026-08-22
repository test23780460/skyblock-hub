# Database Migrations

## Policy

Generated Drizzle SQL and metadata are source-controlled. Never edit an already-deployed migration to change history; add a forward migration. A destructive migration requires an explicit backup/export, a tested recovery path, and review of the exact target environment.

## Generate and validate

After changing `db/schema/**`:

```powershell
npm.cmd run db:generate
npm.cmd run db:check
npm.cmd run db:smoke
```

Review generated SQL for:

- unintended drops or table rebuilds;
- foreign-key delete/update actions;
- uniqueness and check constraints;
- indexes for new read paths;
- timestamp/boolean/JSON representation;
- defaults that work in D1 SQLite;
- data backfills required before a new `NOT NULL` constraint.

`db:smoke` applies every versioned SQL file transactionally to isolated
in-memory SQLite, compares the resulting table set with the latest Drizzle
snapshot, runs `PRAGMA foreign_key_check`, and requires the durable economy and
portable provider-budget table shape. The current five-migration app chain
creates 37 tables with zero foreign-key findings when the gate passes. Native
credential admission uses a separate shared `PROVIDER_BUDGET_DB`; its one
additive migration lives in `drizzle-provider-budget/` and must be applied
independently.

Apply migrations to an isolated local/test database before production. Verify a clean database can apply the full chain, and verify an exported production-shaped fixture can upgrade without data loss. The current smoke is a clean-database check; it is not a production-shaped upgrade, backup, or restore drill.

## Expand-contract changes

For high-risk changes, use multiple releases:

1. Add nullable/new structures and deploy compatible readers/writers.
2. Backfill idempotently in a worker with checkpoints and metrics.
3. Switch reads after verification.
4. Enforce final constraints or remove obsolete structures in a later migration.

Do not place large backfills inside a request handler or scheduler configuration.

## Rollback and recovery

D1 and PostgreSQL have different rollback capabilities. Treat restore from a verified export/backup plus a forward corrective migration as the portable recovery baseline. Document each production migration’s expected duration, lock/rebuild behavior, backfill, validation query, and recovery step.

## Seed data

Stable feature definitions and job definitions may be seeded idempotently. Test/demo SkyBlock records must be clearly marked and must never be silently inserted into production. Secrets are never seed data.
