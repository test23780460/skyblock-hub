import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCoins,
  parseCoins,
  tryParseCoins,
} from "../../dist/engine-tests/lib/engines/coins.js";
import {
  calculateProgression,
  stageForScore,
} from "../../dist/engine-tests/lib/engines/progression.js";

test("coin parsing accepts common SkyBlock budget notation without guessing malformed input", () => {
  assert.equal(parseCoins("~1.25B coins"), 1_250_000_000);
  assert.equal(parseCoins("2,500,000"), 2_500_000);
  assert.equal(parseCoins(".5m"), 500_000);
  assert.equal(tryParseCoins("1,20M"), null);
  assert.throws(() => parseCoins("-1m"), /cannot be negative/);
  assert.equal(parseCoins("-1m", { allowNegative: true }), -1_000_000);
});

test("coin formatting is compact, deterministic, and can show exact grouped values", () => {
  assert.equal(formatCoins(11_400_000), "11.4M");
  assert.equal(formatCoins(999_950, { maximumFractionDigits: 1 }), "1M");
  assert.equal(
    formatCoins(1_234_567.89, { compact: false, maximumFractionDigits: 2 }),
    "1,234,567.89",
  );
  assert.equal(formatCoins(500, { includeUnit: true }), "500 coins");
});

test("progression scoring is bounded, monotonic, and explicitly unofficial", () => {
  const early = calculateProgression({ skyblockLevel: 20, skillAverage: 8 });
  const advanced = calculateProgression({
    skyblockLevel: 350,
    skillAverage: 50,
    magicalPower: 1_100,
    netWorth: 12_000_000_000,
    catacombsLevel: 42,
    slayerXp: 8_000_000,
    minionSlots: 28,
    museumProgress: 0.8,
  });
  const capped = calculateProgression({
    skyblockLevel: 500,
    skillAverage: 60,
    magicalPower: 1_500,
    netWorth: 50_000_000_000,
    catacombsLevel: 50,
    slayerXp: 20_000_000,
    minionSlots: 31,
    museumProgress: 1,
  });

  assert.ok(advanced.score > early.score);
  assert.equal(capped.score, 100);
  assert.equal(capped.stage, "endgame");
  assert.equal(stageForScore(49.9), "mid");
  assert.match(advanced.disclaimer, /not an official Hypixel statistic/i);
  assert.equal(advanced.metrics.length, 8);
});

