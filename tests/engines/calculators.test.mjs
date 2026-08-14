import assert from "node:assert/strict";
import test from "node:test";

import { estimateDungeonRuns } from "../../dist/engine-tests/lib/engines/calculators/dungeon.js";
import { estimateFarmingLevelTarget, estimateFarmingXp } from "../../dist/engine-tests/lib/engines/calculators/farming.js";
import { estimateGardenYield } from "../../dist/engine-tests/lib/engines/calculators/garden.js";
import { estimateMinionProfit } from "../../dist/engine-tests/lib/engines/calculators/minion.js";
import { estimatePetXp } from "../../dist/engine-tests/lib/engines/calculators/pet.js";
import { estimateSlayerProgress } from "../../dist/engine-tests/lib/engines/calculators/slayer.js";

test("farming XP estimates account for boosts and daily play time", () => {
  const result = estimateFarmingXp({
    currentXp: 1_000_000,
    targetXp: 2_000_000,
    baseXpPerHour: 100_000,
    xpBoostPercent: 25,
    hoursPerDay: 2,
  });
  assert.equal(result.effectiveXpPerHour, 125_000);
  assert.equal(result.hoursRemaining, 8);
  assert.equal(result.daysRemaining, 4);
});

test("farming target planner accepts current and target levels on the centralized curve", () => {
  const result = estimateFarmingLevelTarget({
    currentLevel: 1,
    targetLevel: 2,
    baseXpPerHour: 125,
    hoursPerDay: 0.5,
  });
  assert.equal(result.currentXp, 50);
  assert.equal(result.targetXp, 175);
  assert.equal(result.remainingXp, 125);
  assert.equal(result.hoursRemaining, 1);
  assert.equal(result.daysRemaining, 2);
  assert.match(result.assumptions[0], /level 60/i);
});

test("pet XP estimates use an explicit skill conversion and pet boost", () => {
  const result = estimatePetXp({
    currentPetXp: 400_000,
    targetPetXp: 1_000_000,
    skillXpPerHour: 100_000,
    skillToPetXpRatio: 0.5,
    petXpBoostPercent: 20,
  });
  assert.equal(result.effectivePetXpPerHour, 60_000);
  assert.equal(result.hoursRemaining, 10);
});

test("garden yield combines general and crop-specific Fortune without hidden multipliers", () => {
  const result = estimateGardenYield({
    baseFortune: 100,
    cropSpecificFortune: 25,
    sources: [{ id: "tool", label: "Tool", fortune: 75 }],
    blocksPerHour: 10_000,
    baseDropsPerBlock: 1,
    coinValuePerItem: 4,
    budget: 1_000_000,
    upgrades: [
      { id: "cheap", name: "Cheap", fortuneGain: 10, cost: 100_000 },
      { id: "expensive", name: "Expensive", fortuneGain: 20, cost: 2_000_000 },
    ],
  });
  assert.equal(result.totalFortune, 200);
  assert.equal(result.expectedDropMultiplier, 3);
  assert.equal(result.guaranteedDropMultiplier, 3);
  assert.equal(result.extraDropChancePercent, 0);
  assert.equal(result.expectedItemsPerHour, 30_000);
  assert.equal(result.expectedGrossCoinsPerHour, 120_000);
  assert.equal(result.rankedUpgrades[0].id, "cheap");
  assert.equal(result.rankedUpgrades[0].incrementalItemsPerHour, 1_000);
  assert.equal(result.rankedUpgrades[0].affordable, true);
  assert.equal(result.rankedUpgrades[1].affordable, false);
});

test("minion profit exposes production and operating-cost assumptions", () => {
  const result = estimateMinionProfit({
    minionCount: 1,
    baseActionTimeSeconds: 10,
    itemsPerOutput: 1,
    sellPricePerItem: 100,
    durationHours: 1,
    operatingCostPerDay: 2_400,
  });
  assert.equal(result.expectedItems, 180);
  assert.equal(result.grossRevenue, 18_000);
  assert.equal(result.operatingCost, 100);
  assert.equal(result.netProfit, 17_900);
});

test("dungeon estimates distinguish successful completions from expected attempts", () => {
  const result = estimateDungeonRuns({
    currentCatacombsXp: 0,
    targetCatacombsXp: 1_000,
    catacombsXpPerCompletion: 250,
    minutesPerAttempt: 10,
    completionRate: 0.8,
    expectedRewardPerCompletion: 100_000,
    chestCostPerCompletion: 20_000,
    costPerAttempt: 10_000,
  });
  assert.equal(result.successfulCompletions, 4);
  assert.equal(result.expectedAttempts, 5);
  assert.equal(result.estimatedHours, 0.83);
  assert.equal(result.expectedNetProfit, 270_000);
});

test("slayer estimates calculate bosses, time, and expected net cost", () => {
  const result = estimateSlayerProgress({
    currentSlayerXp: 0,
    targetSlayerXp: 1_000,
    xpPerBoss: 100,
    secondsPerAttempt: 60,
    successRate: 0.8,
    costPerAttempt: 50_000,
    expectedDropValuePerKill: 20_000,
  });
  assert.equal(result.successfulBosses, 10);
  assert.equal(result.expectedAttempts, 13);
  assert.equal(result.estimatedHours, 0.22);
  assert.equal(result.expectedNetCost, 450_000);
});

test("calculators reject impossible zero-success assumptions", () => {
  assert.throws(
    () => estimateSlayerProgress({
      currentSlayerXp: 0,
      targetSlayerXp: 1_000,
      xpPerBoss: 100,
      secondsPerAttempt: 60,
      successRate: 0,
    }),
    /successRate must be greater than zero/,
  );
});
