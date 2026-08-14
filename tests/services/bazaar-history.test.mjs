import assert from "node:assert/strict";
import test from "node:test";

import { buildBazaarHistoryView } from "../../node_modules/.cache/skypilot-service-tests/lib/services/bazaar-history.js";

test("Bazaar history service preserves canonical product identity and serializes buckets", () => {
  const view = buildBazaarHistoryView({
    productId: "ENCHANTED_CARROT",
    resolution: "hour",
    buckets: [{
      productId: "ENCHANTED_CARROT",
      resolution: "hour",
      bucketStartAt: new Date("2026-08-11T12:00:00.000Z"),
      firstSourceUpdatedAt: new Date("2026-08-11T12:05:00.000Z"),
      lastSourceUpdatedAt: new Date("2026-08-11T12:55:00.000Z"),
      sampleCount: 6,
      buyOpen: 100,
      buyHigh: 110,
      buyLow: 95,
      buyClose: 105,
      sellOpen: 110,
      sellHigh: 120,
      sellLow: 105,
      sellClose: 115,
      averageBuyVolume: 1_000,
      averageSellVolume: null,
    }],
  });

  assert.deepEqual(view.identity, {
    kind: "bazaar-product",
    productId: "ENCHANTED_CARROT",
    variantKey: null,
  });
  assert.equal(view.points[0].referenceClose, 110);
  assert.equal(view.points[0].averageSellVolume, null);
  assert.equal(view.summary?.sampleCount, 6);
});
