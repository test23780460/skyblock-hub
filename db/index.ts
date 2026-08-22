import { env } from "cloudflare:workers";
import { drizzle, type AnyD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

export { schema };

/** Creates the current adapter from an explicitly supplied D1-compatible binding. */
export function createDb(binding: AnyD1Database) {
  return drizzle(binding, { schema });
}

/** Cloudflare runtime composition; portable services receive repositories instead. */
export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Configure the environment-specific `DB` binding in wrangler.jsonc before using durable features."
    );
  }

  return createDb(env.DB);
}

export type AppDatabase = ReturnType<typeof createDb>;
