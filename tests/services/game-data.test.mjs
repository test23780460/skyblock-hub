import assert from "node:assert/strict";
import test from "node:test";

import {
  crops,
  features,
  findCrop,
  findFeature,
  findRarity,
  findSkill,
  findSlayer,
  gameDataMetadata,
  rarities,
  skills,
  slayers,
} from "../../node_modules/.cache/skypilot-service-tests/lib/game-data/index.js";

test("central game catalogs use unique stable identifiers", () => {
  for (const catalog of [rarities, skills, crops, slayers, features]) {
    const ids = catalog.map((entry) => entry.id);
    assert.equal(new Set(ids).size, ids.length);
  }
  assert.equal(gameDataMetadata.schemaVersion, 1);
  assert.match(gameDataMetadata.note, /volatile prices.*versioned resource data/i);
});

test("catalog lookups normalize aliases without fabricating unknown entries", () => {
  assert.equal(findRarity("VERY SPECIAL")?.id, "very_special");
  assert.equal(findSkill("rune crafting")?.id, "runecrafting");
  assert.equal(findCrop("sugarcane")?.id, "sugar_cane");
  assert.equal(findSlayer("voidgloom")?.id, "enderman");
  assert.equal(findSlayer("Revenant Horror")?.id, "zombie");
  assert.equal(findFeature("/progression")?.engine, "progression");
  assert.equal(findCrop("future crop that is not configured"), undefined);
});

test("feature metadata names its data boundary and optional engine", () => {
  const acceptedSources = new Set([
    "profile",
    "economy",
    "manual",
    "profile-and-economy",
    "profile-or-manual",
  ]);
  assert.ok(features.every((feature) => acceptedSources.has(feature.dataSource)));
  assert.equal(findFeature("bazaar")?.dataSource, "economy");
  assert.equal(findFeature("calculators")?.dataSource, "manual");
});
