import { and, eq, gte, isNull, lte, or } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import { featureFlags, featureOverrides } from "@/db/schema";
import type {
  FeatureFlagResult,
  FeatureOverrideInput,
  FeatureRepository,
} from "../contracts";

type OverrideRow = typeof featureOverrides.$inferSelect;

export class DrizzleFeatureRepository implements FeatureRepository {
  constructor(private readonly db: AppDatabase) {}

  async upsertFlag(input: Parameters<FeatureRepository["upsertFlag"]>[0]): Promise<void> {
    const values = {
      key: input.key,
      description: input.description,
      defaultEnabled: input.defaultEnabled ?? false,
      lifecycle: input.lifecycle ?? "production",
      defaultConfig: input.defaultConfig ?? null,
    } as const;

    await this.db
      .insert(featureFlags)
      .values(values)
      .onConflictDoUpdate({
        target: featureFlags.key,
        set: {
          description: values.description,
          defaultEnabled: values.defaultEnabled,
          lifecycle: values.lifecycle,
          defaultConfig: values.defaultConfig,
          updatedAt: new Date(),
        },
      });
  }

  async resolveFlag(
    key: string,
    scopes: { userId?: string; profileId?: string } = {},
    at = new Date(),
  ): Promise<FeatureFlagResult | null> {
    const [flag] = await this.db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.key, key))
      .limit(1);

    if (!flag) return null;

    const candidates: Array<{
      scopeType: "profile" | "user" | "global";
      scopeKey: string;
    }> = [];
    if (scopes.profileId) candidates.push({ scopeType: "profile", scopeKey: scopes.profileId });
    if (scopes.userId) candidates.push({ scopeType: "user", scopeKey: scopes.userId });
    candidates.push({ scopeType: "global", scopeKey: "global" });

    let override: OverrideRow | null = null;
    for (const candidate of candidates) {
      override = await this.findActiveOverride(key, candidate.scopeType, candidate.scopeKey, at);
      if (override) break;
    }

    return {
      key,
      enabled: override?.enabled ?? flag.defaultEnabled,
      lifecycle: flag.lifecycle,
      config: override?.config ?? flag.defaultConfig,
      source: override?.scopeType ?? "default",
    };
  }

  async setOverride(input: FeatureOverrideInput): Promise<void> {
    const values = {
      id: input.id,
      flagKey: input.flagKey,
      scopeType: input.scopeType,
      scopeKey: input.scopeKey,
      enabled: input.enabled,
      config: input.config ?? null,
      reason: input.reason ?? null,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      createdByUserId: input.createdByUserId ?? null,
    };

    await this.db
      .insert(featureOverrides)
      .values(values)
      .onConflictDoUpdate({
        target: [featureOverrides.flagKey, featureOverrides.scopeType, featureOverrides.scopeKey],
        set: {
          enabled: values.enabled,
          config: values.config,
          reason: values.reason,
          startsAt: values.startsAt,
          endsAt: values.endsAt,
          createdByUserId: values.createdByUserId,
          updatedAt: new Date(),
        },
      });
  }

  private async findActiveOverride(
    flagKey: string,
    scopeType: "global" | "user" | "profile",
    scopeKey: string,
    at: Date,
  ): Promise<OverrideRow | null> {
    const [override] = await this.db
      .select()
      .from(featureOverrides)
      .where(
        and(
          eq(featureOverrides.flagKey, flagKey),
          eq(featureOverrides.scopeType, scopeType),
          eq(featureOverrides.scopeKey, scopeKey),
          or(isNull(featureOverrides.startsAt), lte(featureOverrides.startsAt, at)),
          or(isNull(featureOverrides.endsAt), gte(featureOverrides.endsAt, at)),
        ),
      )
      .limit(1);
    return override ?? null;
  }
}
