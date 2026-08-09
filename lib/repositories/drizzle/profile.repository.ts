import { desc, eq } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import {
  minecraftAccounts,
  savedProfiles,
  skyblockProfiles,
  userMinecraftAccounts,
} from "@/db/schema";
import type {
  MinecraftAccountRecord,
  ProfileRepository,
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
    await this.db
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
}
