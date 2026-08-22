import assert from "node:assert/strict";
import test from "node:test";
import {
  applyGoalUpdate,
  decodeGoalTarget,
  initialGoalState,
  parseGoalCreate,
  parseGoalUpdate,
} from "../../lib/goals/lifecycle";

test("goal creation accepts only bounded lifecycle fields", () => {
  const parsed = parseGoalCreate({
    title: "Farming 60",
    current: 48,
    target: 60,
    unit: "level",
    cadence: "once",
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    const state = initialGoalState(parsed.value);
    assert.equal(state.target.initialCurrent, 48);
    assert.equal(state.progressPercent, 0);
  }

  assert.equal(parseGoalCreate({
    title: "Forged owner",
    current: 0,
    target: 1,
    unit: "step",
    cadence: "once",
    userId: "another-user",
  }).ok, false);
});

test("goal updates compute progress from the saved starting point", () => {
  const state = initialGoalState({
    title: "Target",
    current: 10,
    target: 30,
    initialCurrent: 10,
    unit: "runs",
    cadence: "once",
  });
  const update = parseGoalUpdate({ action: "update", current: 20 });
  assert.equal(update.ok, true);
  if (!update.ok) return;
  const changed = applyGoalUpdate(state, update.value, new Date("2026-08-09T12:00:00.000Z"));
  assert.equal(changed.ok, true);
  if (changed.ok) {
    assert.equal(changed.value.status, "active");
    assert.equal(changed.value.progressPercent, 50);
    assert.equal(changed.value.completedAt, null);
  }
});

test("recurring goals complete a cycle and reset only on explicit action", () => {
  const state = initialGoalState({
    title: "Daily visitors",
    current: 0,
    target: 5,
    initialCurrent: 0,
    unit: "visitors",
    cadence: "daily",
  });
  const completeUpdate = parseGoalUpdate({ action: "complete" });
  assert.equal(completeUpdate.ok, true);
  if (!completeUpdate.ok) return;
  const completed = applyGoalUpdate(state, completeUpdate.value, new Date("2026-08-09T12:00:00.000Z"));
  assert.equal(completed.ok, true);
  if (!completed.ok) return;
  assert.equal(completed.value.status, "completed");
  assert.equal(completed.value.target.current, 5);
  assert.equal(completed.value.progressPercent, 100);

  const resetUpdate = parseGoalUpdate({ action: "reset" });
  assert.equal(resetUpdate.ok, true);
  if (!resetUpdate.ok) return;
  const reset = applyGoalUpdate(completed.value, resetUpdate.value);
  assert.equal(reset.ok, true);
  if (reset.ok) {
    assert.equal(reset.value.status, "active");
    assert.equal(reset.value.target.current, 0);
    assert.equal(reset.value.progressPercent, 0);
    assert.equal(reset.value.completedAt, null);
  }
});

test("goal mutations reject mixed actions and impossible targets", () => {
  assert.equal(parseGoalUpdate({ action: "complete", current: 3 }).ok, false);
  const state = initialGoalState({
    title: "Runs",
    current: 2,
    target: 10,
    initialCurrent: 2,
    unit: "runs",
    cadence: "weekly",
  });
  const update = parseGoalUpdate({ action: "update", current: 8, target: 7 });
  assert.equal(update.ok, true);
  if (update.ok) assert.equal(applyGoalUpdate(state, update.value).ok, false);
});

test("legacy goal targets decode without inventing recurrence history", () => {
  assert.deepEqual(decodeGoalTarget({ current: 4, target: 10, unit: "runs", cadence: "weekly" }), {
    current: 4,
    target: 10,
    initialCurrent: 0,
    unit: "runs",
    cadence: "weekly",
  });
});
