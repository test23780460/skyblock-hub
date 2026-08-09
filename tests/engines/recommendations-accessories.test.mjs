import assert from "node:assert/strict";
import test from "node:test";

import { optimizeAccessories } from "../../dist/engine-tests/lib/engines/accessories.js";
import {
  buildBudgetUpgradePlan,
  rankUpgradeRecommendations,
} from "../../dist/engine-tests/lib/engines/recommendations.js";

const candidates = [
  {
    id: "accessory-pack",
    title: "Buy efficient accessories",
    category: "accessories",
    cost: 2_000_000,
    benefit: {
      amount: 25,
      unit: "Magical Power",
      description: "+25 MP",
      impactScore: 80,
    },
    rationale: "Magical Power improves many combat setups.",
    goalTags: ["magical power"],
  },
  {
    id: "farming-gear",
    title: "Upgrade farming equipment",
    category: "garden",
    cost: 5_000_000,
    benefit: {
      amount: 20,
      unit: "Farming Fortune",
      description: "+20 Fortune",
      impactScore: 60,
    },
    rationale: "More Fortune improves crop output.",
  },
  {
    id: "expensive-armor",
    title: "Buy expensive armor",
    category: "gear",
    cost: 20_000_000,
    benefit: {
      amount: 1,
      unit: "upgrade",
      description: "New set",
      impactScore: 90,
    },
    rationale: "The set is strong but over this budget.",
    marketDependent: true,
  },
  {
    id: "blocked-slayer",
    title: "Buy a locked slayer item",
    category: "slayer",
    cost: 100_000,
    benefit: {
      amount: 1,
      unit: "unlock",
      description: "Slayer unlock",
      impactScore: 95,
    },
    rationale: "Useful after unlocking it.",
    prerequisites: [{ description: "Reach Slayer 7", met: false }],
  },
];

test("recommendations prioritize impact and value while enforcing budget and prerequisites", () => {
  const ranked = rankUpgradeRecommendations(candidates, {
    stage: "mid",
    budget: 10_000_000,
    goals: ["magical power"],
  });

  assert.deepEqual(ranked.map((item) => item.id), ["accessory-pack", "farming-gear"]);
  assert.equal(ranked[0].costPerBenefitUnit, 80_000);
  assert.match(ranked[0].explanation, /strong value/i);

  const withBlocked = rankUpgradeRecommendations(candidates, {
    stage: "mid",
    budget: 10_000_000,
    includeBlocked: true,
  });
  const blocked = withBlocked.find((item) => item.id === "blocked-slayer");
  assert.equal(blocked?.eligible, false);
  assert.deepEqual(blocked?.unmetPrerequisites, ["Reach Slayer 7"]);
});

test("budget plans never overspend the aggregate budget", () => {
  const plan = buildBudgetUpgradePlan(candidates, {
    stage: "mid",
    budget: 6_000_000,
  });
  assert.ok(plan.spent <= plan.budget);
  assert.equal(plan.remaining, plan.budget - plan.spent);
  assert.ok(plan.recommendations.every((item) => item.eligible));
});

test("accessory optimizer finds the cheapest cross-family path instead of using a greedy ratio", () => {
  const result = optimizeAccessories({
    currentMagicalPower: 423,
    budget: 210,
    targetAdditionalMagicalPower: 20,
    accessories: [
      { id: "a-low", name: "A Low", familyId: "a", tier: 1, magicalPower: 10, cost: 100 },
      { id: "a-high", name: "A High", familyId: "a", tier: 2, magicalPower: 20, cost: 210 },
      { id: "b", name: "B", familyId: "b", tier: 1, magicalPower: 11, cost: 105 },
    ],
  });

  assert.equal(result.targetReached, true);
  assert.equal(result.spent, 205);
  assert.equal(result.magicalPowerGain, 21);
  assert.equal(result.resultingMagicalPower, 444);
  assert.deepEqual(result.selected.map((item) => item.id).sort(), ["a-low", "b"]);
});

test("owned accessory families only count incremental MP from an upgrade", () => {
  const result = optimizeAccessories({
    currentMagicalPower: 100,
    budget: 300,
    ownedAccessoryIds: ["ring"],
    accessories: [
      { id: "ring", name: "Ring", familyId: "ring-family", tier: 1, magicalPower: 5, cost: 50 },
      { id: "artifact", name: "Artifact", familyId: "ring-family", tier: 2, magicalPower: 12, cost: 300 },
    ],
  });

  assert.equal(result.magicalPowerGain, 7);
  assert.equal(result.selected[0].replacesAccessoryId, "ring");
});

