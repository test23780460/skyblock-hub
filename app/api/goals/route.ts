import { sameOriginMutationFailure } from "@/lib/auth/same-origin";
import { initialGoalState, parseGoalCreate } from "@/lib/goals/lifecycle";
import { readBoundedJson } from "@/lib/http/bounded-json";
import {
  authenticatedGoalContext,
  goalFailure,
  goalView,
  invalidGoal,
  MAX_SAVED_GOALS,
  privateJson,
  safeGoalStatus,
} from "./shared";

export async function GET(request: Request) {
  const context = await authenticatedGoalContext();
  if (!context.ok) return context.response;
  const status = safeGoalStatus(new URL(request.url).searchParams.get("status"));
  if (status === null) return invalidGoal("Choose a valid goal status filter.");
  try {
    const goals = await context.repositories.goals.listGoals(context.userId, status, MAX_SAVED_GOALS);
    const views = goals.flatMap((goal) => { const view = goalView(goal); return view ? [view] : []; });
    return privateJson({ data: { goals: views, meta: { returned: views.length, limit: MAX_SAVED_GOALS, skippedMalformed: goals.length - views.length } } });
  } catch (error) {
    return goalFailure(error);
  }
}

export async function POST(request: Request) {
  const crossOrigin = sameOriginMutationFailure(request);
  if (crossOrigin) return crossOrigin;
  const context = await authenticatedGoalContext();
  if (!context.ok) return context.response;
  const parsedBody = await readBoundedJson<unknown>(request, 8_192);
  if (!parsedBody.ok) return parsedBody.response;
  const parsedGoal = parseGoalCreate(parsedBody.value);
  if (!parsedGoal.ok) return invalidGoal(parsedGoal.message);

  try {
    const existing = await context.repositories.goals.listGoals(context.userId, undefined, MAX_SAVED_GOALS);
    if (existing.length >= MAX_SAVED_GOALS) {
      return privateJson({
        error: {
          code: "goal_limit_reached",
          message: `Delete an existing goal before saving more than ${MAX_SAVED_GOALS} goals.`,
        },
      }, 409);
    }
    const state = initialGoalState(parsedGoal.value);
    const created = await context.repositories.goals.createGoal({
      id: "goal_" + crypto.randomUUID(),
      userId: context.userId,
      goalType: state.target.cadence === "once" ? "custom" : "recurring_task",
      title: state.title,
      target: { ...state.target },
    });
    const view = goalView(created);
    if (!view) throw new Error("Created goal could not be normalized");
    return privateJson({ data: { goal: view } }, 201);
  } catch (error) {
    return goalFailure(error);
  }
}
