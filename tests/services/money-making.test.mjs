import assert from "node:assert/strict";
import test from "node:test";

import {
  availableCoinsFromProfile,
  buildReferenceMoneyMakingMethods,
  moneyMakingFactsFromProfile,
} from "../../node_modules/.cache/skypilot-service-tests/lib/services/money-making.js";

function profile(gameMode = "Normal") {
  return {
    id: "profile-1",
    name: "Apple",
    gameMode,
    selected: true,
    lastSave: null,
    stats: [
      { key: "level", label: "SkyBlock Level", value: 100, unit: "level" },
      { key: "purse", label: "Purse", value: 5_000_000, unit: "coins" },
      { key: "bank", label: "Bank", value: 15_000_000, unit: "coins" },
      { key: "catacombs", label: "Catacombs", value: 25, unit: "level" },
      { key: "slayer", label: "Slayer", value: 75_000, unit: "xp" },
    ],
    skills: [
      { key: "farming", label: "Farming", level: 30, progress: 0 },
      { key: "mining", label: "Mining", level: 42, progress: 0 },
      { key: "fishing", label: "Fishing", level: 28, progress: 0 },
      { key: "combat", label: "Combat", level: 35, progress: 0 },
    ],
    gear: [],
    recommendations: [],
    strengths: [],
    weaknesses: [],
    unavailable: [],
  };
}

test("money-making service derives bounded visible profile facts and capital", () => {
  const result = moneyMakingFactsFromProfile(profile());
  assert.equal(result.skyBlockLevel, 100);
  assert.equal(result.farmingLevel, 30);
  assert.equal(result.catacombsLevel, 25);
  assert.equal(result.totalSlayerXp, 75_000);
  assert.equal(result.marketAccess, true);
  assert.equal(availableCoinsFromProfile(profile()), 20_000_000);
});

test("reference catalog covers every requested method family and requires explicit setup evidence", () => {
  const methods = buildReferenceMoneyMakingMethods(
    moneyMakingFactsFromProfile(profile()),
    new Set(["farming-crop"]),
  );
  assert.deepEqual(
    new Set(methods.map((method) => method.category)),
    new Set(["farming", "mining", "fishing", "dungeons", "slayers", "bazaar", "auction", "crafting", "npc", "other"]),
  );
  const farming = methods.find((method) => method.id === "farming-crop");
  const mining = methods.find((method) => method.id === "mining-route");
  assert.equal(farming.requirements.at(-1).met, true);
  assert.equal(mining.requirements.at(-1).met, false);
});

test("restricted profile modes block ordinary Bazaar and Auction readiness", () => {
  const methods = buildReferenceMoneyMakingMethods(
    moneyMakingFactsFromProfile(profile("Ironman")),
    new Set(["bazaar-orders", "auction-resale"]),
  );
  const bazaar = methods.find((method) => method.id === "bazaar-orders");
  const auction = methods.find((method) => method.id === "auction-resale");
  assert.equal(bazaar.requirements.find((requirement) => requirement.id === "bazaar-access").met, false);
  assert.equal(auction.requirements.find((requirement) => requirement.id === "auction-access").met, false);
});
