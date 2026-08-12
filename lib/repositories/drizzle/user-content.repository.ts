import { and, desc, eq, ne } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import { favorites, savedBuilds } from "@/db/schema";
import type {
  FavoriteInput,
  FavoriteRecord,
  SavedBuildInput,
  SavedBuildRecord,
  SavedBuildUpdateInput,
  UserContentRepository,
} from "../contracts";

export class DrizzleUserContentRepository implements UserContentRepository {
  constructor(private readonly db: AppDatabase) {}

  async createBuild(input: SavedBuildInput): Promise<SavedBuildRecord> {
    const [build] = await this.db
      .insert(savedBuilds)
      .values({
        id: input.id,
        userId: input.userId,
        profileId: input.profileId ?? null,
        title: input.title,
        description: input.description ?? null,
        visibility: input.visibility ?? "private",
        shareSlug: input.shareSlug ?? null,
        schemaVersion: input.schemaVersion ?? 1,
        isExperimental: input.isExperimental ?? true,
        build: input.build,
      })
      .returning();
    if (!build) throw new Error("Failed to create saved build");
    return build;
  }

  async getBuild(userId: string, buildId: string): Promise<SavedBuildRecord | null> {
    const [build] = await this.db
      .select()
      .from(savedBuilds)
      .where(and(eq(savedBuilds.userId, userId), eq(savedBuilds.id, buildId)))
      .limit(1);
    return build ?? null;
  }

  async listBuilds(userId: string, limit = 50): Promise<SavedBuildRecord[]> {
    return this.db
      .select()
      .from(savedBuilds)
      .where(eq(savedBuilds.userId, userId))
      .orderBy(desc(savedBuilds.updatedAt))
      .limit(limit);
  }

  async updateBuild(
    userId: string,
    buildId: string,
    input: SavedBuildUpdateInput,
  ): Promise<SavedBuildRecord | null> {
    const [build] = await this.db
      .update(savedBuilds)
      .set({
        profileId: input.profileId ?? null,
        title: input.title,
        description: input.description ?? null,
        visibility: input.visibility,
        shareSlug: input.shareSlug ?? null,
        schemaVersion: input.schemaVersion ?? 1,
        isExperimental: input.isExperimental ?? true,
        build: input.build,
        updatedAt: new Date(),
      })
      .where(and(eq(savedBuilds.userId, userId), eq(savedBuilds.id, buildId)))
      .returning();
    return build ?? null;
  }

  async deleteBuild(userId: string, buildId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(savedBuilds)
      .where(and(eq(savedBuilds.userId, userId), eq(savedBuilds.id, buildId)))
      .returning({ id: savedBuilds.id });
    return deleted.length > 0;
  }

  async findSharedBuild(shareSlug: string): Promise<SavedBuildRecord | null> {
    const [build] = await this.db
      .select()
      .from(savedBuilds)
      .where(and(
        eq(savedBuilds.shareSlug, shareSlug),
        ne(savedBuilds.visibility, "private"),
      ))
      .limit(1);
    return build ?? null;
  }

  async listPublicBuilds(limit = 24): Promise<SavedBuildRecord[]> {
    return this.db
      .select()
      .from(savedBuilds)
      .where(eq(savedBuilds.visibility, "public"))
      .orderBy(desc(savedBuilds.updatedAt))
      .limit(limit);
  }

  async addFavorite(input: FavoriteInput): Promise<FavoriteRecord> {
    const [favorite] = await this.db
      .insert(favorites)
      .values({
        id: input.id,
        userId: input.userId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        label: input.label ?? null,
      })
      .onConflictDoUpdate({
        target: [favorites.userId, favorites.resourceType, favorites.resourceId],
        set: { label: input.label ?? null },
      })
      .returning();
    if (!favorite) throw new Error("Failed to save favorite");
    return favorite;
  }

  async listFavorites(userId: string, limit = 100): Promise<FavoriteRecord[]> {
    return this.db
      .select()
      .from(favorites)
      .where(eq(favorites.userId, userId))
      .orderBy(desc(favorites.createdAt))
      .limit(limit);
  }

  async removeFavorite(
    userId: string,
    resourceType: string,
    resourceId: string,
  ): Promise<boolean> {
    const deleted = await this.db
      .delete(favorites)
      .where(
        and(
          eq(favorites.userId, userId),
          eq(favorites.resourceType, resourceType),
          eq(favorites.resourceId, resourceId),
        ),
      )
      .returning({ id: favorites.id });
    return deleted.length > 0;
  }
}
