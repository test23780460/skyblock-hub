import assert from "node:assert/strict";
import test from "node:test";

import { analyzeProfileRecommendations } from "../../node_modules/.cache/skypilot-service-tests/lib/services/profile-recommendations.js";
import { buildProgressionSummary } from "../../node_modules/.cache/skypilot-service-tests/lib/services/profile-progression.js";

function completeProfile() {
  return {
    id: "profile-1",
    name: "Apple",
    gameMode: "Normal",
    selected: true,
    lastSave: null,
    stats: [
      { key: "level", label: "SkyBlock Level", value: 200, unit: "level" },
      { key: "skill-average", label: "Skill Average", value: 40, unit: "level" },
      { key: "mp", label: "Magical Power", value: 700, unit: "count" },
      { key: "networth", label: "Estimated Net Worth", value: 1_000_000_000, unit: "coins" },
      { key: "catacombs", label: "Catacombs", value: 30, unit: "level" },
      { key: "slayer", label: "Slayer XP", value: 1_000_000, unit: "xp" },
      { key: "minions", label: "Minion Slots", value: 25, unit: "count" },
      { key: "museum", label: "Museum Completion", value: 50, unit: "percent" },
    ],
    skills: [
      { key: "farming", label: "Farming", level: 35, progress: 0, xp: 10_000_000 },
    ],
    gear: [
      { slot: "Armor", name: "Current armor", rarity: "LEGENDARY", status: "upgrade", note: "Missing a supported modifier." },
    ],
    recommendations: [
      {
        id: "accessories",
        title: "Buy efficient accessories",
        reason: "The profile reports an efficient account-wide improvement.",
        category: "Accessories",
        priority: "very-high",
        estimatedCost: 2_000_000,
        estimatedBenefit: "+20 Magical Power",
        prerequisites: ["Verify accessory family ownership"],
        badge: "BEST VALUE",
        href: "/accessories",
      },
      {
        id: "farming",
        title: "Improve farming equipment",
        reason: "The normalized recommendation reports a farming gap.",
        category: "Garden",
        priority: "medium",
        estimatedCost: 5_000_000,
        estimatedBenefit: "+10 Farming Fortune",
        prerequisites: [],
        badge: "HIGH IMPACT",
        href: "/garden",
      },
      {
        id: "unpriced-skill",
        title: "Train the weakest skill",
        reason: "Training requires a user-selected method.",
        category: "Skills",
        priority: "high",
        estimatedCost: null,
        estimatedBenefit: "Reach the next milestone",
        prerequisites: ["Choose a legitimate training method"],
        badge: "REQUIRES GRIND",
        href: "/skills",
      },
    ],
    strengths: ["Good baseline"],
    weaknesses: ["One skill trails the average"],
    unavailable: ["Inventory valuation unavailable"],
  };
}

test("complete profiles produce engine-ranked recommendations, budget plans, and a roadmap", () => {
  const result = analyzeProfileRecommendations(completeProfile(), {
    budget: 3_000_000,
    goals: ["accessories"],
  });

  assert.equal(result.progression?.complete, true);
  assert.equal(result.planningStageSource, "complete-score");
  assert.equal(result.rankedRecommendations.length, 2);
  assert.equal(result.rankedRecommendations[0].id, "accessories");
  assert.equal(result.rankedRecommendations[0].prerequisites[0].status, "unknown");
  assert.equal(result.rankedRecommendations[0].prerequisiteVerificationRequired, true);
  assert.equal(result.deferredRecommendations.length, 1);
  assert.equal(result.deferredRecommendations[0].reason, "missing-cost");
  assert.ok(result.budgetPlan.spent <= result.budgetPlan.budget);
  assert.deepEqual(
    result.budgetPlan.excludedRecommendationIdsWithoutPrices,
    ["unpriced-skill"],
  );
  assert.ok(result.roadmap.items.some((item) => item.source === "gear"));
  assert.ok(result.roadmap.items.some((item) => item.source === "weakness"));
  assert.ok(result.unavailable.includes("Inventory valuation unavailable"));
});

test("partial progression reweights available metrics instead of treating missing data as zero", () => {
  const profile = completeProfile();
  profile.stats = profile.stats.filter((stat) => ["level", "mp"].includes(stat.key));
  const summary = buildProgressionSummary(profile);

  assert.equal(summary.complete, false);
  assert.ok(summary.coverage > 0 && summary.coverage < 100);
  assert.deepEqual(summary.availableMetrics, ["SkyBlock Level", "Magical Power"]);
  assert.ok(summary.missingMetrics.includes("Estimated Net Worth"));
  assert.match(summary.disclaimer, /missing metrics are not treated as zero/i);
});

test("profiles with no progression context retain recommendations without pretending to rank them", () => {
  const profile = completeProfile();
  profile.stats = [];
  profile.skills = [];
  const result = analyzeProfileRecommendations(profile, { budget: 10_000_000 });

  assert.equal(result.progression, null);
  assert.equal(result.planningStage, null);
  assert.equal(result.rankedRecommendations.length, 0);
  assert.equal(result.budgetPlan, null);
  assert.equal(result.deferredRecommendations.length, profile.recommendations.length);
  assert.ok(
    result.deferredRecommendations.some(
      (item) => item.reason === "missing-progression-context",
    ),
  );
  assert.equal(
    result.roadmap.items.filter((item) => item.source === "recommendation").length,
    profile.recommendations.length,
  );
});

test("malformed normalized costs are deferred rather than dropped or treated as spendable", () => {
  const profile = completeProfile();
  profile.recommendations[0].estimatedCost = Number.NaN;
  const result = analyzeProfileRecommendations(profile, { budget: 10_000_000 });

  const deferred = result.deferredRecommendations.find(
    (item) => item.recommendation.id === "accessories",
  );
  const roadmapItem = result.roadmap.items.find(
    (item) => item.id === "accessories",
  );
  assert.equal(deferred?.reason, "missing-cost");
  assert.equal(roadmapItem?.estimatedCost, null);
  assert.equal(roadmapItem?.requiresPriceResearch, true);
  assert.ok(
    !result.budgetPlan.recommendations.some((item) => item.id === "accessories"),
  );
});
