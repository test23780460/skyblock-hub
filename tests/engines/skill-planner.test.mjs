import assert from "node:assert/strict";
import test from "node:test";

import { estimateSkillLevelTarget } from "../../dist/engine-tests/lib/engines/calculators/skill.js";

test("core skill planner derives next level, target XP, hours, and sessions", () => {
  const result = estimateSkillLevelTarget({
    skill: "mining",
    currentLevel: 1.5,
    targetLevel: 2,
    baseXpPerHour: 50,
    xpBoostPercent: 25,
    hoursPerSession: 0.5,
  });
  assert.equal(result.currentXp, 112.5);
  assert.equal(result.targetXp, 175);
  assert.equal(result.xpToNextLevel, 62.5);
  assert.equal(result.effectiveXpPerHour, 62.5);
  assert.equal(result.hoursRemaining, 1);
  assert.equal(result.sessionsRemaining, 2);
  assert.equal(result.nextLevel, 2);
});

test("skill planner uses skill-specific caps and explicit zero-rate infinity", () => {
  const result = estimateSkillLevelTarget({
    skill: "fishing",
    currentLevel: 49,
    targetLevel: 50,
    baseXpPerHour: 0,
  });
  assert.equal(result.levelCap, 50);
  assert.equal(result.hoursRemaining, Number.POSITIVE_INFINITY);
  assert.throws(() => estimateSkillLevelTarget({
    skill: "fishing",
    currentLevel: 50,
    targetLevel: 51,
    baseXpPerHour: 1,
  }), /cannot exceed/);
});

test("completed or lower targets never produce negative XP or time", () => {
  const result = estimateSkillLevelTarget({
    skill: "alchemy",
    currentLevel: 40,
    targetLevel: 35,
    baseXpPerHour: 100,
    hoursPerSession: 1,
  });
  assert.equal(result.remainingXp, 0);
  assert.equal(result.hoursRemaining, 0);
  assert.equal(result.sessionsRemaining, 0);
  assert.equal(result.complete, true);
});
