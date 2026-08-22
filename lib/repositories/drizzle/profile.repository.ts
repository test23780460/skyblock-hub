import { and, desc, eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import {
  minecraftAccounts,
  savedBuilds,
  savedProfiles,
  skyblockProfiles,
  userMinecraftAccounts,
} from "@/db/schema";
import type {
  MinecraftAccountRecord,
  LinkedMinecraftAccountRecord,
  ProfileRepository,
  SavedProfileDetailRecord,
  SavedProfileRecord,
  SkyblockProfileRecord,
  UpsertMinecraftAccountInput,
  UpsertSkyblockProfileInput,
} from "../contracts";

export class DrizzleProfileRepository implements ProfileRepository {
  constructor(private readonly db: AppDatabase) {}

  async findMinecraftAccountByUuid(minecraftUuid: string): Promise<MinecraftAccountRecord | null> {
    const [account] = await this.db
      .select()
      .from(minecraftAccounts)
      .where(eq(minecraftAccounts.minecraftUuid, minecraftUuid))
      .limit(1);
    return account ?? null;
  }

  async upsertMinecraftAccount(
    input: UpsertMinecraftAccountInput,
  ): Promise<MinecraftAccountRecord> {
    const [account] = await this.db
      .insert(minecraftAccounts)
      .values(input)
      .onConflictDoUpdate({
        target: minecraftAccounts.minecraftUuid,
        set: {
          lastKnownUsername: input.lastKnownUsername,
          usernameNormalized: input.usernameNormalized,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!account) {
      throw new Error("Failed to upsert Minecraft account");
    }
    return account;
  }

  async findProfileByHypixelId(hypixelProfileId: string): Promise<SkyblockProfileRecord | null> {
    const [profile] = await this.db
      .select()
      .from(skyblockProfiles)
      .where(eq(skyblockProfiles.hypixelProfileId, hypixelProfileId))
      .limit(1);
    return profile ?? null;
  }

  async upsertProfile(input: UpsertSkyblockProfileInput): Promise<SkyblockProfileRecord> {
    const values = {
      id: input.id,
      minecraftAccountId: input.minecraftAccountId,
      hypixelProfileId: input.hypixelProfileId,
      profileName: input.profileName ?? null,
      cuteName: input.cuteName ?? null,
      gameMode: input.gameMode ?? null,
      isSelected: input.isSelected ?? false,
      dataState: input.dataState ?? "unknown",
      memberJoinedAt: input.memberJoinedAt ?? null,
      lastRequestedAt: input.lastRequestedAt ?? null,
      lastSuccessfulFetchAt: input.lastSuccessfulFetchAt ?? null,
    } as const;

    const [profile] = await this.db
      .insert(skyblockProfiles)
      .values(values)
      .onConflictDoUpdate({
        target: skyblockProfiles.hypixelProfileId,
        set: {
          minecraftAccountId: input.minecraftAccountId,
          profileName: input.profileName ?? null,
          cuteName: input.cuteName ?? null,
          gameMode: input.gameMode ?? null,
          isSelected: input.isSelected ?? false,
          dataState: input.dataState ?? "unknown",
          memberJoinedAt: input.memberJoinedAt ?? null,
          lastRequestedAt: input.lastRequestedAt ?? null,
          lastSuccessfulFetchAt: input.lastSuccessfulFetchAt ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!profile) {
      throw new Error("Failed to upsert SkyBlock profile");
    }
    return profile;
  }

  async linkMinecraftAccount(
    userId: string,
    minecraftAccountId: string,
    options: { label?: string | null; isPrimary?: boolean } = {},
  ): Promise<void> {
    const link = this.db
      .insert(userMinecraftAccounts)
      .values({
        userId,
        minecraftAccountId,
        label: options.label ?? null,
        isPrimary: options.isPrimary ?? false,
      })
      .onConflictDoUpdate({
        target: [userMinecraftAccounts.userId, userMinecraftAccounts.minecraftAccountId],
        set: {
          label: options.label ?? null,
          isPrimary: options.isPrimary ?? false,
        },
      });
    if (options.isPrimary) {
      await this.db.batch([
        this.db
          .update(userMinecraftAccounts)
          .set({ isPrimary: false })
          .where(eq(userMinecraftAccounts.userId, userId)),
        link,
      ]);
    } else {
      await link;
    }
  }

  async saveProfile(
    userId: string,
    profileId: string,
    options: { alias?: string | null; isPinned?: boolean } = {},
  ): Promise<void> {
    await this.db
      .insert(savedProfiles)
      .values({
        userId,
        profileId,
        alias: options.alias ?? null,
        isPinned: options.isPinned ?? false,
        lastViewedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [savedProfiles.userId, savedProfiles.profileId],
        set: {
          alias: options.alias ?? null,
          isPinned: options.isPinned ?? false,
          lastViewedAt: new Date(),
        },
      });
  }

  async listSavedProfiles(userId: string): Promise<SavedProfileRecord[]> {
    return this.db
      .select()
      .from(savedProfiles)
      .where(eq(savedProfiles.userId, userId))
      .orderBy(desc(savedProfiles.isPinned), desc(savedProfiles.lastViewedAt));
  }

  async getSavedProfile(
    userId: string,
    profileId: string,
  ): Promise<SavedProfileDetailRecord | null> {
    const [profile] = await this.savedProfileDetailsQuery()
      .where(and(eq(savedProfiles.userId, userId), eq(savedProfiles.profileId, profileId)))
      .limit(1);
    return profile ?? null;
  }

  async listSavedProfileDetails(
    userId: string,
    limit = 50,
  ): Promise<SavedProfileDetailRecord[]> {
    return this.savedProfileDetailsQuery()
      .where(eq(savedProfiles.userId, userId))
      .orderBy(desc(savedProfiles.isPinned), desc(savedProfiles.lastViewedAt))
      .limit(limit);
  }

  async deleteSavedProfile(userId: string, profileId: string): Promise<boolean> {
    const [, deleted] = await this.db.batch([
      this.db
        .update(savedBuilds)
        .set({ profileId: null, updatedAt: new Date() })
        .where(and(eq(savedBuilds.userId, userId), eq(savedBuilds.profileId, profileId))),
      this.db
        .delete(savedProfiles)
        .where(and(eq(savedProfiles.userId, userId), eq(savedProfiles.profileId, profileId)))
        .returning({ profileId: savedProfiles.profileId }),
    ]);
    return deleted.length > 0;
  }

  async listLinkedMinecraftAccounts(
    userId: string,
    limit = 25,
  ): Promise<LinkedMinecraftAccountRecord[]> {
    return this.db
      .select({
        id: minecraftAccounts.id,
        minecraftUuid: minecraftAccounts.minecraftUuid,
        lastKnownUsername: minecraftAccounts.lastKnownUsername,
        usernameNormalized: minecraftAccounts.usernameNormalized,
        createdAt: minecraftAccounts.createdAt,
        updatedAt: minecraftAccounts.updatedAt,
        label: userMinecraftAccounts.label,
        isPrimary: userMinecraftAccounts.isPrimary,
        linkedAt: userMinecraftAccounts.createdAt,
      })
      .from(userMinecraftAccounts)
      .innerJoin(
        minecraftAccounts,
        eq(minecraftAccounts.id, userMinecraftAccounts.minecraftAccountId),
      )
      .where(eq(userMinecraftAccounts.userId, userId))
      .orderBy(desc(userMinecraftAccounts.isPrimary), desc(userMinecraftAccounts.createdAt))
      .limit(limit);
  }

  async updateLinkedMinecraftAccount(
    userId: string,
    minecraftAccountId: string,
    input: { label?: string | null; isPrimary?: boolean },
  ): Promise<LinkedMinecraftAccountRecord | null> {
    const set: { label?: string | null; isPrimary?: boolean } = {};
    if (input.label !== undefined) set.label = input.label;
    if (input.isPrimary !== undefined) set.isPrimary = input.isPrimary;
    if (Object.keys(set).length === 0) return this.getLinkedMinecraftAccount(userId, minecraftAccountId);

    const update = this.db
      .update(userMinecraftAccounts)
      .set(set)
      .where(and(
        eq(userMinecraftAccounts.userId, userId),
        eq(userMinecraftAccounts.minecraftAccountId, minecraftAccountId),
      ));

    if (input.isPrimary) {
      await this.db.batch([
        this.db
          .update(userMinecraftAccounts)
          .set({ isPrimary: false })
          .where(eq(userMinecraftAccounts.userId, userId)),
        update,
      ]);
    } else {
      await update;
    }
    return this.getLinkedMinecraftAccount(userId, minecraftAccountId);
  }

  async unlinkMinecraftAccount(userId: string, minecraftAccountId: string): Promise<boolean> {
    const profileIds = this.db
      .select({ id: skyblockProfiles.id })
      .from(skyblockProfiles)
      .where(eq(skyblockProfiles.minecraftAccountId, minecraftAccountId));
    const [, , deletedLinks] = await this.db.batch([
      this.db
        .update(savedBuilds)
        .set({ profileId: null, updatedAt: new Date() })
        .where(and(
          eq(savedBuilds.userId, userId),
          inArray(savedBuilds.profileId, profileIds),
        )),
      this.db
        .delete(savedProfiles)
        .where(and(
          eq(savedProfiles.userId, userId),
          inArray(savedProfiles.profileId, profileIds),
        )),
      this.db
        .delete(userMinecraftAccounts)
        .where(and(
          eq(userMinecraftAccounts.userId, userId),
          eq(userMinecraftAccounts.minecraftAccountId, minecraftAccountId),
        ))
        .returning({ accountId: userMinecraftAccounts.minecraftAccountId }),
    ]);
    return deletedLinks.length > 0;
  }

  private savedProfileDetailsQuery() {
    return this.db
      .select({
        userId: savedProfiles.userId,
        profileId: savedProfiles.profileId,
        alias: savedProfiles.alias,
        isPinned: savedProfiles.isPinned,
        createdAt: savedProfiles.createdAt,
        lastViewedAt: savedProfiles.lastViewedAt,
        minecraftAccountId: skyblockProfiles.minecraftAccountId,
        minecraftUuid: minecraftAccounts.minecraftUuid,
        lastKnownUsername: minecraftAccounts.lastKnownUsername,
        profileName: skyblockProfiles.profileName,
        cuteName: skyblockProfiles.cuteName,
        gameMode: skyblockProfiles.gameMode,
        dataState: skyblockProfiles.dataState,
        lastSuccessfulFetchAt: skyblockProfiles.lastSuccessfulFetchAt,
      })
      .from(savedProfiles)
      .innerJoin(skyblockProfiles, eq(skyblockProfiles.id, savedProfiles.profileId))
      .innerJoin(
        minecraftAccounts,
        eq(minecraftAccounts.id, skyblockProfiles.minecraftAccountId),
      );
  }

  private async getLinkedMinecraftAccount(
    userId: string,
    minecraftAccountId: string,
  ): Promise<LinkedMinecraftAccountRecord | null> {
    const [account] = await this.db
      .select({
        id: minecraftAccounts.id,
        minecraftUuid: minecraftAccounts.minecraftUuid,
        lastKnownUsername: minecraftAccounts.lastKnownUsername,
        usernameNormalized: minecraftAccounts.usernameNormalized,
        createdAt: minecraftAccounts.createdAt,
        updatedAt: minecraftAccounts.updatedAt,
        label: userMinecraftAccounts.label,
        isPrimary: userMinecraftAccounts.isPrimary,
        linkedAt: userMinecraftAccounts.createdAt,
      })
      .from(userMinecraftAccounts)
      .innerJoin(
        minecraftAccounts,
        eq(minecraftAccounts.id, userMinecraftAccounts.minecraftAccountId),
      )
      .where(and(
        eq(userMinecraftAccounts.userId, userId),
        eq(userMinecraftAccounts.minecraftAccountId, minecraftAccountId),
      ))
      .limit(1);
    return account ?? null;
  }
}
