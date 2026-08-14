import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../db/schema";

type BoundValue = string | number | bigint | null | Uint8Array;

class SqliteD1Statement {
  constructor(
    private readonly database: DatabaseSync,
    readonly sql: string,
    readonly parameters: BoundValue[] = [],
  ) {}

  bind(...parameters: BoundValue[]) {
    return new SqliteD1Statement(this.database, this.sql, parameters);
  }

  async run() {
    const result = this.database.prepare(this.sql).run(...this.parameters);
    return d1Result([], Number(result.changes), Number(result.lastInsertRowid));
  }

  async all() {
    const rows = this.database.prepare(this.sql).all(...this.parameters) as Record<string, unknown>[];
    return d1Result(rows);
  }

  async raw() {
    const rows = this.database.prepare(this.sql).all(...this.parameters) as Record<string, unknown>[];
    return rows.map((row) => Object.values(row));
  }

  async first(column?: string) {
    const row = this.database.prepare(this.sql).get(...this.parameters) as Record<string, unknown> | undefined;
    return column ? row?.[column] ?? null : row ?? null;
  }

  executeForBatch() {
    const normalized = this.sql.trim().toLowerCase();
    if (normalized.startsWith("select") || normalized.startsWith("pragma") || /\breturning\b/.test(normalized)) {
      const rows = this.database.prepare(this.sql).all(...this.parameters) as Record<string, unknown>[];
      return d1Result(rows);
    }
    const result = this.database.prepare(this.sql).run(...this.parameters);
    return d1Result([], Number(result.changes), Number(result.lastInsertRowid));
  }
}

export function createTestDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  const migrationDirectory = new URL("../../drizzle/", import.meta.url);
  for (const file of readdirSync(migrationDirectory).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort()) {
    const migration = readFileSync(new URL(file, migrationDirectory), "utf8");
    for (const statement of migration.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) {
      database.exec(statement);
    }
  }

  const binding = {
    prepare(sql: string) {
      return new SqliteD1Statement(database, sql);
    },
    async batch(statements: SqliteD1Statement[]) {
      database.exec("BEGIN");
      try {
        const results = statements.map((statement) => statement.executeForBatch());
        database.exec("COMMIT");
        return results;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
    async exec(sql: string) {
      database.exec(sql);
      return { count: 0, duration: 0 };
    },
    async dump() {
      return new ArrayBuffer(0);
    },
  };

  return {
    database,
    db: drizzle(binding as never, { schema }),
  };
}

function d1Result(results: Record<string, unknown>[], changes = 0, lastRowId = 0) {
  return {
    success: true,
    results,
    meta: {
      changed_db: changes > 0,
      changes,
      duration: 0,
      last_row_id: lastRowId,
      rows_read: results.length,
      rows_written: changes,
      size_after: 0,
    },
  };
}
