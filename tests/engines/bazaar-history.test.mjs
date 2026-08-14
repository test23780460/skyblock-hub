import assert from "node:assert/strict";
import test from "node:test";

import { summarizeBazaarHistory } from "../../dist/engine-tests/lib/engines/bazaar-history.js";

test("Bazaar history summary derives midpoint movement from ordered durable buckets", () => {
  const result = summarizeBazaarHistory([
    {
      at: 2_000,
      buyHigh: 120,
      buyLow: 105,
      buyClose: 115,
      sellHigh: 130,
      sellLow: 115,
      sellClose: 125,
      sampleCount: 3,
    },
    {
      at: 1_000,
      buyHigh: 110,
      buyLow: 90,
      buyClose: 100,
      sellHigh: 120,
      sellLow: 100,
      sellClose: 110,
      sampleCount: 2,
    },
  ]);

  assert.deepEqual(result, {
    firstReference: 105,
    latestReference: 120,
    periodLow: 95,
    periodHigh: 125,
    absoluteChange: 15,
    percentChange: 14.29,
    meanAbsoluteMovementPercent: 14.29,
    direction: "up",
    bucketCount: 2,
    sampleCount: 5,
  });
});

test("Bazaar history summary is explicit about empty and invalid evidence", () => {
  assert.equal(summarizeBazaarHistory([]), null);
  assert.throws(
    () => summarizeBazaarHistory([{
      at: 1_000,
      buyHigh: 90,
      buyLow: 80,
      buyClose: 100,
      sellHigh: 100,
      sellLow: 90,
      sellClose: 95,
      sampleCount: 1,
    }]),
    /OHLC bounds/,
  );
});
