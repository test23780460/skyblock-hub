import assert from "node:assert/strict";
import test from "node:test";
import {
  parseBuildMutation,
  parseFavorite,
  parsePreferences,
  parseSavedProfileCreate,
  resolveShareSlug,
} from "../../lib/saved-state/validation";
import { DrizzleIdentityRepository } from "../../lib/repositories/drizzle/identity.repository";
import { DrizzleProfileRepository } from "../../lib/repositories/drizzle/profile.repository";
import { DrizzleUserContentRepository } from "../../lib/repositories/drizzle/user-content.repository";
import { createTestDatabase } from "./d1-fixture";

test("saved-state parsers reject owner injection and unbounded payload shapes", () => {
  assert.equal(parseSavedProfileCreate({
    username: "PilotFixture",
    profileId: "00000000000000000000000000000011",
    userId: "forged-owner",
  }).ok, false);
  assert.equal(parseFavorite({
    resourceType: "tool",
    resourceId: "calculators",
    label: "x".repeat(121),
  }).ok, false);
  assert.equal(parsePreferences({
    defaultPlayer: "PilotFixture",
    defaultBudgetCoins: -1,
    planningFocus: "progression",
    compactAccountView: false,
  }).ok, false);
  assert.equal(parseBuildMutation({
    title: "Injected build",
    description: "",
    profileId: null,
    visibility: "private",
    rotateShareLink: false,
    userId: "forged-owner",
    build: { activity: "general", armor: "", weapon: "", equipment: "", pet: "", accessories: "", notes: "" },
  }).ok, false);
});

test("saved-state parsers accept the bounded product contracts", () => {
  assert.equal(parseSavedProfileCreate({
    username: "PilotFixture",
    profileId: "00000000-0000-0000-0000-000000000011",
    alias: "Main",
    isPinned: true,
    isPrimary: true,
  }).ok, true);
  assert.equal(parsePreferences({
    defaultPlayer: "PilotFixture",
    defaultBudgetCoins: 50_000_000,
    planningFocus: "completion",
    compactAccountView: true,
  }).ok, true);
  assert.equal(parseBuildMutation({
    title: "Floor VII tank",
    description: "Manual loadout plan",
    profileId: null,
    visibility: "unlisted",
    rotateShareLink: false,
    build: { activity: "dungeons", armor: "Goldor", weapon: "Wither Cloak", equipment: "", pet: "Blue Whale", accessories: "800 MP · Fortuitous", notes: "Manual fixture" },
  }).ok, true);
  const existingShare = "share_00000000000000000000000000000001";
  assert.equal(resolveShareSlug(existingShare, "private", false, () => "unused"), null);
  assert.equal(resolveShareSlug(existingShare, "unlisted", false, () => "unused"), existingShare);
  assert.equal(resolveShareSlug(existingShare, "public", true, () => "share_rotated"), "share_rotated");
});

test("profile repository scopes saved profiles and account mutations by owner", async () => {
  const { db, database } = createTestDatabase();
  try {
    const identities = new DrizzleIdentityRepository(db);
    const profiles = new DrizzleProfileRepository(db);
    const content = new DrizzleUserContentRepository(db);
    await identities.createUser({ id: "user_owner_a" });
    await identities.createUser({ id: "user_owner_b" });
    await identities.setPreference(
      "preference_owner_a",
      "user_owner_a",
      "site",
      "settings",
      { defaultPlayer: "PilotFixture" },
    );
    assert.equal((await identities.getPreferences("user_owner_a", "site")).settings?.defaultPlayer, "PilotFixture");
    assert.deepEqual(await identities.getPreferences("user_owner_b", "site"), {});
    assert.equal(await identities.deletePreference("user_owner_b", "site", "settings"), false);
    const account = await profiles.upsertMinecraftAccount({
      id: "minecraft_00000000000000000000000000000001",
      minecraftUuid: "00000000000000000000000000000001",
      lastKnownUsername: "PilotFixture",
      usernameNormalized: "pilotfixture",
    });
    const profile = await profiles.upsertProfile({
      id: "profile_00000000000000000000000000000011",
      minecraftAccountId: account.id,
      hypixelProfileId: "00000000000000000000000000000011",
      cuteName: "Pineapple",
      dataState: "complete",
    });
    await profiles.linkMinecraftAccount("user_owner_a", account.id, { isPrimary: true });
    await profiles.saveProfile("user_owner_a", profile.id, { alias: "Main", isPinned: true });
    const linkedBuild = await content.createBuild({
      id: "build_00000000-0000-0000-0000-000000000010",
      userId: "user_owner_a",
      profileId: profile.id,
      title: "Linked build",
      build: { activity: "general", armor: "", weapon: "", equipment: "", pet: "", accessories: "", notes: "" },
    });
    const alternate = await profiles.upsertMinecraftAccount({
      id: "minecraft_00000000000000000000000000000002",
      minecraftUuid: "00000000000000000000000000000002",
      lastKnownUsername: "PilotAlt",
      usernameNormalized: "pilotalt",
    });
    await profiles.linkMinecraftAccount("user_owner_a", alternate.id, { isPrimary: true });
    const linkedAccounts = await profiles.listLinkedMinecraftAccounts("user_owner_a");
    assert.equal(linkedAccounts.length, 2);
    assert.deepEqual(linkedAccounts.filter((candidate) => candidate.isPrimary).map((candidate) => candidate.id), [alternate.id]);

    assert.equal((await profiles.listSavedProfileDetails("user_owner_a")).length, 1);
    assert.equal(await profiles.getSavedProfile("user_owner_b", profile.id), null);
    assert.equal(await profiles.deleteSavedProfile("user_owner_b", profile.id), false);
    assert.equal(await profiles.updateLinkedMinecraftAccount("user_owner_b", account.id, { label: "stolen" }), null);
    assert.equal((await profiles.getSavedProfile("user_owner_a", profile.id))?.alias, "Main");

    assert.equal(await profiles.unlinkMinecraftAccount("user_owner_b", account.id), false);
    assert.equal(await profiles.unlinkMinecraftAccount("user_owner_a", alternate.id), true);
    assert.equal(await profiles.unlinkMinecraftAccount("user_owner_a", account.id), true);
    assert.equal((await profiles.listSavedProfileDetails("user_owner_a")).length, 0);
    assert.equal((await content.getBuild("user_owner_a", linkedBuild.id))?.profileId, null);
    assert.equal(await identities.deletePreference("user_owner_a", "site", "settings"), true);
  } finally {
    database.close();
  }
});

