import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

const migrationDirectory = new URL("../drizzle/", import.meta.url);
const metadataDirectory = new URL("../drizzle/meta/", import.meta.url);
const migrationFiles = (await readdir(migrationDirectory))
  .filter((name) => /^\d{4}_.+\.sql$/.test(name))
  .sort();
const snapshots = (await readdir(metadataDirectory))
  .filter((name) => /^\d{4}_snapshot\.json$/.test(name))
  .sort();

assert.ok(migrationFiles.length > 0, "At least one SQL migration is required");
assert.ok(snapshots.length > 0, "At least one Drizzle snapshot is required");

const database = new DatabaseSync(":memory:");
database.exec("PRAGMA foreign_keys = ON");

for (const file of migrationFiles) {
  const sql = await readFile(new URL(file, migrationDirectory), "utf8");
  const statements = sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
  database.exec("BEGIN");
  try {
    for (const statement of statements) database.exec(statement);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw new Error(`Migration ${file} did not apply cleanly`, { cause: error });
  }
}

const latestSnapshotFile = snapshots.at(-1);
const latestSnapshot = JSON.parse(
  await readFile(new URL(latestSnapshotFile, metadataDirectory), "utf8"),
);
const expectedTables = Object.keys(latestSnapshot.tables).sort();
const actualTables = database
  .prepare("select name from sqlite_schema where type = 'table' and name not like 'sqlite_%' order by name")
  .all()
  .map((row) => row.name);
assert.deepEqual(actualTables, expectedTables, "Applied migration tables must match the latest Drizzle snapshot");

const foreignKeyFindings = database.prepare("PRAGMA foreign_key_check").all();
assert.deepEqual(foreignKeyFindings, [], "Applied migrations must have no foreign-key findings");

for (const required of [
  "public_economy_worker_state",
  "public_economy_feed_state",
  "public_bazaar_snapshot_rows",
  "public_bazaar_history_buckets",
  "public_active_auction_snapshot_rows",
  "public_ended_auction_sales",
]) {
  assert.ok(actualTables.includes(required), `Missing required economy table: ${required}`);
}

console.log(`Migration smoke passed: ${migrationFiles.length} migrations, ${actualTables.length} tables, 0 foreign-key findings.`);
