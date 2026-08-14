import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureCanonicalUser } from "@/lib/auth/canonical-user";
import { featureUnavailableResponse } from "@/lib/feature-access";
import { decodeGoalTarget, progressPercent } from "@/lib/goals/lifecycle";
import { createDrizzleRepositoryProvider } from "@/lib/repositories/drizzle";
import type { GoalRecord, GoalStatus, RepositoryProvider } from "@/lib/repositories/contracts";

export const MAX_SAVED_GOALS = 100;

type GoalContext = {
  ok: true;
  repositories: RepositoryProvider;
  userId: string;
};

type GoalContextFailure = { ok: false; response: Response };

export async function authenticatedGoalContext(): Promise<GoalContext | GoalContextFailure> {
  const unavailable = featureUnavailableResponse("chatGptAuth");
  if (unavailable) return { ok: false, response: unavailable };
  const identity = await getChatGPTUser();
  if (!identity) {
    return {
      ok: false,
      response: privateJson({ error: { code: "authentication_required", message: "Sign in to manage saved goals." } }, 401),
    };
  }
  try {
    const { getDb } = await import("@/db");
    const repositories = createDrizzleRepositoryProvider(getDb());
    const user = await ensureCanonicalUser(repositories, identity);
    return { ok: true, repositories, userId: user.id };
  } catch (error) {
    return { ok: false, response: goalFailure(error) };
  }
}

export function goalView(goal: GoalRecord) {
  const target = decodeGoalTarget(goal.target);
  const title = goal.title.trim().slice(0, 80);
  if (!target || !title) return null;
  return {
    id: goal.id,
    title,
    current: target.current,
    target: target.target,
    initialCurrent: target.initialCurrent,
    unit: target.unit,
    cadence: target.cadence,
    status: goal.status,
    progressPercent: progressPercent(target),
    completedAt: goal.completedAt?.toISOString() ?? null,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
    persisted: true,
    recurrence: target.cadence === "once"
      ? null
      : { manualResetRequired: true, nextCycleAction: "reset" as const },
  };
}

export function safeGoalId(value: string): string | null {
  const normalized = value.trim();
  return /^goal_[A-Za-z0-9-]{1,64}$/.test(normalized) ? normalized : null;
}

export function safeGoalStatus(value: string | null): GoalStatus | undefined | null {
  if (value === null || value === "") return undefined;
  return value === "active" || value === "paused" || value === "completed" || value === "archived"
    ? value
    : null;
}

export function goalNotFound(): Response {
  return privateJson({ error: { code: "goal_not_found", message: "That goal was not found." } }, 404);
}

export function invalidGoal(message: string): Response {
  return privateJson({ error: { code: "invalid_goal", message } }, 400);
}

export function goalFailure(error: unknown): Response {
  const message = error instanceof Error ? error.message : "";
  const databaseUnavailable = message.includes("D1 binding") || message.includes("no such table");
  return privateJson({
    error: {
      code: databaseUnavailable ? "persistence_not_ready" : "goal_operation_failed",
      message: databaseUnavailable
        ? "Goal persistence is not activated in this environment."
        : "SkyPilot could not complete the goal operation.",
      action: databaseUnavailable
        ? "Activate the database binding and apply the included migrations."
        : "Try again shortly.",
    },
  }, databaseUnavailable ? 503 : 500);
}

export function privateJson(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}
