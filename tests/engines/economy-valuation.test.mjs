import assert from "node:assert/strict";
import test from "node:test";

import {
  rankBazaarFlips,
  scoreBazaarFlip,
} from "../../dist/engine-tests/lib/engines/bazaar.js";
import { aggregateNetWorth } from "../../dist/engine-tests/lib/engines/net-worth.js";
import { valueItem } from "../../dist/engine-tests/lib/engines/valuation.js";

test("Bazaar scoring accounts for fees and ranks liquid opportunities above theoretical illiquid margins", () => {
  const ranked = rankBazaarFlips([
    {
      productId: "LIQUID",
      displayName: "Liquid item",
      buyOrderPrice: 100,
      sellOfferPrice: 105,
      buyVolume: 500_000,
      sellVolume: 500_000,
      buyOrders: 100,
      sellOrders: 100,
      volatility: 0.1,
    },
    {
      productId: "ILLIQUID",
      displayName: "Illiquid item",
      buyOrderPrice: 1,
      sellOfferPrice: 100,
      buyVolume: 1,
      sellVolume: 1,
      buyOrders: 1,
      sellOrders: 1,
      volatility: 0.8,
    },
  ]);

  assert.equal(ranked[0].productId, "LIQUID");
  assert.equal(ranked[0].feesPerUnit, 1.31);
  assert.equal(ranked[0].netMarginPerUnit, 3.69);
  assert.ok(ranked[0].liquidityScore > ranked[1].liquidityScore);
  assert.match(ranked[0].disclaimer, /not guaranteed profit/i);
});

test("unprofitable Bazaar flips receive a zero opportunity score", () => {
  const result = scoreBazaarFlip({
    productId: "LOSS",
    displayName: "Loss",
    buyOrderPrice: 100,
    sellOfferPrice: 100.5,
    buyVolume: 10_000,
    sellVolume: 10_000,
  });
  assert.ok(result.netMarginPerUnit < 0);
  assert.equal(result.opportunityScore, 0);
  assert.equal(result.quality, "avoid");
});

test("item valuation rejects outliers and reports confidence and uncertainty", () => {
  const day = 86_400_000;
  const asOf = 200 * day;
  const result = valueItem({
    itemId: "TEST_SWORD",
    baseItemEstimate: 95_000_000,
    components: [
      { id: "recomb", label: "Recombobulator", estimatedValue: 5_000_000, realizableRate: 0.8 },
    ],
    historicalSales: [
      99_000_000,
      100_000_000,
      101_000_000,
      100_500_000,
      98_500_000,
      101_500_000,
      99_500_000,
      100_250_000,
      1_000_000_000,
    ].map((price, index) => ({ price, timestamp: asOf - index * day })),
    activeLowestBin: 101_000_000,
    asOf,
  });

  assert.equal(result.salesUsed, 8);
  assert.equal(result.salesRejectedAsOutliers, 1);
  assert.equal(result.confidence, "high");
  assert.ok(result.estimatedValue >= result.lowEstimate);
  assert.ok(result.estimatedValue <= result.highEstimate);
  assert.match(result.disclaimer, /not an exact sale price/i);

  const sparse = valueItem({ itemId: "RARE_VARIANT", baseItemEstimate: 5_000_000 });
  assert.equal(sparse.confidence, "low");
  assert.match(sparse.reasons.at(-1), /insufficient/i);
});

test("net worth aggregation de-duplicates assets and separates liquid value", () => {
  const result = aggregateNetWorth({
    balances: { purse: 100_000_000, bank: 50_000_000 },
    assets: [
      { id: "armor-1", category: "armor", unitValue: 200_000_000, confidence: "high" },
      { id: "pet-1", category: "pets", unitValue: 100_000_000, confidence: "medium" },
      { id: "armor-1", category: "storage", unitValue: 500_000_000, confidence: "low" },
      { id: "ignored", category: "museum", unitValue: 50_000_000, include: false },
    ],
  });

  assert.equal(result.label, "Estimated Net Worth");
  assert.equal(result.total, 450_000_000);
  assert.equal(result.liquidTotal, 150_000_000);
  assert.deepEqual(result.duplicateAssetIds, ["armor-1"]);
  assert.equal(result.excludedAssets, 1);
  assert.equal(result.confidence, "high");
});

