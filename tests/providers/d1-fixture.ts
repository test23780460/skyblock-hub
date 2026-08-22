import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../db/schema";

type BoundValue = string | number | bigint | null | Uint8Array;
type D1FixtureMetrics = {
  standaloneQueries: number;
  batchCalls: number;
  batchStatements: number;
};
const UTF8_ENCODER = new TextEncoder();

class SqliteD1Statement {
  constructor(
    private readonly database: DatabaseSync,
    readonly sql: string,
    private readonly metrics: D1FixtureMetrics,
    readonly parameters: BoundValue[] = [],
  ) {}

  bind(...parameters: BoundValue[]) {
    if (parameters.length > 100) {
      throw new Error("D1 permits at most 100 bound parameters per query");
    }
    if (
      /\blike\s+\?/i.test(this.sql) &&
      parameters.some(
        (value) =>
          typeof value === "string" &&
          UTF8_ENCODER.encode(value).byteLength > 50,
      )
    ) {
      throw new Error("D1 permits at most 50 bytes in a LIKE pattern");
    }
    return new SqliteD1Statement(
      this.database,
      this.sql,
      this.metrics,
      parameters,
    );
  }

  async run() {
    this.metrics.standaloneQueries += 1;
    const result = this.database.prepare(this.sql).run(...this.parameters);
    return d1Result([], Number(result.changes), Number(result.lastInsertRowid));
  }

  async all() {
    this.metrics.standaloneQueries += 1;
    const rows = this.database.prepare(this.sql).all(...this.parameters) as Record<string, unknown>[];
    return d1Result(rows);
  }

  async raw() {
    this.metrics.standaloneQueries += 1;
    const rows = this.database.prepare(this.sql).all(...this.parameters) as Record<string, unknown>[];
    return rows.map((row) => Object.values(row));
  }

  async first(column?: string) {
    this.metrics.standaloneQueries += 1;
    const row = this.database.prepare(this.sql).get(...this.parameters) as Record<string, unknown> | undefined;
    return column ? row?.[column] ?? null : row ?? null;
  }

  executeForBatch() {
    this.metrics.batchStatements += 1;
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

  const metrics: D1FixtureMetrics = {
    standaloneQueries: 0,
    batchCalls: 0,
    batchStatements: 0,
  };
  const binding = {
    prepare(sql: string) {
      return new SqliteD1Statement(database, sql, metrics);
    },
    async batch(statements: SqliteD1Statement[]) {
      metrics.batchCalls += 1;
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
    binding,
    db: drizzle(binding as never, { schema }),
    metrics,
    resetMetrics() {
      metrics.standaloneQueries = 0;
      metrics.batchCalls = 0;
      metrics.batchStatements = 0;
    },
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
