import type { RecommendationPriority as EnginePriority } from "../engines/index.js";
import type {
  Recommendation as ModelRecommendation,
  RecommendationPriority as ModelPriority,
  SkyBlockProfile,
} from "../models.js";
import type { RankedProfileRecommendation } from "./profile-recommendations.js";

export type RoadmapPhase = "now" | "next" | "later";
export type RoadmapSource = "recommendation" | "gear" | "weakness";

export interface FixMyProfileRoadmapItem {
  id: string;
  title: string;
  reason: string;
  category: string;
  href: string | null;
  phase: RoadmapPhase;
  source: RoadmapSource;
  estimatedCost: number | null;
  estimatedBenefit: string;
  score: number | null;
  prerequisites: readonly string[];
  requiresPriceResearch: boolean;
  requiresVerification: boolean;
}

export interface FixMyProfileRoadmap {
  title: "Fix My Profile";
  items: FixMyProfileRoadmapItem[];
  phases: Readonly<Record<RoadmapPhase, FixMyProfileRoadmapItem[]>>;
}

export function buildFixMyProfileRoadmap(
  profile: SkyBlockProfile,
  ranked: readonly RankedProfileRecommendation[],
): FixMyProfileRoadmap {
  const rankedById = new Map(ranked.map((item) => [item.id, item]));
  const rankedItems = ranked.map(toRankedRoadmapItem);
  const deferredItems = profile.recommendations
    .filter((recommendation) => !rankedById.has(recommendation.id))
    .sort(compareModelRecommendations)
    .map(toDeferredRoadmapItem);
  const gearItems = profile.gear
    .filter((gear) => gear.status === "missing" || gear.status === "upgrade")
    .map((gear, index) => ({
      id: `gear:${slug(gear.slot)}:${index}`,
      title:
        gear.status === "missing"
          ? `Fill the missing ${gear.slot} slot`
          : `Review upgrades for ${gear.name}`,
      reason: gear.note,
      category: "Gear",
      href: "/gear",
      phase: gear.status === "missing" ? "now" : "next",
      source: "gear",
      estimatedCost: null,
      estimatedBenefit: "Requires item-specific analysis",
      score: null,
      prerequisites: [],
      requiresPriceResearch: true,
      requiresVerification: true,
    }) satisfies FixMyProfileRoadmapItem);
  const weaknessItems = profile.weaknesses.map((weakness, index) => ({
    id: `weakness:${index}`,
    title: `Investigate: ${weakness}`,
    reason: weakness,
    category: "Profile",
    href: "/progression",
    phase: "next",
    source: "weakness",
    estimatedCost: null,
    estimatedBenefit: "Diagnostic follow-up",
    score: null,
    prerequisites: [],
    requiresPriceResearch: true,
    requiresVerification: true,
  }) satisfies FixMyProfileRoadmapItem);
  const items = [...rankedItems, ...deferredItems, ...gearItems, ...weaknessItems];

  return {
    title: "Fix My Profile",
    items,
    phases: {
      now: items.filter((item) => item.phase === "now"),
      next: items.filter((item) => item.phase === "next"),
      later: items.filter((item) => item.phase === "later"),
    },
  };
}

function toRankedRoadmapItem(
  recommendation: RankedProfileRecommendation,
): FixMyProfileRoadmapItem {
  return {
    id: recommendation.id,
    title: recommendation.title,
    reason: recommendation.reason,
    category: recommendation.category,
    href: recommendation.href,
    phase: phaseForEnginePriority(recommendation.enginePriority),
    source: "recommendation",
    estimatedCost: knownNonNegative(recommendation.estimatedCost),
    estimatedBenefit: recommendation.estimatedBenefit,
    score: recommendation.score,
    prerequisites: recommendation.prerequisites.map((item) => item.description),
    requiresPriceResearch: false,
    requiresVerification: recommendation.prerequisiteVerificationRequired,
  };
}

function toDeferredRoadmapItem(
  recommendation: ModelRecommendation,
): FixMyProfileRoadmapItem {
  return {
    id: recommendation.id,
    title: recommendation.title,
    reason: recommendation.reason,
    category: recommendation.category,
    href: recommendation.href,
    phase: phaseForModelPriority(recommendation.priority),
    source: "recommendation",
    estimatedCost: knownNonNegative(recommendation.estimatedCost),
    estimatedBenefit: recommendation.estimatedBenefit,
    score: null,
    prerequisites: recommendation.prerequisites,
    requiresPriceResearch:
      knownNonNegative(recommendation.estimatedCost) === null,
    requiresVerification: recommendation.prerequisites.length > 0,
  };
}

function phaseForEnginePriority(priority: EnginePriority): RoadmapPhase {
  if (priority === "very-high" || priority === "high") return "now";
  if (priority === "medium") return "next";
  return "later";
}

function phaseForModelPriority(priority: ModelPriority): RoadmapPhase {
  if (priority === "critical" || priority === "very-high" || priority === "high") return "now";
  if (priority === "medium") return "next";
  return "later";
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

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

