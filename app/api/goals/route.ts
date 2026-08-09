import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { ensureCanonicalUser } from "@/lib/auth/canonical-user";
import { sameOriginMutationFailure } from "@/lib/auth/same-origin";
import { featureUnavailableResponse } from "@/lib/feature-access";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { createDrizzleRepositoryProvider } from "@/lib/repositories/drizzle";
import type { GoalRecord } from "@/lib/repositories/contracts";

type GoalPayload = {
  title?: unknown;
  current?: unknown;
  target?: unknown;
  unit?: unknown;
  cadence?: unknown;
};

function safeGoalPayload(value: GoalPayload) {
  const title = typeof value.title === "string" ? value.title.trim().slice(0, 80) : "";
  const unit = typeof value.unit === "string" ? value.unit.trim().slice(0, 30) : "";
  const current = typeof value.current === "number" && Number.isFinite(value.current) ? Math.max(0, value.current) : NaN;
  const target = typeof value.target === "number" && Number.isFinite(value.target) ? Math.max(0, value.target) : NaN;
  const cadence = value.cadence === "daily" || value.cadence === "weekly" ? value.cadence : "once";
  if (!title || !unit || !Number.isFinite(current) || !Number.isFinite(target) || target <= current) return null;
  return { title, unit, current, target, cadence };
}

function safeFailure(error: unknown): Response {
  const message = error instanceof Error ? error.message : "";
  const databaseUnavailable = message.includes("D1 binding") || message.includes("no such table");
  return Response.json({ error: { code: databaseUnavailable ? "persistence_not_ready" : "goal_operation_failed", message: databaseUnavailable ? "Goal persistence is not activated in this environment." : "SkyPilot could not complete the goal operation.", action: databaseUnavailable ? "Apply the included database migration during deployment." : "Try again shortly." } }, { status: databaseUnavailable ? 503 : 500 });
}

export async function GET() {
  const unavailable = featureUnavailableResponse("chatGptAuth");
  if (unavailable) return unavailable;
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ error: { code: "authentication_required", message: "Sign in to view saved goals." } }, { status: 401 });
  try {
    const repositories = createDrizzleRepositoryProvider(getDb());
    const user = await ensureCanonicalUser(repositories, identity);
    const goals = await repositories.goals.listGoals(user.id);
    return Response.json(
      { data: { goals: goals.flatMap((goal) => { const view = goalView(goal); return view ? [view] : []; }) } },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return safeFailure(error);
  }
}

function goalView(goal: GoalRecord) {
  const target = goal.target;
  const currentValue = finiteNonNegative(target.current);
  const targetValue = finiteNonNegative(target.target);
  const unit = typeof target.unit === "string" ? target.unit.trim().slice(0, 30) : "";
  const cadence = target.cadence === "daily" || target.cadence === "weekly" ? target.cadence : "once";
  if (currentValue === null || targetValue === null || targetValue <= currentValue || !unit) return null;
  return {
    id: goal.id,
    title: goal.title.trim().slice(0, 80),
    current: currentValue,
    target: targetValue,
    unit,
    cadence,
    persisted: true,
  };
}

function finiteNonNegative(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export async function POST(request: Request) {
  const unavailable = featureUnavailableResponse("chatGptAuth");
  if (unavailable) return unavailable;
  const crossOrigin = sameOriginMutationFailure(request);
  if (crossOrigin) return crossOrigin;
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ error: { code: "authentication_required", message: "Sign in to save goals." } }, { status: 401 });
  const parsed = await readBoundedJson<GoalPayload>(request, 8_192);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;
  const input = safeGoalPayload(body);
  if (!input) return Response.json({ error: { code: "invalid_goal", message: "Use a title, unit, and a target greater than the current value." } }, { status: 400 });
  try {
    const repositories = createDrizzleRepositoryProvider(getDb());
    const user = await ensureCanonicalUser(repositories, identity);
    const goalId = "goal_" + crypto.randomUUID();
    await repositories.goals.createGoal({ id: goalId, userId: user.id, goalType: input.cadence === "once" ? "custom" : "recurring_task", title: input.title, target: { current: input.current, target: input.target, unit: input.unit, cadence: input.cadence } });
    const remaining = input.target - input.current;
    const stepTitles = ["Verify current progress and prerequisites", "Reach the first quarter milestone", "Review rates, setup, and budget at halfway", "Complete the final milestone"];
    await Promise.all(stepTitles.map((title, position) => repositories.goals.addStep({ id: "step_" + crypto.randomUUID(), goalId, position, title, estimate: { targetValue: input.current + remaining * ((position + 1) / stepTitles.length), unit: input.unit } })));
    return Response.json({ data: { goal: { id: goalId, title: input.title, current: input.current, target: input.target, unit: input.unit, cadence: input.cadence, persisted: true } } }, { status: 201, headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return safeFailure(error);
  }
}
