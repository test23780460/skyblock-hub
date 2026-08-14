import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { jsonText, createdAt, timestampMs, updatedAt, type JsonObject } from "./helpers";
import { users } from "./identity";
import { skyblockProfiles } from "./player";

export const goals = sqliteTable(
  "goals",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    profileId: text("profile_id").references(() => skyblockProfiles.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    goalType: text("goal_type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status", { enum: ["active", "paused", "completed", "archived"] })
      .notNull()
      .default("active"),
    progressPercent: real("progress_percent").notNull().default(0),
    target: jsonText<JsonObject>("target").notNull(),
    dueAt: timestampMs("due_at"),
    completedAt: timestampMs("completed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("goals_user_status_idx").on(table.userId, table.status),
    index("goals_profile_status_idx").on(table.profileId, table.status),
    check(
      "goals_status_check",
      sql`${table.status} in ('active', 'paused', 'completed', 'archived')`,
    ),
    check(
      "goals_progress_check",
      sql`${table.progressPercent} >= 0 and ${table.progressPercent} <= 100`,
    ),
  ],
);

export const goalSteps = sqliteTable(
  "goal_steps",
  {
    id: text("id").primaryKey(),
    goalId: text("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade", onUpdate: "cascade" }),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status", { enum: ["pending", "active", "completed", "skipped"] })
      .notNull()
      .default("pending"),
    estimate: jsonText<JsonObject>("estimate"),
    completedAt: timestampMs("completed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("goal_steps_goal_position_uidx").on(table.goalId, table.position),
    index("goal_steps_goal_status_idx").on(table.goalId, table.status),
    check("goal_steps_position_check", sql`${table.position} >= 0`),
    check(
      "goal_steps_status_check",
      sql`${table.status} in ('pending', 'active', 'completed', 'skipped')`,
    ),
  ],
);

export const recommendationStates = sqliteTable(
  "recommendation_states",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    profileId: text("profile_id")
      .notNull()
      .references(() => skyblockProfiles.id, { onDelete: "cascade", onUpdate: "cascade" }),
    recommendationKey: text("recommendation_key").notNull(),
    recommendationVersion: text("recommendation_version").notNull().default("1"),
    category: text("category").notNull(),
    state: text("state", { enum: ["active", "completed", "ignored", "snoozed"] })
      .notNull()
      .default("active"),
    context: jsonText<JsonObject>("context"),
    remindAt: timestampMs("remind_at"),
    completedAt: timestampMs("completed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("recommendation_states_identity_uidx").on(
      table.userId,
      table.profileId,
      table.recommendationKey,
    ),
    index("recommendation_states_user_state_idx").on(table.userId, table.state),
    index("recommendation_states_profile_category_idx").on(table.profileId, table.category),
    index("recommendation_states_remind_idx").on(table.state, table.remindAt),
    check(
      "recommendation_states_state_check",
      sql`${table.state} in ('active', 'completed', 'ignored', 'snoozed')`,
    ),
  ],
);

export const savedBuilds = sqliteTable(
  "saved_builds",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    profileId: text("profile_id").references(() => skyblockProfiles.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    title: text("title").notNull(),
    description: text("description"),
    visibility: text("visibility", { enum: ["private", "unlisted", "public"] })
      .notNull()
      .default("private"),
    shareSlug: text("share_slug"),
    schemaVersion: integer("schema_version").notNull().default(1),
    isExperimental: integer("is_experimental", { mode: "boolean" }).notNull().default(true),
    build: jsonText<JsonObject>("build").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("saved_builds_share_slug_uidx").on(table.shareSlug),
    index("saved_builds_user_updated_idx").on(table.userId, table.updatedAt),
    index("saved_builds_visibility_updated_idx").on(table.visibility, table.updatedAt),
    index("saved_builds_profile_idx").on(table.profileId),
    check(
      "saved_builds_visibility_check",
      sql`${table.visibility} in ('private', 'unlisted', 'public')`,
    ),
    check("saved_builds_schema_version_check", sql`${table.schemaVersion} > 0`),
  ],
);

export const favorites = sqliteTable(
  "favorites",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    label: text("label"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("favorites_user_resource_uidx").on(
      table.userId,
      table.resourceType,
      table.resourceId,
    ),
    index("favorites_user_type_idx").on(table.userId, table.resourceType),
  ],
);
