export type GoalCadence = "once" | "daily" | "weekly";
export type GoalLifecycleStatus = "active" | "paused" | "completed" | "archived";
export type GoalLifecycleAction = "update" | "complete" | "pause" | "resume" | "reset";

export interface GoalTargetState {
  current: number;
  target: number;
  initialCurrent: number;
  unit: string;
  cadence: GoalCadence;
}

export interface GoalCreateValues extends GoalTargetState {
  title: string;
}

export interface GoalLifecycleState {
  title: string;
  status: GoalLifecycleStatus;
  progressPercent: number;
  target: GoalTargetState;
  completedAt: Date | null;
}

export interface GoalLifecycleTransition extends GoalLifecycleState {
  action: GoalLifecycleAction;
}

export type GoalValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

type GoalUpdateValues = {
  action: GoalLifecycleAction;
  title?: string;
  current?: number;
  target?: number;
  unit?: string;
  cadence?: GoalCadence;
};

const CREATE_KEYS = new Set(["title", "current", "target", "unit", "cadence"]);
const UPDATE_KEYS = new Set(["action", "title", "current", "target", "unit", "cadence"]);

export function parseGoalCreate(value: unknown): GoalValidationResult<GoalCreateValues> {
  const record = objectRecord(value);
  if (!record || hasUnknownKeys(record, CREATE_KEYS)) return invalid("The goal request contains unsupported fields.");
  const title = boundedText(record.title, 80);
  const unit = boundedText(record.unit, 30);
  const current = nonNegativeNumber(record.current);
  const target = nonNegativeNumber(record.target);
  const cadence = goalCadence(record.cadence);
  if (!title || !unit || current === null || target === null || !cadence || target <= current) {
    return invalid("Use a title, unit, valid cadence, and a target greater than the current value.");
  }
  return {
    ok: true,
    value: { title, unit, current, target, initialCurrent: current, cadence },
  };
}

export function parseGoalUpdate(value: unknown): GoalValidationResult<GoalUpdateValues> {
  const record = objectRecord(value);
  if (!record || hasUnknownKeys(record, UPDATE_KEYS)) return invalid("The goal update contains unsupported fields.");
  const action = goalAction(record.action);
  if (!action) return invalid("Choose a supported goal action.");

  const mutableKeys = ["title", "current", "target", "unit", "cadence"] as const;
  const providedMutableKeys = mutableKeys.filter((key) => record[key] !== undefined);
  if (action !== "update" && providedMutableKeys.length > 0) {
    return invalid("Lifecycle actions cannot be combined with field updates.");
  }
  if (action === "update" && providedMutableKeys.length === 0) {
    return invalid("Provide at least one goal field to update.");
  }

  const result: GoalUpdateValues = { action };
  if (record.title !== undefined) {
    const title = boundedText(record.title, 80);
    if (!title) return invalid("Goal title must be between 1 and 80 characters.");
    result.title = title;
  }
  if (record.unit !== undefined) {
    const unit = boundedText(record.unit, 30);
    if (!unit) return invalid("Goal unit must be between 1 and 30 characters.");
    result.unit = unit;
  }
  if (record.current !== undefined) {
    const current = nonNegativeNumber(record.current);
    if (current === null) return invalid("Current progress must be a finite non-negative number.");
    result.current = current;
  }
  if (record.target !== undefined) {
    const target = nonNegativeNumber(record.target);
    if (target === null) return invalid("Target progress must be a finite non-negative number.");
    result.target = target;
  }
  if (record.cadence !== undefined) {
    const cadence = goalCadence(record.cadence);
    if (!cadence) return invalid("Cadence must be once, daily, or weekly.");
    result.cadence = cadence;
  }
  return { ok: true, value: result };
}

export function decodeGoalTarget(value: unknown): GoalTargetState | null {
  const record = objectRecord(value);
  if (!record) return null;
  const current = nonNegativeNumber(record.current);
  const target = nonNegativeNumber(record.target);
  const unit = boundedText(record.unit, 30);
  const cadence = goalCadence(record.cadence) ?? "once";
  if (current === null || target === null || target <= 0 || current > target || !unit) return null;
  const storedInitial = nonNegativeNumber(record.initialCurrent);
  const initialCurrent = storedInitial !== null && storedInitial < target
    ? Math.min(storedInitial, current)
    : 0;
  return { current, target, initialCurrent, unit, cadence };
}

export function initialGoalState(input: GoalCreateValues): GoalLifecycleState {
  return {
    title: input.title,
    status: "active",
    progressPercent: 0,
    target: {
      current: input.current,
      target: input.target,
      initialCurrent: input.initialCurrent,
      unit: input.unit,
      cadence: input.cadence,
    },
    completedAt: null,
  };
}

export function applyGoalUpdate(
  state: GoalLifecycleState,
  update: GoalUpdateValues,
  now = new Date(),
): GoalValidationResult<GoalLifecycleTransition> {
  const target = { ...state.target };
  let title = state.title;
  let status = state.status;
  let completedAt = state.completedAt;

  if (update.action === "complete") {
    target.current = target.target;
    status = "completed";
    completedAt = now;
  } else if (update.action === "pause") {
    if (status === "completed" || status === "archived") return invalid("Completed or archived goals cannot be paused.");
    status = "paused";
    completedAt = null;
  } else if (update.action === "resume") {
    if (status !== "paused" && status !== "active") return invalid("Only an active or paused goal can be resumed.");
    status = "active";
    completedAt = null;
  } else if (update.action === "reset") {
    target.current = target.initialCurrent;
    status = "active";
    completedAt = null;
  } else {
    if (status === "archived") return invalid("Archived goals cannot be edited; reset or delete this goal instead.");
    title = update.title ?? title;
    target.current = update.current ?? target.current;
    target.target = update.target ?? target.target;
    target.unit = update.unit ?? target.unit;
    target.cadence = update.cadence ?? target.cadence;
    if (target.target <= target.current) {
      if (target.target !== target.current) return invalid("Target progress must be greater than current progress.");
      status = "completed";
      completedAt = now;
    } else {
      target.initialCurrent = Math.min(target.initialCurrent, target.current);
      status = status === "paused" ? "paused" : "active";
      completedAt = null;
    }
  }

  return {
    ok: true,
    value: {
      action: update.action,
      title,
      status,
      progressPercent: progressPercent(target),
      target,
      completedAt,
    },
  };
}

export function progressPercent(target: GoalTargetState): number {
  const range = target.target - target.initialCurrent;
  if (range <= 0) return target.current >= target.target ? 100 : 0;
  return round(Math.max(0, Math.min(100, (target.current - target.initialCurrent) / range * 100)), 2);
}

function goalAction(value: unknown): GoalLifecycleAction | null {
  return value === "update" || value === "complete" || value === "pause" || value === "resume" || value === "reset"
    ? value
    : null;
}

function goalCadence(value: unknown): GoalCadence | null {
  return value === "once" || value === "daily" || value === "weekly" ? value : null;
}

function boundedText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  const text = value.trim();
  return text.length > 0 && text.length <= maxLength ? text : "";
}

function nonNegativeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function hasUnknownKeys(record: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(record).some((key) => !allowed.has(key));
}

function invalid<T>(message: string): GoalValidationResult<T> {
  return { ok: false, message };
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}
