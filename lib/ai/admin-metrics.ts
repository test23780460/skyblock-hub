import type { AiMetricRepository } from "./metrics";

export interface AiMetricPeriodSnapshot {
  since: string;
  requestCount: number;
  failureCount: number;
  failureRatePercent: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  averageLatencyMs: number;
  maximumLatencyMs: number;
  categories: Array<{
    category: string;
    requestCount: number;
    failureCount: number;
  }>;
}

export interface AiAdminMetricsSnapshot {
  generatedAt: string;
  last24Hours: AiMetricPeriodSnapshot;
  last30Days: AiMetricPeriodSnapshot;
  privacy: "aggregate-only";
}

export async function getAiAdminMetricsSnapshot(
  repository: Pick<AiMetricRepository, "getAiMetricSummary">,
  now = new Date(),
): Promise<AiAdminMetricsSnapshot> {
  const hourSince = startOfUtcHour(new Date(now.getTime() - 23 * 60 * 60_000));
  const daySince = startOfUtcDay(new Date(now.getTime() - 29 * 24 * 60 * 60_000));
  const [hours, days] = await Promise.all([
    repository.getAiMetricSummary({ provider: "openai", resolution: "hour", since: hourSince }),
    repository.getAiMetricSummary({ provider: "openai", resolution: "day", since: daySince }),
  ]);
  return {
    generatedAt: now.toISOString(),
    last24Hours: period(hourSince, hours),
    last30Days: period(daySince, days),
    privacy: "aggregate-only",
  };
}

export interface AdminAiMetricsHandlerDependencies {
  authEnabled: () => boolean;
  authenticate: (request: Request) => Promise<{ id: string } | null>;
  authorize: (identity: { id: string }) => boolean;
  load: () => Promise<AiAdminMetricsSnapshot>;
}

export function createAdminAiMetricsGetHandler(dependencies: AdminAiMetricsHandlerDependencies) {
  return async function GET(request: Request): Promise<Response> {
    if (!dependencies.authEnabled()) return adminError(503, "feature_disabled", "SkyPilot account authentication is not enabled in this environment.");
    const identity = await dependencies.authenticate(request);
    if (!identity) return adminError(401, "authentication_required", "Sign in to view administrator metrics.");
    if (!dependencies.authorize(identity)) return adminError(403, "forbidden", "This identity is not authorized for administrator metrics.");
    try {
      return adminJson({ data: await dependencies.load() });
    } catch {
      return adminError(503, "metrics_unavailable", "Aggregate AI metrics are temporarily unavailable.");
    }
  };
}

function period(
  since: Date,
  summary: Awaited<ReturnType<AiMetricRepository["getAiMetricSummary"]>>,
): AiMetricPeriodSnapshot {
  return {
    since: since.toISOString(),
    requestCount: summary.requestCount,
    failureCount: summary.failureCount,
    failureRatePercent: summary.requestCount > 0
      ? round(summary.failureCount / summary.requestCount * 100, 2)
      : 0,
    inputTokens: summary.inputTokens,
    outputTokens: summary.outputTokens,
    estimatedCostUsd: round(summary.estimatedCostUsd, 6),
    averageLatencyMs: summary.requestCount > 0
      ? Math.round(summary.latencyTotalMs / summary.requestCount)
      : 0,
    maximumLatencyMs: summary.latencyMaxMs,
    categories: summary.categories.slice(0, 12).map((category) => ({
      category: category.category.slice(0, 80),
      requestCount: category.requestCount,
      failureCount: category.failureCount,
    })),
  };
}

function startOfUtcHour(date: Date): Date {
  const result = new Date(date);
  result.setUTCMinutes(0, 0, 0);
  return result;
}

function startOfUtcDay(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function adminJson(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "cache-control": "private, no-store" } });
}

function adminError(status: number, code: string, message: string): Response {
  return adminJson({ error: { code, message } }, status);
}
