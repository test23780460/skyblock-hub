import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { users } from "./identity";
import { createdAt, timestampMs, updatedAt } from "./helpers";

export const minecraftAccounts = sqliteTable(
  "minecraft_accounts",
  {
    id: text("id").primaryKey(),
    minecraftUuid: text("minecraft_uuid").notNull(),
    lastKnownUsername: text("last_known_username").notNull(),
    usernameNormalized: text("username_normalized").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("minecraft_accounts_uuid_uidx").on(table.minecraftUuid),
    index("minecraft_accounts_username_idx").on(table.usernameNormalized),
  ],
);

export const userMinecraftAccounts = sqliteTable(
  "user_minecraft_accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    minecraftAccountId: text("minecraft_account_id")
      .notNull()
      .references(() => minecraftAccounts.id, { onDelete: "cascade", onUpdate: "cascade" }),
    label: text("label"),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.minecraftAccountId] }),
    index("user_minecraft_accounts_account_idx").on(table.minecraftAccountId),
    uniqueIndex("user_minecraft_accounts_primary_uidx")
      .on(table.userId)
      .where(sql`${table.isPrimary} = 1`),
  ],
);

export const skyblockProfiles = sqliteTable(
  "skyblock_profiles",
  {
    id: text("id").primaryKey(),
    minecraftAccountId: text("minecraft_account_id")
      .notNull()
      .references(() => minecraftAccounts.id, { onDelete: "cascade", onUpdate: "cascade" }),
    hypixelProfileId: text("hypixel_profile_id").notNull(),
    profileName: text("profile_name"),
    cuteName: text("cute_name"),
    gameMode: text("game_mode"),
    isSelected: integer("is_selected", { mode: "boolean" }).notNull().default(false),
    dataState: text("data_state", {
      enum: ["unknown", "complete", "partial", "disabled", "error"],
    })
      .notNull()
      .default("unknown"),
    memberJoinedAt: timestampMs("member_joined_at"),
    lastRequestedAt: timestampMs("last_requested_at"),
    lastSuccessfulFetchAt: timestampMs("last_successful_fetch_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("skyblock_profiles_hypixel_id_uidx").on(table.hypixelProfileId),
    index("skyblock_profiles_account_idx").on(table.minecraftAccountId),
    index("skyblock_profiles_account_selected_idx").on(
      table.minecraftAccountId,
      table.isSelected,
    ),
    check(
      "skyblock_profiles_data_state_check",
      sql`${table.dataState} in ('unknown', 'complete', 'partial', 'disabled', 'error')`,
    ),
  ],
);

export const savedProfiles = sqliteTable(
  "saved_profiles",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    profileId: text("profile_id")
      .notNull()
      .references(() => skyblockProfiles.id, { onDelete: "cascade", onUpdate: "cascade" }),
    alias: text("alias"),
    isPinned: integer("is_pinned", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
    lastViewedAt: timestampMs("last_viewed_at"),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.profileId] }),
    index("saved_profiles_profile_idx").on(table.profileId),
    index("saved_profiles_user_pinned_idx").on(table.userId, table.isPinned),
  ],
);
