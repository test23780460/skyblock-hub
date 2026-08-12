import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCraftFlip,
  compareNpcAndBazaar,
} from "../../dist/engine-tests/lib/engines/economy-methods.js";

test("craft flip calculation includes every ingredient, fixed cost, and sale fee", () => {
  const result = calculateCraftFlip({
    recipeId: "example",
    recipeName: "Example recipe",
    ingredients: [
      { id: "a", name: "A", quantity: 2, unitPrice: 100 },
      { id: "b", name: "B", quantity: 1, unitPrice: 50 },
    ],
    outputQuantity: 1,
    salePricePerOutput: 400,
    sellFeeRate: 0.1,
    fixedCosts: 10,
    recipeUnlocked: true,
  });
  assert.equal(result.ingredientCost, 250);
  assert.equal(result.totalCost, 260);
  assert.equal(result.grossRevenue, 400);
  assert.equal(result.saleFees, 40);
  assert.equal(result.netProfit, 100);
  assert.equal(result.returnOnCost, 0.3846);
  assert.equal(result.breakEvenSalePricePerOutput, 288.89);
  assert.equal(result.executable, true);
});

test("unverified recipes never claim an executable craft opportunity", () => {
  const result = calculateCraftFlip({
    recipeId: "unknown",
    recipeName: "Unknown",
    ingredients: [{ id: "a", name: "A", quantity: 1, unitPrice: 1 }],
    outputQuantity: 1,
    salePricePerOutput: 10,
    sellFeeRate: 0,
    recipeUnlocked: null,
  });
  assert.equal(result.profitable, true);
  assert.equal(result.executable, false);
  assert.deepEqual(result.blockers, ["Recipe unlock is unverified"]);
});

test("NPC and Bazaar comparison ranks only routes with verified limits and prices", () => {
  const result = compareNpcAndBazaar({
    productId: "example",
    productName: "Example",
    quantity: 10,
    npcBuyPrice: 100,
    npcSellPrice: 80,
    bazaarInstantBuyPrice: 70,
    bazaarInstantSellPrice: 120,
    bazaarSellFeeRate: 0.1,
    npcBuyLimitRemaining: 10,
    npcSellLimitRemaining: null,
  });
  assert.equal(result.bestEligibleRoute.id, "npc-to-bazaar");
  assert.equal(result.bestEligibleRoute.netProfit, 80);
  assert.equal(result.bestPositiveRoute.id, "npc-to-bazaar");
  const blocked = result.routes.find((route) => route.id === "bazaar-to-npc");
  assert.equal(blocked.eligible, false);
  assert.match(blocked.blockers[0], /unverified/i);
});

test("NPC limit prevents an otherwise profitable route from being presented as eligible", () => {
  const result = compareNpcAndBazaar({
    productId: "example",
    productName: "Example",
    quantity: 11,
    npcBuyPrice: 1,
    npcSellPrice: 0,
    bazaarInstantBuyPrice: 0,
    bazaarInstantSellPrice: 10,
    bazaarSellFeeRate: 0,
    npcBuyLimitRemaining: 10,
    npcSellLimitRemaining: 10,
  });
  const route = result.routes.find((entry) => entry.id === "npc-to-bazaar");
  assert.equal(route.netProfit, 99);
  assert.equal(route.eligible, false);
  assert.match(route.blockers.join(" "), /exceeds/i);
  assert.equal(result.bestPositiveRoute, null);
});
