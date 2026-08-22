import { sameOriginMutationFailure } from "@/lib/auth/same-origin";
import {
  applyGoalUpdate,
  decodeGoalTarget,
  parseGoalUpdate,
  progressPercent,
} from "@/lib/goals/lifecycle";
import { readBoundedJson } from "@/lib/http/bounded-json";
import {
  authenticatedGoalContext,
  goalFailure,
  goalNotFound,
  goalView,
  invalidGoal,
  privateJson,
  safeGoalId,
} from "../shared";

type RouteContext = { params: Promise<{ goalId: string }> | { goalId: string } };

export async function GET(_request: Request, routeContext: RouteContext) {
  const goalId = safeGoalId((await routeContext.params).goalId);
  if (!goalId) return invalidGoal("The goal identifier is invalid.");
  const context = await authenticatedGoalContext();
  if (!context.ok) return context.response;
  try {
    const goal = await context.repositories.goals.getGoal(context.userId, goalId);
    if (!goal) return goalNotFound();
    const view = goalView(goal);
    return view ? privateJson({ data: { goal: view } }) : goalFailure(new Error("Goal data is malformed"));
  } catch (error) {
    return goalFailure(error);
  }
}

export async function PATCH(request: Request, routeContext: RouteContext) {
  const crossOrigin = sameOriginMutationFailure(request);
  if (crossOrigin) return crossOrigin;
  const goalId = safeGoalId((await routeContext.params).goalId);
  if (!goalId) return invalidGoal("The goal identifier is invalid.");
  const context = await authenticatedGoalContext();
  if (!context.ok) return context.response;
  const parsedBody = await readBoundedJson<unknown>(request, 8_192);
  if (!parsedBody.ok) return parsedBody.response;
  const parsedUpdate = parseGoalUpdate(parsedBody.value);
  if (!parsedUpdate.ok) return invalidGoal(parsedUpdate.message);

  try {
    const existing = await context.repositories.goals.getGoal(context.userId, goalId);
    if (!existing) return goalNotFound();
    const target = decodeGoalTarget(existing.target);
    if (!target) return goalFailure(new Error("Goal data is malformed"));
    const transition = applyGoalUpdate({
      title: existing.title,
      status: existing.status,
      progressPercent: progressPercent(target),
      target,
      completedAt: existing.completedAt,
    }, parsedUpdate.value);
    if (!transition.ok) return invalidGoal(transition.message);
    const updated = await context.repositories.goals.updateGoal(context.userId, goalId, {
      title: transition.value.title,
      goalType: transition.value.target.cadence === "once" ? "custom" : "recurring_task",
      status: transition.value.status,
      progressPercent: transition.value.progressPercent,
      target: { ...transition.value.target },
      completedAt: transition.value.completedAt,
    });
    if (!updated) return goalNotFound();
    const view = goalView(updated);
    if (!view) throw new Error("Updated goal could not be normalized");
    return privateJson({ data: { goal: view } });
  } catch (error) {
    return goalFailure(error);
  }
}

export async function DELETE(request: Request, routeContext: RouteContext) {
  const crossOrigin = sameOriginMutationFailure(request);
  if (crossOrigin) return crossOrigin;
  const goalId = safeGoalId((await routeContext.params).goalId);
  if (!goalId) return invalidGoal("The goal identifier is invalid.");
  const context = await authenticatedGoalContext();
  if (!context.ok) return context.response;
  try {
    const deleted = await context.repositories.goals.deleteGoal(context.userId, goalId);
    return deleted ? privateJson({ data: { deleted: true, goalId } }) : goalNotFound();
  } catch (error) {
    return goalFailure(error);
  }
}
