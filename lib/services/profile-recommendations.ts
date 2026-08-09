import {
  buildBudgetUpgradePlan,
  rankUpgradeRecommendations,
  type ProgressionStage,
  type RecommendationBadge as EngineBadge,
  type RecommendationCategory,
  type RecommendationPriority as EnginePriority,
  type RankedRecommendation,
  type UpgradeCandidate,
} from "../engines/index.js";
import type {
  Recommendation as ModelRecommendation,
  RecommendationPriority as ModelPriority,
  SkyBlockProfile,
} from "../models.js";
import {
  buildProgressionSummary,
  type ProfileProgressionSummary,
} from "./profile-progression.js";
import {
  buildFixMyProfileRoadmap,
  type FixMyProfileRoadmap,
} from "./profile-roadmap.js";

export interface ProfileRecommendationOptions {
  budget?: number;
  goals?: readonly string[];
  stageOverride?: ProgressionStage;
}

export interface RankedProfileRecommendation {
  id: string;
  title: string;
  category: string;
  href: string;
  reason: string;
  estimatedCost: number;
  estimatedBenefit: string;
  reportedPriority: ModelPriority;
  reportedBadge: ModelRecommendation["badge"];
  score: number;
  enginePriority: EnginePriority;
  engineBadges: EngineBadge[];
  costPerBenefitUnit: number | null;
  prerequisites: readonly { description: string; status: "unknown" }[];
  prerequisiteVerificationRequired: boolean;
}

export interface DeferredProfileRecommendation {
  recommendation: ModelRecommendation;
  reason: "missing-cost" | "missing-progression-context";
}

export interface ProfileBudgetPlan {
  budget: number;
  spent: number;
  remaining: number;
  totalImpactScore: number;
  recommendations: RankedProfileRecommendation[];
  excludedRecommendationIdsWithoutPrices: string[];
  note: string;
}

export interface ProfileRecommendationAnalysis {
  profileId: string;
  progression: ProfileProgressionSummary | null;
  planningStage: ProgressionStage | null;
  planningStageSource: "complete-score" | "available-metrics" | "override" | "unavailable";
  rankedRecommendations: RankedProfileRecommendation[];
  deferredRecommendations: DeferredProfileRecommendation[];
  budgetPlan: ProfileBudgetPlan | null;
  roadmap: FixMyProfileRoadmap;
  unavailable: string[];
}

/**
 * Integrates normalized profile data with deterministic engines. Missing
 * prices, prerequisite status, and profile fields remain explicit unknowns;
 * they are never converted to zero-cost or completed requirements.
 */
export function analyzeProfileRecommendations(
  profile: SkyBlockProfile,
  options: ProfileRecommendationOptions = {},
): ProfileRecommendationAnalysis {
  const progression = buildProgressionSummary(profile);
  const planningStage = options.stageOverride ?? progression?.stage ?? null;
  const planningStageSource = options.stageOverride
    ? "override"
    : progression?.complete
      ? "complete-score"
      : progression
        ? "available-metrics"
        : "unavailable";
  const pricedRecommendations = profile.recommendations.filter(
    (recommendation) => knownNonNegative(recommendation.estimatedCost) !== null,
  );
  const candidates = pricedRecommendations.map(toUpgradeCandidate);
  const rankedEngineRecommendations = planningStage
    ? rankUpgradeRecommendations(candidates, {
        stage: planningStage,
        goals: options.goals,
        includeUnaffordable: true,
      })
    : [];
  const sourceById = new Map(
    profile.recommendations.map((recommendation) => [recommendation.id, recommendation]),
  );
  const rankedRecommendations = rankedEngineRecommendations.map((ranked) =>
    toRankedView(ranked, sourceById.get(ranked.id)!),
  );
  const deferredRecommendations = profile.recommendations
    .filter(
      (recommendation) =>
        knownNonNegative(recommendation.estimatedCost) === null ||
        planningStage === null,
    )
    .map((recommendation) => ({
      recommendation,
      reason:
        knownNonNegative(recommendation.estimatedCost) === null
          ? "missing-cost"
          : "missing-progression-context",
    }) satisfies DeferredProfileRecommendation)
    .sort(compareDeferredRecommendations);

  const budgetPlan =
    options.budget !== undefined && planningStage !== null
      ? buildProfileBudgetPlan(
          candidates,
          sourceById,
          planningStage,
          options.budget,
          options.goals,
          profile.recommendations
            .filter(
              (recommendation) =>
                knownNonNegative(recommendation.estimatedCost) === null,
            )
            .map((recommendation) => recommendation.id),
        )
      : null;
  const roadmap = buildFixMyProfileRoadmap(profile, rankedRecommendations);
  const unavailable = new Set(profile.unavailable);
  if (!progression) {
    unavailable.add(
      "Progression scoring is unavailable because none of the normalized progression metrics are present.",
    );
  } else if (!progression.complete) {
    unavailable.add(
      `Progression coverage is partial; missing: ${progression.missingMetrics.join(", ")}.`,
    );
  }
  if (deferredRecommendations.some((item) => item.reason === "missing-cost")) {
    unavailable.add(
      "Recommendations without verified prices are excluded from budget optimization.",
    );
  }
  if (planningStage === null && pricedRecommendations.length > 0) {
    unavailable.add(
      "Priced recommendations cannot be engine-ranked until a progression metric or explicit stage is available.",
    );
  }

  return {
    profileId: profile.id,
    progression,
    planningStage,
    planningStageSource,
    rankedRecommendations,
    deferredRecommendations,
    budgetPlan,
    roadmap,
    unavailable: [...unavailable],
  };
}

