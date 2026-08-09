import type { AppDatabase } from "@/db";
import type { RepositoryProvider } from "../contracts";
import { DrizzleCacheMetadataRepository } from "./cache.repository";
import { DrizzleEconomyRepository } from "./economy.repository";
import { DrizzleFeatureRepository } from "./feature.repository";
import { DrizzleGoalRepository } from "./goal.repository";
import { DrizzleIdentityRepository } from "./identity.repository";
import { DrizzleJobRepository } from "./job.repository";
import { DrizzleProfileRepository } from "./profile.repository";
import { DrizzleTelemetryRepository } from "./telemetry.repository";
import { DrizzleUserContentRepository } from "./user-content.repository";

/**
 * The only composition point that knows the persistence implementation is Drizzle/D1.
 * Application services should depend on RepositoryProvider or narrower contracts.
 */
export function createDrizzleRepositoryProvider(db: AppDatabase): RepositoryProvider {
  return {
    identity: new DrizzleIdentityRepository(db),
    profiles: new DrizzleProfileRepository(db),
    goals: new DrizzleGoalRepository(db),
    userContent: new DrizzleUserContentRepository(db),
    economy: new DrizzleEconomyRepository(db),
    cacheMetadata: new DrizzleCacheMetadataRepository(db),
    features: new DrizzleFeatureRepository(db),
    jobs: new DrizzleJobRepository(db),
    telemetry: new DrizzleTelemetryRepository(db),
  };
}

export { DrizzleCacheMetadataRepository } from "./cache.repository";
export { DrizzleEconomyRepository } from "./economy.repository";
export { DrizzleFeatureRepository } from "./feature.repository";
export { DrizzleGoalRepository } from "./goal.repository";
export { DrizzleIdentityRepository } from "./identity.repository";
export { DrizzleJobRepository } from "./job.repository";
export { DrizzleProfileRepository } from "./profile.repository";
export { DrizzleTelemetryRepository } from "./telemetry.repository";
export { DrizzleUserContentRepository } from "./user-content.repository";
