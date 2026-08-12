import type { TelemetryRepository } from "../repositories/contracts";
import type { AiMetricEvent, AiQuestionCategory } from "./types";

export type AiMetricRepository = Pick<TelemetryRepository, "incrementAiMetric" | "getAiMetricSummary">;

export interface AiCostRates {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
}

export function estimateAiCost(
  usage: { inputTokens: number; outputTokens: number } | null,
  rates: AiCostRates,
): number {
  if (!usage) return 0;
  const input = validRate(rates.inputUsdPerMillion);
  const output = validRate(rates.outputUsdPerMillion);
  return roundMoney((usage.inputTokens * input + usage.outputTokens * output) / 1_000_000);
}

/** Writes only aggregate buckets. No prompt, answer, user, profile, or IP is accepted. */
export async function recordAiMetricAggregates(
  repository: Pick<AiMetricRepository, "incrementAiMetric">,
  event: AiMetricEvent,
): Promise<void> {
  const provider = "openai";
  await Promise.all((["hour", "day"] as const).map(async (resolution) => {
    const windowStartedAt = metricWindow(event.occurredAt, resolution);
    await repository.incrementAiMetric({
      id: aiMetricId(provider, event.model, event.category, resolution, windowStartedAt),
      provider,
      model: event.model.slice(0, 120),
      category: event.category,
      resolution,
      windowStartedAt,
      requestCount: 1,
      failureCount: event.failed ? 1 : 0,
      inputTokens: safeInteger(event.inputTokens),
      outputTokens: safeInteger(event.outputTokens),
      estimatedCostUsd: Math.max(0, event.estimatedCostUsd),
      latencyTotalMs: safeInteger(event.latencyMs),
      latencyMaxMs: safeInteger(event.latencyMs),
    });
  }));
}

export function classifyAiQuestion(
  question: string,
  hint?: { calculatorKind?: string; hasEconomy?: boolean },
): AiQuestionCategory {
  const calculator = hint?.calculatorKind;
  if (calculator === "farming" || calculator === "garden") return "farming";
  if (calculator === "dungeon") return "dungeons";
  if (calculator === "slayer") return "slayers";
  if (calculator === "minion") return "minions";
  if (hint?.hasEconomy) return "economy";
  const normalized = question.toLowerCase();
  if (/\b(accessor(?:y|ies)|magical power|talisman|mp)\b/.test(normalized)) return "accessories";
  if (/\b(dungeon|catacombs|floor|master mode)\b/.test(normalized)) return "dungeons";
  if (/\b(bazaar|auction|price|flip|profit|market|money making)\b/.test(normalized)) return "economy";
  if (/\b(farm|farming|garden|fortune|crop)\b/.test(normalized)) return "farming";
  if (/\b(minion|slot)\b/.test(normalized)) return "minions";
  if (/\b(slayer|revenant|tarantula|sven|voidgloom|inferno|bloodfiend)\b/.test(normalized)) return "slayers";
  if (/\b(spend|budget|buy|upgrade armor|upgrade gear)\b/.test(normalized)) return "spending";
  if (/\b(next|progress|profile|weak|improve)\b/.test(normalized)) return "progression";
  return "general";
}

export function metricWindow(date: Date, resolution: "hour" | "day"): Date {
  const result = new Date(date);
  result.setUTCMinutes(0, 0, 0);
  if (resolution === "day") result.setUTCHours(0);
  return result;
}

export function parseCostRate(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function aiMetricId(
  provider: string,
  model: string,
  category: AiQuestionCategory,
  resolution: "hour" | "day",
  windowStartedAt: Date,
): string {
  const safeModel = model.toLowerCase().replace(/[^a-z0-9._-]+/g, "_").slice(0, 80) || "unknown";
  return `ai_${provider}_${safeModel}_${category}_${resolution}_${windowStartedAt.getTime()}`;
}

function validRate(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function safeInteger(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.min(Number.MAX_SAFE_INTEGER, Math.round(value)) : 0;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100_000_000) / 100_000_000;
}
