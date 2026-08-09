import { sql } from "drizzle-orm";
import { integer, text } from "drizzle-orm/sqlite-core";

export type JsonObject = Record<string, unknown>;
export type JsonValue =
  | boolean
  | number
  | string
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** D1 stores application timestamps as Unix epoch milliseconds. */
export function timestampMs(name: string) {
  return integer(name, { mode: "timestamp_ms" });
}

export function createdAt(name = "created_at") {
  return timestampMs(name)
    .notNull()
    .default(sql`(unixepoch() * 1000)`);
}

export function updatedAt(name = "updated_at") {
  return timestampMs(name)
    .notNull()
    .default(sql`(unixepoch() * 1000)`);
}

/** JSON is reserved for evolving game/provider payload fragments and opaque settings. */
export function jsonText<T extends JsonValue | JsonObject>(name: string) {
  return text(name, { mode: "json" }).$type<T>();
}

