import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateDungeonForProfile,
  calculateFarmingForProfile,
  calculateMinionPlan,
  calculatePetPlan,
  calculateSlayerForProfile,
} from "../../node_modules/.cache/skypilot-service-tests/lib/services/calculators.js";

function profile() {
  return {
    id: "profile",
    name: "Apple",
    gameMode: "Normal",
    selected: true,
    lastSave: null,
    stats: [
      { key: "catacombs", label: "Catacombs", value: 30, unit: "level" },
      { key: "slayer", label: "Slayer XP", value: 400, unit: "xp" },
    ],
    skills: [
      { key: "farming", label: "Farming", level: 20, progress: 0, xp: 400_000 },
    ],
    gear: [],
    recommendations: [],
    strengths: [],
    weaknesses: [],
    unavailable: [],
  };
}

test("farming adapter prefills exact normalized XP and records provenance", () => {
  const result = calculateFarmingForProfile(profile(), {
    targetXp: 1_000_000,
    baseXpPerHour: 100_000,
  });
  assert.equal(result.status, "ready");
  assert.equal(result.result.remainingXp, 600_000);
  assert.equal(result.inputSources.currentXp, "profile");
});

test("dungeon adapter does not convert a normalized level into unversioned XP", () => {
  const unavailable = calculateDungeonForProfile(profile(), {
    targetCatacombsXp: 10_000,
    catacombsXpPerCompletion: 1_000,
    minutesPerAttempt: 10,
  });
  assert.equal(unavailable.status, "unavailable");
  assert.match(unavailable.reason, /level is not converted to XP/i);

  const manual = calculateDungeonForProfile(profile(), {
    currentCatacombsXp: 5_000,
    targetCatacombsXp: 10_000,
    catacombsXpPerCompletion: 1_000,
    minutesPerAttempt: 10,
  });
  assert.equal(manual.status, "ready");
  assert.equal(manual.inputSources.currentCatacombsXp, "manual");
});

test("Slayer adapter uses normalized aggregate XP when available", () => {
  const result = calculateSlayerForProfile(profile(), {
    targetSlayerXp: 1_000,
    xpPerBoss: 100,
    secondsPerAttempt: 60,
  });
  assert.equal(result.status, "ready");
  assert.equal(result.result.successfulBosses, 6);
  assert.equal(result.inputSources.currentSlayerXp, "profile");
});

test("manual-only pet and minion adapters never imply profile-derived values", () => {
  const pet = calculatePetPlan({
    currentPetXp: 0,
    targetPetXp: 100_000,
    skillXpPerHour: 50_000,
    skillToPetXpRatio: 1,
  });
  assert.equal(pet.status, "ready");
  assert.equal(pet.inputSources.currentPetXp, "manual");
  assert.match(pet.warnings[0], /no profile value was inferred/i);

  const minion = calculateMinionPlan({
    minionCount: 1,
    baseActionTimeSeconds: 10,
    itemsPerOutput: 1,
    sellPricePerItem: 10,
  });
  assert.equal(minion.status, "ready");
  assert.equal(minion.inputSources.sellPricePerItem, "manual");
});