function toUpgradeCandidate(recommendation: ModelRecommendation): UpgradeCandidate {
  const benefit = parseBenefit(recommendation.estimatedBenefit);
  return {
    id: recommendation.id,
    title: recommendation.title,
    category: mapCategory(recommendation.category),
    cost: knownNonNegative(recommendation.estimatedCost)!,
    benefit: {
      amount: benefit.amount,
      unit: benefit.unit,
      description: recommendation.estimatedBenefit,
      impactScore: impactFor(recommendation),
    },
    rationale: recommendation.reason,
    goalTags: [recommendation.category.toLowerCase()],
    risk: recommendation.badge === "MARKET DEPENDENT" ? "medium" : "low",
    marketDependent: recommendation.badge === "MARKET DEPENDENT",
  };
}

function toRankedView(
  ranked: RankedRecommendation,
  source: ModelRecommendation,
): RankedProfileRecommendation {
  return {
    id: source.id,
    title: source.title,
    category: source.category,
    href: source.href,
    reason: source.reason,
    estimatedCost: ranked.cost,
    estimatedBenefit: source.estimatedBenefit,
    reportedPriority: source.priority,
    reportedBadge: source.badge,
    score: ranked.score,
    enginePriority: ranked.priority,
    engineBadges: ranked.badges,
    costPerBenefitUnit: ranked.costPerBenefitUnit,
    prerequisites: source.prerequisites.map((description) => ({
      description,
      status: "unknown",
    })),
    prerequisiteVerificationRequired: source.prerequisites.length > 0,
  };
}

function buildProfileBudgetPlan(
  candidates: readonly UpgradeCandidate[],
  sourceById: ReadonlyMap<string, ModelRecommendation>,
  stage: ProgressionStage,
  budget: number,
  goals: readonly string[] | undefined,
  excludedUnpricedIds: string[],
): ProfileBudgetPlan {
  const plan = buildBudgetUpgradePlan(candidates, { stage, budget, goals });
  return {
    budget: plan.budget,
    spent: plan.spent,
    remaining: plan.remaining,
    totalImpactScore: plan.totalImpactScore,
    recommendations: plan.recommendations.map((ranked) =>
      toRankedView(ranked, sourceById.get(ranked.id)!),
    ),
    excludedRecommendationIdsWithoutPrices: excludedUnpricedIds,
    note:
      "Only recommendations with a normalized estimated cost enter this plan. Reported prerequisites remain unverified until a dedicated profile field confirms them.",
  };
}

function parseBenefit(description: string): { amount: number; unit: string } {
  const match = description.match(/[+-]?\s*(\d[\d,]*(?:\.\d+)?)/);
  if (!match) return { amount: 0, unit: "documented outcome" };
  const amount = Number(match[1].replaceAll(",", ""));
  const tail = description
    .slice((match.index ?? 0) + match[0].length)
    .split(/\b(?:after|and|with)\b/i)[0]
    .replace(/^[\s%]+|[.,\s]+$/g, "")
    .trim();
  const prefix = description.includes("%") && !tail ? "percent" : tail;
  return {
    amount: Number.isFinite(amount) ? amount : 0,
    unit: prefix || "documented outcome",
  };
}

function impactFor(recommendation: ModelRecommendation): number {
  const priorityImpact: Readonly<Record<ModelPriority, number>> = {
    critical: 95,
    "very-high": 85,
    high: 70,
    medium: 50,
    "long-term": 35,
  };
  const badgeFloor: Readonly<Record<ModelRecommendation["badge"], number>> = {
    "BEST VALUE": 80,
    "CHEAP UPGRADE": 55,
    "HIGH IMPACT": 82,
    "LONG TERM": 35,
    "REQUIRES GRIND": 45,
    "MARKET DEPENDENT": 45,
  };
  return Math.max(priorityImpact[recommendation.priority], badgeFloor[recommendation.badge]);
}

function mapCategory(category: string): RecommendationCategory {
  const normalized = category.trim().toLowerCase();
  if (normalized.includes("accessor")) return "accessories";
  if (normalized.includes("gear")) return "gear";
  if (normalized.includes("skill")) return "skills";
  if (normalized.includes("slayer")) return "slayer";
  if (normalized.includes("dungeon")) return "dungeons";
  if (normalized.includes("garden") || normalized.includes("farm")) return "garden";
  if (normalized.includes("mining")) return "mining";
  if (normalized.includes("pet")) return "pets";
  if (normalized.includes("minion")) return "minions";
  if (normalized.includes("museum")) return "museum";
  if (normalized.includes("collection")) return "collections";
  if (normalized.includes("econom") || normalized.includes("market")) return "economy";
  return "other";
}

function compareDeferredRecommendations(
  left: DeferredProfileRecommendation,
  right: DeferredProfileRecommendation,
): number {
  return compareModelRecommendations(left.recommendation, right.recommendation);
}

function compareModelRecommendations(
  left: ModelRecommendation,
  right: ModelRecommendation,
): number {
  const rank: Readonly<Record<ModelPriority, number>> = {
    critical: 0,
    "very-high": 1,
    high: 2,
    medium: 3,
    "long-term": 4,
  };
  return rank[left.priority] - rank[right.priority] || left.id.localeCompare(right.id, "en");
}

function knownNonNegative(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}
