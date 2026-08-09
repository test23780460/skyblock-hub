import { and, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import { cacheMetadata } from "@/db/schema";
import type { CacheMetadataRepository } from "../contracts";

export class DrizzleCacheMetadataRepository implements CacheMetadataRepository {
  constructor(private readonly db: AppDatabase) {}

  async upsert(input: Parameters<CacheMetadataRepository["upsert"]>[0]): Promise<void> {
    const values = {
      id: input.id,
      namespace: input.namespace,
      cacheKey: input.cacheKey,
      providerKey: input.providerKey ?? null,
      state: input.state,
      etag: input.etag ?? null,
      byteSize: input.byteSize ?? null,
      staleAt: input.staleAt,
      expiresAt: input.expiresAt,
      lastRefreshAt: input.lastRefreshAt ?? null,
      lastErrorCode: input.lastErrorCode ?? null,
    };

    await this.db
      .insert(cacheMetadata)
      .values(values)
      .onConflictDoUpdate({
        target: [cacheMetadata.namespace, cacheMetadata.cacheKey],
        set: {
          providerKey: values.providerKey,
          state: values.state,
          etag: values.etag,
          byteSize: values.byteSize,
          staleAt: values.staleAt,
          expiresAt: values.expiresAt,
          lastRefreshAt: values.lastRefreshAt,
          lastErrorCode: values.lastErrorCode,
          updatedAt: new Date(),
        },
      });
  }

  async recordAccess(
    namespace: string,
    cacheKey: string,
    hit: boolean,
    at = new Date(),
  ): Promise<void> {
    await this.db
      .update(cacheMetadata)
      .set(
        hit
          ? {
              hitCount: sql`${cacheMetadata.hitCount} + 1`,
              lastHitAt: at,
              updatedAt: at,
            }
          : {
              missCount: sql`${cacheMetadata.missCount} + 1`,
              updatedAt: at,
            },
      )
      .where(
        and(
          eq(cacheMetadata.namespace, namespace),
          eq(cacheMetadata.cacheKey, cacheKey),
        ),
      );
  }
}

