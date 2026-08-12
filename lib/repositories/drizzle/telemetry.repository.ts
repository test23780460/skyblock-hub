import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import {
  adminAuditLogs,
  aiMetrics,
  analyticsEvents,
  apiMetrics,
  applicationErrors,
} from "@/db/schema";
import type { TelemetryRepository } from "../contracts";

export class DrizzleTelemetryRepository implements TelemetryRepository {
  constructor(private readonly db: AppDatabase) {}

  async recordAnalyticsEvent(
    input: Parameters<TelemetryRepository["recordAnalyticsEvent"]>[0],
  ): Promise<void> {
    await this.db.insert(analyticsEvents).values({
      id: input.id,
      eventName: input.eventName,
      userId: input.userId ?? null,
      anonymousIdHash: input.anonymousIdHash ?? null,
      route: input.route ?? null,
      properties: input.properties ?? null,
      occurredAt: input.occurredAt,
    });
  }

  async recordAdminAudit(
    input: Parameters<TelemetryRepository["recordAdminAudit"]>[0],
  ): Promise<void> {
    await this.db.insert(adminAuditLogs).values({
      id: input.id,
      adminUserId: input.adminUserId ?? null,
      action: input.action,
      outcome: input.outcome,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      requestId: input.requestId ?? null,
      ipHash: input.ipHash ?? null,
      details: input.details ?? null,
    });
  }

  async incrementApiMetric(
    input: Parameters<TelemetryRepository["incrementApiMetric"]>[0],
  ): Promise<void> {
    const values = {
      id: input.id,
      provider: input.provider,
      endpoint: input.endpoint,
      resolution: input.resolution,
      windowStartedAt: input.windowStartedAt,
      requestCount: input.requestCount ?? 0,
      successCount: input.successCount ?? 0,
      errorCount: input.errorCount ?? 0,
      rateLimitedCount: input.rateLimitedCount ?? 0,
      cacheHitCount: input.cacheHitCount ?? 0,
      latencyTotalMs: input.latencyTotalMs ?? 0,
      latencyMaxMs: input.latencyMaxMs ?? 0,
      rateLimitRemaining: input.rateLimitRemaining ?? null,
    };

    await this.db
      .insert(apiMetrics)
      .values(values)
      .onConflictDoUpdate({
        target: [
          apiMetrics.provider,
          apiMetrics.endpoint,
          apiMetrics.resolution,
          apiMetrics.windowStartedAt,
        ],
        set: {
          requestCount: sql`${apiMetrics.requestCount} + ${values.requestCount}`,
          successCount: sql`${apiMetrics.successCount} + ${values.successCount}`,
          errorCount: sql`${apiMetrics.errorCount} + ${values.errorCount}`,
          rateLimitedCount: sql`${apiMetrics.rateLimitedCount} + ${values.rateLimitedCount}`,
          cacheHitCount: sql`${apiMetrics.cacheHitCount} + ${values.cacheHitCount}`,
          latencyTotalMs: sql`${apiMetrics.latencyTotalMs} + ${values.latencyTotalMs}`,
          latencyMaxMs: sql`max(${apiMetrics.latencyMaxMs}, ${values.latencyMaxMs})`,
          rateLimitRemaining: values.rateLimitRemaining,
          updatedAt: new Date(),
        },
      });
  }

  async incrementAiMetric(
    input: Parameters<TelemetryRepository["incrementAiMetric"]>[0],
  ): Promise<void> {
    const values = {
      id: input.id,
      provider: input.provider,
      model: input.model,
      category: input.category ?? "general",
      resolution: input.resolution,
      windowStartedAt: input.windowStartedAt,
      requestCount: input.requestCount ?? 0,
      failureCount: input.failureCount ?? 0,
      inputTokens: input.inputTokens ?? 0,
      outputTokens: input.outputTokens ?? 0,
      estimatedCostUsd: input.estimatedCostUsd ?? 0,
      latencyTotalMs: input.latencyTotalMs ?? 0,
      latencyMaxMs: input.latencyMaxMs ?? 0,
    };

    await this.db
      .insert(aiMetrics)
      .values(values)
      .onConflictDoUpdate({
        target: [
          aiMetrics.provider,
          aiMetrics.model,
          aiMetrics.category,
          aiMetrics.resolution,
          aiMetrics.windowStartedAt,
        ],
        set: {
          requestCount: sql`${aiMetrics.requestCount} + ${values.requestCount}`,
          failureCount: sql`${aiMetrics.failureCount} + ${values.failureCount}`,
          inputTokens: sql`${aiMetrics.inputTokens} + ${values.inputTokens}`,
          outputTokens: sql`${aiMetrics.outputTokens} + ${values.outputTokens}`,
          estimatedCostUsd: sql`${aiMetrics.estimatedCostUsd} + ${values.estimatedCostUsd}`,
          latencyTotalMs: sql`${aiMetrics.latencyTotalMs} + ${values.latencyTotalMs}`,
          latencyMaxMs: sql`max(${aiMetrics.latencyMaxMs}, ${values.latencyMaxMs})`,
          updatedAt: new Date(),
        },
      });
  }

