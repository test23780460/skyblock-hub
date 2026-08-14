import assert from "node:assert/strict";
import test from "node:test";
import { getTableConfig, type SQLiteTable } from "drizzle-orm/sqlite-core";
import { hasExactRequestOrigin } from "../../app/api/account/origin";
import {
  adminAuditLogs,
  analyticsEvents,
  externalIdentities,
  favorites,
  featureOverrides,
  goals,
  recommendationStates,
  savedBuilds,
  savedProfiles,
  userMinecraftAccounts,
  userPreferences,
  userRoles,
  users,
} from "../../db/schema";

const accountOwnedTables: readonly [SQLiteTable, string][] = [
  [externalIdentities, "user_id"],
  [userPreferences, "user_id"],
  [userRoles, "user_id"],
  [userMinecraftAccounts, "user_id"],
  [savedProfiles, "user_id"],
  [goals, "user_id"],
  [recommendationStates, "user_id"],
  [savedBuilds, "user_id"],
  [favorites, "user_id"],
];

test("every directly account-owned table cascades from canonical users", () => {
  for (const [table, sourceColumn] of accountOwnedTables) {
    assert.equal(onDeleteAction(table, sourceColumn), "cascade", `${getTableConfig(table).name}.${sourceColumn}`);
  }
});

test("retained operational records remove canonical user attribution", () => {
  assert.equal(onDeleteAction(userRoles, "granted_by_user_id"), "set null");
  assert.equal(onDeleteAction(featureOverrides, "created_by_user_id"), "set null");
  assert.equal(onDeleteAction(analyticsEvents, "user_id"), "set null");
  assert.equal(onDeleteAction(adminAuditLogs, "admin_user_id"), "set null");
});

test("account deletion accepts only an explicit exact request origin", () => {
  assert.equal(hasExactRequestOrigin(new Request("https://skypilot.example/api/account", {
    method: "DELETE",
    headers: { origin: "https://skypilot.example" },
  })), true);
  assert.equal(hasExactRequestOrigin(new Request("https://skypilot.example/api/account", {
    method: "DELETE",
  })), false);
  assert.equal(hasExactRequestOrigin(new Request("https://skypilot.example/api/account", {
    method: "DELETE",
    headers: { origin: "https://attacker.example" },
  })), false);
  assert.equal(hasExactRequestOrigin(new Request("https://skypilot.example/api/account", {
    method: "DELETE",
    headers: { origin: "not a valid origin" },
  })), false);
});

function onDeleteAction(table: SQLiteTable, sourceColumn: string) {
  const foreignKey = getTableConfig(table).foreignKeys.find((candidate) => {
    const reference = candidate.reference();
    return reference.foreignTable === users && reference.columns.some((column) => column.name === sourceColumn);
  });
  return foreignKey?.onDelete ?? null;
}
