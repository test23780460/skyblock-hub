# Database Migrations

## Policy

Generated Drizzle SQL and metadata are source-controlled. Never edit an already-deployed migration to change history; add a forward migration. A destructive migration requires an explicit backup/export, a tested recovery path, and review of the exact target environment.

## Generate and validate

After changing `db/schema/**`:

```powershell
npm.cmd run db:generate
.\node_modules\.bin\drizzle-kit.cmd check --config=drizzle.config.ts
```

Review generated SQL for:

- unintended drops or table rebuilds;
- foreign-key delete/update actions;
- uniqueness and check constraints;
- indexes for new read paths;
- timestamp/boolean/JSON representation;
- defaults that work in D1 SQLite;
- data backfills required before a new `NOT NULL` constraint.

Apply migrations to an isolated local/test database before production. Verify a clean database can apply the full chain, and verify an exported production-shaped fixture can upgrade without data loss.

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

