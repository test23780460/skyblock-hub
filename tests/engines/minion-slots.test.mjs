import assert from "node:assert/strict";
import test from "node:test";

import { optimizeNextMinionSlot } from "../../dist/engine-tests/lib/engines/calculators/minion-slots.js";

const candidates = [
  { id: "a-1", minionId: "a", minionName: "A", tier: 1, cost: 1, crafted: false },
  { id: "a-2", minionId: "a", minionName: "A", tier: 2, cost: 100, crafted: false },
  { id: "b-1", minionId: "b", minionName: "B", tier: 1, cost: 60, crafted: false },
  { id: "c-1", minionId: "c", minionName: "C", tier: 1, cost: 50, crafted: false },
];

test("minion slot optimizer finds the exact cheapest cross-family tier plan", () => {
  const result = optimizeNextMinionSlot({
    currentUniqueCrafts: 8,
    nextSlotAt: 10,
    candidates,
    budget: 50,
  });
  assert.equal(result.reachable, true);
  assert.deepEqual(result.plan.selectedCrafts.map((craft) => craft.id), ["a-1", "c-1"]);
  assert.equal(result.plan.totalCost, 51);
  assert.equal(result.plan.affordable, false);
  assert.equal(result.plan.budgetShortfall, 1);
  assert.equal(result.rankedPaths[0].target.id, "a-1");
});

test("minion tier paths include prerequisite craft costs", () => {
  const result = optimizeNextMinionSlot({
    currentUniqueCrafts: 0,
    nextSlotAt: 1,
    candidates,
  });
  const tierTwo = result.rankedPaths.find((path) => path.target.id === "a-2");
  assert.deepEqual(tierTwo.requiredCraftIds, ["a-1", "a-2"]);
  assert.equal(tierTwo.totalCost, 101);
  assert.equal(tierTwo.craftsGained, 2);
  assert.equal(tierTwo.immediatelyAvailable, false);
});

test("minion slot optimizer reports completed and unreachable targets explicitly", () => {
  const complete = optimizeNextMinionSlot({
    currentUniqueCrafts: 10,
    nextSlotAt: 10,
    candidates: [],
  });
  assert.equal(complete.plan.totalCost, 0);
  assert.equal(complete.craftsNeeded, 0);

  const unreachable = optimizeNextMinionSlot({
    currentUniqueCrafts: 0,
    nextSlotAt: 5,
    candidates: candidates.slice(0, 2),
  });
  assert.equal(unreachable.reachable, false);
  assert.equal(unreachable.plan, null);
});

test("minion slot optimizer rejects inconsistent crafted tier paths", () => {
  assert.throws(
    () => optimizeNextMinionSlot({
      currentUniqueCrafts: 1,
      nextSlotAt: 2,
      candidates: [
        { id: "a-1", minionId: "a", minionName: "A", tier: 1, cost: 1, crafted: false },
        { id: "a-2", minionId: "a", minionName: "A", tier: 2, cost: 1, crafted: true },
      ],
    }),
    /crafted tiers must form a prefix/,
  );
});
