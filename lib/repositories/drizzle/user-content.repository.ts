import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import { favorites, savedBuilds } from "@/db/schema";
import type { FavoriteInput, SavedBuildInput, UserContentRepository } from "../contracts";

export class DrizzleUserContentRepository implements UserContentRepository {
  constructor(private readonly db: AppDatabase) {}

  async saveBuild(input: SavedBuildInput): Promise<void> {
    await this.db
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
      .onConflictDoUpdate({
        target: savedBuilds.id,
        set: {
          profileId: input.profileId ?? null,
          title: input.title,
          description: input.description ?? null,
          visibility: input.visibility ?? "private",
          shareSlug: input.shareSlug ?? null,
          schemaVersion: input.schemaVersion ?? 1,
          isExperimental: input.isExperimental ?? true,
          build: input.build,
          updatedAt: new Date(),
        },
      });
  }

  async addFavorite(input: FavoriteInput): Promise<void> {
    await this.db
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
      });
  }

  async removeFavorite(userId: string, resourceType: string, resourceId: string): Promise<void> {
    await this.db
      .delete(favorites)
      .where(
        and(
          eq(favorites.userId, userId),
          eq(favorites.resourceType, resourceType),
          eq(favorites.resourceId, resourceId),
        ),
      );
  }
}