  async getAiMetricSummary(
    input: Parameters<TelemetryRepository["getAiMetricSummary"]>[0],
  ): Promise<Awaited<ReturnType<TelemetryRepository["getAiMetricSummary"]>>> {
    const filter = and(
      eq(aiMetrics.provider, input.provider),
      eq(aiMetrics.resolution, input.resolution),
      gte(aiMetrics.windowStartedAt, input.since),
    );
    const [totals] = await this.db
      .select({
        requestCount: sql<number>`coalesce(sum(${aiMetrics.requestCount}), 0)`,
        failureCount: sql<number>`coalesce(sum(${aiMetrics.failureCount}), 0)`,
        inputTokens: sql<number>`coalesce(sum(${aiMetrics.inputTokens}), 0)`,
        outputTokens: sql<number>`coalesce(sum(${aiMetrics.outputTokens}), 0)`,
        estimatedCostUsd: sql<number>`coalesce(sum(${aiMetrics.estimatedCostUsd}), 0)`,
        latencyTotalMs: sql<number>`coalesce(sum(${aiMetrics.latencyTotalMs}), 0)`,
        latencyMaxMs: sql<number>`coalesce(max(${aiMetrics.latencyMaxMs}), 0)`,
      })
      .from(aiMetrics)
      .where(filter);
    const categories = await this.db
      .select({
        category: aiMetrics.category,
        requestCount: sql<number>`coalesce(sum(${aiMetrics.requestCount}), 0)`,
        failureCount: sql<number>`coalesce(sum(${aiMetrics.failureCount}), 0)`,
      })
      .from(aiMetrics)
      .where(filter)
      .groupBy(aiMetrics.category)
      .orderBy(desc(sql`sum(${aiMetrics.requestCount})`), aiMetrics.category)
      .limit(20);

    return {
      requestCount: finiteNumber(totals?.requestCount),
      failureCount: finiteNumber(totals?.failureCount),
      inputTokens: finiteNumber(totals?.inputTokens),
      outputTokens: finiteNumber(totals?.outputTokens),
      estimatedCostUsd: finiteNumber(totals?.estimatedCostUsd),
      latencyTotalMs: finiteNumber(totals?.latencyTotalMs),
      latencyMaxMs: finiteNumber(totals?.latencyMaxMs),
      categories: categories.map((row) => ({
        category: row.category.slice(0, 80),
        requestCount: finiteNumber(row.requestCount),
        failureCount: finiteNumber(row.failureCount),
      })),
    };
  }

  async recordError(input: Parameters<TelemetryRepository["recordError"]>[0]): Promise<void> {
    await this.db
      .insert(applicationErrors)
      .values({
        id: input.id,
        fingerprint: input.fingerprint,
        source: input.source,
        severity: input.severity,
        errorCode: input.errorCode ?? null,
        safeMessage: input.safeMessage,
        context: input.context ?? null,
        firstSeenAt: input.occurredAt,
        lastSeenAt: input.occurredAt,
      })
      .onConflictDoUpdate({
        target: applicationErrors.fingerprint,
        set: {
          source: input.source,
          severity: input.severity,
          errorCode: input.errorCode ?? null,
          safeMessage: input.safeMessage,
          context: input.context ?? null,
          occurrenceCount: sql`${applicationErrors.occurrenceCount} + 1`,
          lastSeenAt: input.occurredAt,
          resolvedAt: null,
          updatedAt: new Date(),
        },
      });
  }
}

function finiteNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}
