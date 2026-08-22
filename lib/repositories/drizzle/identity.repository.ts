import { and, eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import {
  analyticsEvents,
  externalIdentities,
  featureOverrides,
  userPreferences,
  users,
} from "@/db/schema";
import type {
  CanonicalUser,
  CreateUserInput,
  ExternalIdentityInput,
  IdentityRepository,
  JsonRecord,
} from "../contracts";

export class DrizzleIdentityRepository implements IdentityRepository {
  constructor(private readonly db: AppDatabase) {}

  async getUser(userId: string): Promise<CanonicalUser | null> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    return user ?? null;
  }

  async findUserByExternalIdentity(
    provider: string,
    providerSubject: string,
  ): Promise<CanonicalUser | null> {
    const [row] = await this.db
      .select({ user: users })
      .from(externalIdentities)
      .innerJoin(users, eq(users.id, externalIdentities.userId))
      .where(
        and(
          eq(externalIdentities.provider, provider),
          eq(externalIdentities.providerSubject, providerSubject),
        ),
      )
      .limit(1);

    return row?.user ?? null;
  }

  async deleteUserByExternalIdentity(
    provider: string,
    providerSubject: string,
  ): Promise<boolean> {
    const matchingUserIds = () => this.db
      .select({ userId: externalIdentities.userId })
      .from(externalIdentities)
      .where(and(
        eq(externalIdentities.provider, provider),
        eq(externalIdentities.providerSubject, providerSubject),
      ));

    const deleteUserOverrides = this.db
      .delete(featureOverrides)
      .where(and(
        eq(featureOverrides.scopeType, "user"),
        inArray(featureOverrides.scopeKey, matchingUserIds()),
      ));
    const deleteLinkedAnalytics = this.db
      .delete(analyticsEvents)
      .where(inArray(analyticsEvents.userId, matchingUserIds()));
    const deleteCanonicalUser = this.db
      .delete(users)
      .where(inArray(users.id, matchingUserIds()))
      .returning({ id: users.id });

    const [, , deletedUsers] = await this.db.batch([
      deleteUserOverrides,
      deleteLinkedAnalytics,
      deleteCanonicalUser,
    ]);
    return deletedUsers.length > 0;
  }

  async createUser(input: CreateUserInput): Promise<CanonicalUser> {
    const [user] = await this.db
      .insert(users)
      .values({ id: input.id, displayName: input.displayName ?? null })
      .returning();

    if (!user) {
      throw new Error("Failed to create canonical user");
    }
    return user;
  }

  async upsertExternalIdentity(input: ExternalIdentityInput): Promise<void> {
    await this.db
      .insert(externalIdentities)
      .values({
        id: input.id,
        userId: input.userId,
        provider: input.provider,
        providerSubject: input.providerSubject,
        emailNormalized: input.emailNormalized ?? null,
        providerData: input.providerData ?? null,
        lastLoginAt: input.lastLoginAt ?? null,
      })
      .onConflictDoUpdate({
        target: [externalIdentities.provider, externalIdentities.providerSubject],
        set: {
          userId: input.userId,
          emailNormalized: input.emailNormalized ?? null,
          providerData: input.providerData ?? null,
          lastLoginAt: input.lastLoginAt ?? null,
        },
      });
  }

  async setPreference(
    id: string,
    userId: string,
    namespace: string,
    key: string,
    value: JsonRecord,
  ): Promise<void> {
    await this.db
      .insert(userPreferences)
      .values({ id, userId, namespace, preferenceKey: key, value })
      .onConflictDoUpdate({
        target: [userPreferences.userId, userPreferences.namespace, userPreferences.preferenceKey],
        set: { value, updatedAt: new Date() },
      });
  }

  async getPreferences(userId: string, namespace: string): Promise<Record<string, JsonRecord>> {
    const rows = await this.db
      .select({ key: userPreferences.preferenceKey, value: userPreferences.value })
      .from(userPreferences)
      .where(
        and(eq(userPreferences.userId, userId), eq(userPreferences.namespace, namespace)),
      );

    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  async deletePreference(userId: string, namespace: string, key: string): Promise<boolean> {
    const deleted = await this.db
      .delete(userPreferences)
      .where(and(
        eq(userPreferences.userId, userId),
        eq(userPreferences.namespace, namespace),
        eq(userPreferences.preferenceKey, key),
      ))
      .returning({ id: userPreferences.id });
    return deleted.length > 0;
  }
}