test("build and favorite repository operations enforce ownership and build privacy", async () => {
  const { db, database } = createTestDatabase();
  try {
    const identities = new DrizzleIdentityRepository(db);
    const content = new DrizzleUserContentRepository(db);
    await identities.createUser({ id: "user_owner_a" });
    await identities.createUser({ id: "user_owner_b" });
    const configuration = { activity: "mining", armor: "Divan", weapon: "Titanium Drill", equipment: "", pet: "Bal", accessories: "500 MP", notes: "fixture" };
    const created = await content.createBuild({
      id: "build_00000000-0000-0000-0000-000000000001",
      userId: "user_owner_a",
      title: "Private mining build",
      visibility: "private",
      build: configuration,
    });
    assert.equal(await content.getBuild("user_owner_b", created.id), null);
    assert.equal(await content.deleteBuild("user_owner_b", created.id), false);
    assert.equal(await content.findSharedBuild("share_00000000000000000000000000000001"), null);

    const shared = await content.updateBuild("user_owner_a", created.id, {
      title: created.title,
      visibility: "unlisted",
      shareSlug: "share_00000000000000000000000000000001",
      build: configuration,
    });
    assert.equal(shared?.visibility, "unlisted");
    assert.equal((await content.findSharedBuild("share_00000000000000000000000000000001"))?.id, created.id);
    assert.equal((await content.listPublicBuilds()).length, 0);
    const publicBuild = await content.updateBuild("user_owner_a", created.id, {
      title: created.title,
      visibility: "public",
      shareSlug: "share_00000000000000000000000000000001",
      build: configuration,
    });
    assert.equal(publicBuild?.visibility, "public");
    assert.equal((await content.listPublicBuilds()).length, 1);
    assert.equal(await content.updateBuild("user_owner_b", created.id, {
      title: "Stolen",
      visibility: "public",
      shareSlug: "share_00000000000000000000000000000002",
      build: configuration,
    }), null);

    await content.addFavorite({
      id: "favorite_00000000-0000-0000-0000-000000000001",
      userId: "user_owner_a",
      resourceType: "build",
      resourceId: created.id,
      label: created.title,
    });
    assert.equal((await content.listFavorites("user_owner_a")).length, 1);
    assert.equal((await content.listFavorites("user_owner_b")).length, 0);
    assert.equal(await content.removeFavorite("user_owner_b", "build", created.id), false);
    assert.equal(await content.removeFavorite("user_owner_a", "build", created.id), true);
  } finally {
    database.close();
  }
});

test("saved-state indexes enforce one primary account and serve the public build query", () => {
  const { database } = createTestDatabase();
  try {
    const accountIndexes = database
      .prepare("PRAGMA index_list('user_minecraft_accounts')")
      .all() as { name: string; unique: number; partial: number }[];
    const primaryIndex = accountIndexes.find((index) => index.name === "user_minecraft_accounts_primary_uidx");
    assert.equal(primaryIndex?.unique, 1);
    assert.equal(primaryIndex?.partial, 1);

    const plan = database
      .prepare("EXPLAIN QUERY PLAN SELECT * FROM saved_builds WHERE visibility = ? ORDER BY updated_at DESC LIMIT 24")
      .all("public") as { detail: string }[];
    assert.match(plan.map((row) => row.detail).join("\n"), /saved_builds_visibility_updated_idx/i);
  } finally {
    database.close();
  }
});
