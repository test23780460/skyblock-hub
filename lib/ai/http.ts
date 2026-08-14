import { sameOriginMutationFailure } from "../auth/same-origin";
import { readBoundedJson } from "../http/bounded-json";
import { OpenAiProviderError } from "../providers/openai";
import { AiAnswerValidationError, groundedEvidence, parseGroundedAnswer } from "./answer";
import { AiContextError } from "./context";
import { classifyAiQuestion, estimateAiCost, type AiCostRates } from "./metrics";
import { parseAssistantRequest } from "./request";
import type {
  AiContextSelection,
  AiGroundedContext,
  AiMetricEvent,
  AiProviderResult,
  AssistantMode,
} from "./types";

export interface AiRouteIdentity {
  id: string;
}

export interface AiRouteDependencies {
  enabled: () => boolean;
  authRequired: () => boolean;
  authenticate: (request: Request) => Promise<AiRouteIdentity | null>;
  apiKey: () => string;
  model: () => string;
  costRates: () => AiCostRates;
  allowRequest: (key: string) => { allowed: boolean; retryAfterSeconds: number };
  resolveContext: (selection: AiContextSelection) => Promise<AiGroundedContext>;
  complete: (input: {
    apiKey: string;
    model: string;
    question: string;
    mode: AssistantMode;
    context: AiGroundedContext;
    safetyIdentifier?: string;
  }) => Promise<AiProviderResult>;
  recordMetric?: (event: AiMetricEvent) => Promise<void>;
  now?: () => Date;
  clock?: () => number;
  safetyIdentifier?: (secret: string, subject: string) => Promise<string>;
}

export function createAiPostHandler(dependencies: AiRouteDependencies) {
  return async function POST(request: Request): Promise<Response> {
    if (!dependencies.enabled()) {
      return aiError(503, "feature_disabled", "SkyPilot AI assistant is not enabled in this environment.");
    }
    const crossOrigin = sameOriginMutationFailure(request);
    if (crossOrigin) return crossOrigin;

    const identity = await dependencies.authenticate(request);
    if (dependencies.authRequired() && !identity) {
      return aiError(401, "authentication_required", "Sign in to use the SkyPilot assistant.", "Sign in and try again.");
    }

    const apiKey = dependencies.apiKey().trim();
    if (!apiKey) {
      return aiError(
        503,
        "ai_not_configured",
        "The SkyPilot assistant is not activated yet.",
        "An administrator must install a replacement OpenAI key in the server secret store. Every non-AI SkyPilot tool remains available.",
      );
    }

    const client = identity?.id || request.headers.get("cf-connecting-ip")?.trim().slice(0, 80) || "anonymous";
    const limit = dependencies.allowRequest(client);
    if (!limit.allowed) {
      return aiError(
        429,
        "ai_rate_limited",
        "You have reached the assistant's short-term request limit.",
        "Wait a moment before asking another question.",
        limit.retryAfterSeconds,
      );
    }

    const parsedBody = await readBoundedJson<unknown>(request, 32_768);
    if (!parsedBody.ok) return parsedBody.response;
    const parsed = parseAssistantRequest(parsedBody.value);
    if (!parsed.ok) return aiError(400, parsed.code, parsed.message);

    let context: AiGroundedContext;
    try {
      context = await dependencies.resolveContext(parsed.value.context);
    } catch (error) {
      if (error instanceof AiContextError) {
        return aiError(error.status, error.code, error.message, error.action);
      }
      return aiError(
        503,
        "context_unavailable",
        "The assistant could not resolve the selected SkyPilot context.",
        "Try again or remove optional context. Deterministic tools remain available.",
      );
    }

    const model = dependencies.model().trim() || "gpt-5.6-luna";
    const category = classifyAiQuestion(parsed.value.question, {
      calculatorKind: parsed.value.context.calculator?.kind,
      hasEconomy: parsed.value.context.economyProductIds.length > 0,
    });
    const started = dependencies.clock?.() ?? Date.now();
    const occurredAt = dependencies.now?.() ?? new Date();
    let providerResult: AiProviderResult | null = null;
    try {
      const safetySubject = (identity?.id || request.headers.get("cf-connecting-ip")?.trim())?.slice(0, 256);
      const safetyIdentifier = safetySubject
        ? await (dependencies.safetyIdentifier ?? createSafetyIdentifier)(apiKey, safetySubject)
        : undefined;
      providerResult = await dependencies.complete({
        apiKey,
        model,
        question: parsed.value.question,
        mode: parsed.value.mode,
        context,
        ...(safetyIdentifier ? { safetyIdentifier } : {}),
      });
      if (providerResult.refusal) {
        await record(dependencies, metricEvent({ model, category, failed: true, providerResult, latencyMs: elapsed(dependencies, started), occurredAt }));
        return aiError(
          422,
          "ai_refused",
          "The assistant could not answer that request.",
          "Ask for legitimate SkyBlock analysis or use a deterministic planning tool.",
        );
      }
      if (!providerResult.outputText) throw new AiAnswerValidationError("empty_output");
      const answer = parseGroundedAnswer(providerResult.outputText, context);
      const evidence = groundedEvidence(answer, context);
      await record(dependencies, metricEvent({ model, category, failed: false, providerResult, latencyMs: elapsed(dependencies, started), occurredAt }));
      return aiJson({
        data: {
          answer: answer.answer,
          mode: parsed.value.mode,
          category,
          evidence,
          assumptions: answer.assumptions,
          missingData: answer.missingData,
          context: {
            source: context.source,
            sourceLabel: context.sourceLabel,
            profile: context.profile,
            factCount: context.facts.length,
            limitations: context.limitations,
          },
          usage: providerResult.usage,
        },
      });
    } catch (error) {
      await record(dependencies, metricEvent({ model, category, failed: true, providerResult, latencyMs: elapsed(dependencies, started), occurredAt }));
      if (error instanceof OpenAiProviderError) {
        return aiError(
          error.status,
          error.code,
          error.message,
          "Try again shortly. Deterministic SkyPilot tools are still available.",
          error.retryAfterSeconds,
        );
      }
      if (error instanceof AiAnswerValidationError) {
        return aiError(
          502,
          "grounding_conflict",
          "The assistant response did not preserve SkyPilot's authoritative facts.",
          "No conflicting answer was shown. Try again or use the cited deterministic tool directly.",
        );
      }
      return aiError(
        503,
        "ai_unavailable",
        "The assistant is temporarily unavailable.",
        "Try again later or use the deterministic planning tools.",
      );
    }
  };
}

