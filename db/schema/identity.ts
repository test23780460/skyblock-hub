import { sql } from "drizzle-orm";
import {
  check,
  index,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createdAt, jsonText, timestampMs, updatedAt, type JsonObject } from "./helpers";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    displayName: text("display_name"),
    status: text("status", { enum: ["active", "disabled", "deleted"] })
      .notNull()
      .default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    lastSeenAt: timestampMs("last_seen_at"),
  },
  (table) => [
    index("users_status_idx").on(table.status),
    check("users_status_check", sql`${table.status} in ('active', 'disabled', 'deleted')`),
  ],
);

export const externalIdentities = sqliteTable(
  "external_identities",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    provider: text("provider").notNull(),
    providerSubject: text("provider_subject").notNull(),
    emailNormalized: text("email_normalized"),
    providerData: jsonText<JsonObject>("provider_data"),
    createdAt: createdAt(),
    lastLoginAt: timestampMs("last_login_at"),
  },
  (table) => [
    uniqueIndex("external_identities_provider_subject_uidx").on(
      table.provider,
      table.providerSubject,
    ),
    index("external_identities_user_idx").on(table.userId),
    index("external_identities_email_idx").on(table.emailNormalized),
  ],
);

export const userRoles = sqliteTable(
  "user_roles",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    role: text("role", { enum: ["user", "admin", "operator"] }).notNull(),
    grantedByUserId: text("granted_by_user_id").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.role] }),
    index("user_roles_role_idx").on(table.role),
    check("user_roles_role_check", sql`${table.role} in ('user', 'admin', 'operator')`),
  ],
);

export const userPreferences = sqliteTable(
  "user_preferences",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    namespace: text("namespace").notNull().default("site"),
    preferenceKey: text("preference_key").notNull(),
    value: jsonText<JsonObject>("value").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("user_preferences_scope_key_uidx").on(
      table.userId,
      table.namespace,
      table.preferenceKey,
    ),
    index("user_preferences_user_idx").on(table.userId),
  ],
);
