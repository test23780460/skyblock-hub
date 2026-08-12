import assert from "node:assert/strict";
import test from "node:test";

import { rankMoneyMakingMethods } from "../../dist/engine-tests/lib/engines/money-making.js";

const context = {
  availableCapital: 20_000_000,
  sessionHours: 2,
  riskTolerance: "medium",
  maximumDifficulty: 3,
};

test("money-making ranker chooses the best eligible scenario and exposes ranges", () => {
  const plan = rankMoneyMakingMethods([
    {
      id: "steady",
      name: "Steady method",
      category: "farming",
      expectedCoinsPerHour: 5_000_000,
      setupCost: 10_000_000,
      recurringCostPerHour: 500_000,
      difficulty: 2,
      risk: "low",
      attention: "active",
      requirements: [{ id: "setup", label: "Setup verified", met: true }],
    },
    {
      id: "slow",
      name: "Slow method",
      category: "npc",
      expectedCoinsPerHour: 1_000_000,
      setupCost: 1_000_000,
      difficulty: 1,
      risk: "low",
      attention: "semi-active",
      requirements: [{ id: "setup", label: "Setup verified", met: true }],
    },
  ], context);

  assert.equal(plan.bestReadyMethod?.id, "steady");
  assert.equal(plan.readyMethods.length, 2);
  assert.equal(plan.rankedMethods[0].expectedNetCoinsPerHour, 4_500_000);
  assert.equal(plan.rankedMethods[0].cautiousNetCoinsPerHour, 3_000_000);
  assert.equal(plan.rankedMethods[0].optimisticNetCoinsPerHour, 5_500_000);
  assert.equal(plan.rankedMethods[0].expectedSessionProfit, 9_000_000);
  assert.equal(plan.rankedMethods[0].setupReadinessPercent, 100);
});

test("unknown, missing, unaffordable, and over-difficulty inputs cannot claim readiness", () => {
  const plan = rankMoneyMakingMethods([
    {
      id: "blocked",
      name: "Blocked method",
      category: "dungeons",
      expectedCoinsPerHour: 20_000_000,
      setupCost: 30_000_000,
      difficulty: 5,
      risk: "high",
      attention: "active",
      requirements: [
        { id: "known", label: "Known missing", met: false },
        { id: "unknown", label: "Unknown gear", met: null },
      ],
    },
  ], context);

  const method = plan.rankedMethods[0];
  assert.equal(method.eligible, false);
  assert.equal(method.affordable, false);
  assert.equal(method.capitalShortfall, 10_000_000);
  assert.deepEqual(method.missingRequirements, ["Known missing"]);
  assert.deepEqual(method.unknownRequirements, ["Unknown gear"]);
  assert.equal(method.setupReadinessPercent, 0);
  assert.equal(method.knownRequirementPercent, 50);
  assert.match(method.explanation, /not ready/i);
  assert.equal(plan.bestReadyMethod, null);
});

test("risk and attention preferences affect ranking without fabricating eligibility", () => {
  const methods = [
    {
      id: "risky",
      name: "Risky",
      category: "auction",
      expectedCoinsPerHour: 5_100_000,
      setupCost: 0,
      difficulty: 2,
      risk: "high",
      attention: "active",
    },
    {
      id: "calm",
      name: "Calm",
      category: "npc",
      expectedCoinsPerHour: 5_000_000,
      setupCost: 0,
      difficulty: 2,
      risk: "low",
      attention: "passive",
    },
  ];
  const plan = rankMoneyMakingMethods(methods, {
    ...context,
    riskTolerance: "low",
    preferredAttention: ["passive"],
  });
  assert.equal(plan.rankedMethods[0].id, "calm");
  assert.equal(plan.readyMethods.length, 2);
});

test("money-making ranker handles an empty catalog and rejects malformed inputs", () => {
  assert.deepEqual(rankMoneyMakingMethods([], context).rankedMethods, []);
  assert.throws(
    () => rankMoneyMakingMethods([
      {
        id: "bad",
        name: "Bad",
        category: "other",
        expectedCoinsPerHour: -1,
        setupCost: 0,
        difficulty: 1,
        risk: "low",
        attention: "active",
      },
    ], context),
    /expectedCoinsPerHour/,
  );
  assert.throws(
    () => rankMoneyMakingMethods([
      {
        id: "same",
        name: "One",
        category: "other",
        expectedCoinsPerHour: 0,
        setupCost: 0,
        difficulty: 1,
        risk: "low",
        attention: "active",
      },
      {
        id: "same",
        name: "Two",
        category: "other",
        expectedCoinsPerHour: 0,
        setupCost: 0,
        difficulty: 1,
        risk: "low",
        attention: "active",
      },
    ], context),
    /duplicate method id/,
  );
});