export class AiRequestLimiter {
  private readonly windows = new Map<string, { count: number; resetsAt: number }>();
  private checks = 0;

  constructor(
    private readonly options: {
      windowMs?: number;
      requestsPerWindow?: number;
      maxWindows?: number;
      now?: () => number;
    } = {},
  ) {}

  check(key: string): { allowed: boolean; retryAfterSeconds: number } {
    const windowMs = this.options.windowMs ?? 60_000;
    const requestsPerWindow = this.options.requestsPerWindow ?? 8;
    const maxWindows = this.options.maxWindows ?? 5_000;
    const now = this.options.now?.() ?? Date.now();
    this.checks += 1;
    if (this.checks % 64 === 0 || this.windows.size >= maxWindows) {
      for (const [candidate, window] of this.windows) {
        if (window.resetsAt <= now) this.windows.delete(candidate);
      }
    }
    const safeKey = key.trim().slice(0, 160) || "anonymous";
    const existing = this.windows.get(safeKey);
    if (!existing || existing.resetsAt <= now) {
      if (!existing && this.windows.size >= maxWindows) {
        const oldest = this.windows.keys().next().value as string | undefined;
        if (oldest) this.windows.delete(oldest);
      }
      this.windows.set(safeKey, { count: 1, resetsAt: now + windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (existing.count >= requestsPerWindow) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetsAt - now) / 1_000)) };
    }
    existing.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

export async function createSafetyIdentifier(secret: string, subject: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`skypilot-ai:${subject}`));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 64);
}

function metricEvent(input: {
  model: string;
  category: AiMetricEvent["category"];
  failed: boolean;
  providerResult: AiProviderResult | null;
  latencyMs: number;
  occurredAt: Date;
}): AiMetricEvent {
  const usage = input.providerResult?.usage;
  return {
    model: input.model,
    category: input.category,
    failed: input.failed,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    estimatedCostUsd: 0,
    latencyMs: input.latencyMs,
    occurredAt: input.occurredAt,
  };
}

function elapsed(dependencies: AiRouteDependencies, started: number): number {
  return Math.max(0, Math.round((dependencies.clock?.() ?? Date.now()) - started));
}

async function record(dependencies: AiRouteDependencies, event: AiMetricEvent): Promise<void> {
  if (!dependencies.recordMetric) return;
  event.estimatedCostUsd = estimateAiCost(
    { inputTokens: event.inputTokens, outputTokens: event.outputTokens },
    dependencies.costRates(),
  );
  try {
    await dependencies.recordMetric(event);
  } catch {
    // Aggregate telemetry is best-effort and must never break the assistant.
  }
}

function aiJson(data: unknown, status = 200, retryAfterSeconds?: number): Response {
  const headers = new Headers({ "cache-control": "private, no-store" });
  if (retryAfterSeconds) headers.set("retry-after", String(retryAfterSeconds));
  return Response.json(data, { status, headers });
}

function aiError(
  status: number,
  code: string,
  message: string,
  action?: string,
  retryAfterSeconds?: number,
): Response {
  return aiJson({ error: { code, message, ...(action ? { action } : {}), ...(retryAfterSeconds ? { retryAfterSeconds } : {}) } }, status, retryAfterSeconds);
}
