import { env } from "cloudflare:workers";
import { drizzle, type AnyD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

export { schema };

/** Creates the current adapter from an explicitly supplied D1-compatible binding. */
export function createDb(binding: AnyD1Database) {
  return drizzle(binding, { schema });
}

/** Sites convenience composition; portable services should receive repositories instead. */
export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return createDb(env.DB);
}

export type AppDatabase = ReturnType<typeof createDb>;
