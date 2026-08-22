import assert from "node:assert/strict";
import test from "node:test";

import {
  dungeonFloorCatalog,
  evaluateDungeonReadiness,
} from "../../dist/engine-tests/lib/engines/calculators/dungeon-readiness.js";

const metrics = [
  { id: "class-level", label: "Class level", current: 20, target: 20, unit: "level", weight: 2 },
  { id: "effective-health", label: "Effective health", current: 80_000, target: 100_000, unit: "EHP", weight: 3 },
  { id: "boss-damage", label: "Boss damage", current: 600_000, target: 500_000, unit: "damage", weight: 3 },
  { id: "secrets", label: "Secrets per run", current: 5, target: 8, unit: "secrets", weight: 1 },
  { id: "completion-rate", label: "Completion rate", current: 0.8, target: 0.9, unit: "ratio", weight: 2 },
];

test("dungeon readiness separates official entry gates from editable planning checkpoints", () => {
  const result = evaluateDungeonReadiness({
    floor: "f5",
    combatLevel: 30,
    catacombsLevel: 20,
    floorUnlocked: true,
    metrics,
  });
  assert.equal(result.entryEligible, true);
  assert.equal(result.officialMinimumCatacombsLevel, 14);
  assert.equal(result.readinessScore, 89.1);
  assert.equal(result.status, "confident");
  assert.deepEqual(result.deficiencies.map((item) => item.id), ["secrets", "effective-health", "completion-rate"]);
  assert.match(result.disclaimer, /unofficial/i);
  assert.match(result.disclaimer, /never guarantees/i);
});

test("locked floors never receive a ready status even when setup metrics are high", () => {
  const result = evaluateDungeonReadiness({
    floor: "m7",
    combatLevel: 60,
    catacombsLevel: 35,
    floorUnlocked: false,
    metrics: metrics.map((metric) => ({ ...metric, current: metric.target })),
  });
  assert.equal(result.entryEligible, false);
  assert.equal(result.status, "locked");
  assert.deepEqual(result.entryBlockers, ["Catacombs 36", "Required prior floor or mode completion"]);
  assert.equal(result.readinessScore, 100);
});

test("zero-target metrics are excluded rather than treated as failures", () => {
  const result = evaluateDungeonReadiness({
    floor: "f1",
    combatLevel: 15,
    catacombsLevel: 1,
    floorUnlocked: true,
    metrics: [
      { id: "class-level", label: "Class", current: 0, target: 0, unit: "level", weight: 1 },
      { id: "secrets", label: "Secrets", current: 4, target: 4, unit: "count", weight: 1 },
    ],
  });
  assert.equal(result.coveragePercent, 50);
  assert.equal(result.readinessScore, 100);
});

test("official floor catalog includes normal and Master Mode entry levels", () => {
  const catalog = dungeonFloorCatalog();
  assert.equal(catalog.length, 15);
  assert.equal(catalog.find((floor) => floor.id === "f7").minimumCatacombsLevel, 24);
  assert.equal(catalog.find((floor) => floor.id === "m7").minimumCatacombsLevel, 36);
});
