import { assertNonNegative, clamp, lexicalCompare, round } from "./internal.js";
import type { ProgressionStage } from "./progression.js";

export type RecommendationCategory =
  | "accessories"
  | "gear"
  | "skills"
  | "slayer"
  | "dungeons"
  | "garden"
  | "mining"
  | "pets"
  | "minions"
  | "museum"
  | "collections"
  | "economy"
  | "other";

export type RecommendationPriority = "very-high" | "high" | "medium" | "low";
export type RecommendationRisk = "low" | "medium" | "high";
export type RecommendationBadge =
  | "BEST VALUE"
  | "CHEAP UPGRADE"
  | "HIGH IMPACT"
  | "LONG TERM"
  | "REQUIRES GRIND"
  | "MARKET DEPENDENT";

export interface RecommendationPrerequisite {
  description: string;
  met: boolean;
}

export interface RecommendationBenefit {
  amount: number;
  unit: string;
  description: string;
  /** A domain-expert impact estimate from 0 to 100, used for cross-category ranking. */
  impactScore: number;
}

export interface UpgradeCandidate {
  id: string;
  title: string;
  category: RecommendationCategory;
  cost: number;
  benefit: RecommendationBenefit;
  rationale: string;
  prerequisites?: readonly RecommendationPrerequisite[];
  goalTags?: readonly string[];
  minimumStage?: ProgressionStage;
  maximumStage?: ProgressionStage;
  grindHours?: number;
  risk?: RecommendationRisk;
  marketDependent?: boolean;
}

export interface RecommendationContext {
  stage: ProgressionStage;
  budget?: number;
  goals?: readonly string[];
  includeUnaffordable?: boolean;
  includeBlocked?: boolean;
  /** Expected coin cost for one point of abstract impact. Defaults to 250,000. */
  valueBenchmarkCoinsPerImpact?: number;
}

export interface RankedRecommendation extends UpgradeCandidate {
  score: number;
  priority: RecommendationPriority;
  costPerBenefitUnit: number | null;
  eligible: boolean;
  affordable: boolean;
  unmetPrerequisites: string[];
  badges: RecommendationBadge[];
  explanation: string;
}

export interface BudgetUpgradePlan {
  recommendations: RankedRecommendation[];
  budget: number;
  spent: number;
  remaining: number;
  totalImpactScore: number;
}

export function rankUpgradeRecommendations(
  candidates: readonly UpgradeCandidate[],
  context: RecommendationContext,
): RankedRecommendation[] {
  const budget = context.budget;
  if (budget !== undefined) assertNonNegative(budget, "budget");
  const benchmark = context.valueBenchmarkCoinsPerImpact ?? 250_000;
  if (benchmark <= 0 || !Number.isFinite(benchmark)) {
    throw new RangeError("valueBenchmarkCoinsPerImpact must be greater than zero");
  }

  const normalizedGoals = new Set(
    (context.goals ?? []).map((goal) => goal.trim().toLowerCase()).filter(Boolean),
  );

  return candidates
    .map((candidate) => scoreCandidate(candidate, context, normalizedGoals, benchmark))
    .filter((recommendation) =>
      (context.includeUnaffordable || recommendation.affordable) &&
      (context.includeBlocked || recommendation.eligible),
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.cost - right.cost ||
        lexicalCompare(left.id, right.id),
    );
}

/**
 * Produces a deterministic greedy plan from the cross-category ranking. It is
 * intended as an explainable shortlist, while domain-specific optimizers (such
 * as the accessory optimizer) can use exact combinatorial selection.
 */
export function buildBudgetUpgradePlan(
  candidates: readonly UpgradeCandidate[],
  context: RecommendationContext & { budget: number },
): BudgetUpgradePlan {
  assertNonNegative(context.budget, "budget");
  const ranked = rankUpgradeRecommendations(candidates, {
    ...context,
    includeUnaffordable: false,
    includeBlocked: false,
  });
  const selected: RankedRecommendation[] = [];
  let spent = 0;

  for (const recommendation of ranked) {
    if (spent + recommendation.cost <= context.budget) {
      selected.push(recommendation);
      spent += recommendation.cost;
    }
  }

  return {
    recommendations: selected,
    budget: context.budget,
    spent: round(spent),
    remaining: round(context.budget - spent),
    totalImpactScore: round(
      selected.reduce((sum, item) => sum + item.benefit.impactScore, 0),
      1,
    ),
  };
}

function scoreCandidate(
  candidate: UpgradeCandidate,
  context: RecommendationContext,
  goals: ReadonlySet<string>,
  benchmark: number,
): RankedRecommendation {
  validateCandidate(candidate);
  const prerequisites = candidate.prerequisites ?? [];
  const unmetPrerequisites = prerequisites
    .filter((prerequisite) => !prerequisite.met)
    .map((prerequisite) => prerequisite.description);
  const eligible = unmetPrerequisites.length === 0;
  const affordable = context.budget === undefined || candidate.cost <= context.budget;
  const costPerImpact =
    candidate.benefit.impactScore === 0
      ? Number.POSITIVE_INFINITY
      : candidate.cost / candidate.benefit.impactScore;
  const efficiencyScore =
    candidate.cost === 0
      ? 100
      : 100 / (1 + costPerImpact / benchmark);
  const stageScore = calculateStageFit(candidate, context.stage);
  const goalScore = calculateGoalFit(candidate.goalTags ?? [], goals);
  const affordabilityScore = calculateAffordability(candidate.cost, context.budget);
  const riskPenalty = ({ low: 0, medium: 8, high: 18 } as const)[
    candidate.risk ?? "low"
  ];
  const blockedPenalty = eligible ? 0 : 30;
  const score = clamp(
    candidate.benefit.impactScore * 0.45 +
      efficiencyScore * 0.3 +
      stageScore * 0.1 +
      goalScore * 0.1 +
      affordabilityScore * 0.05 -
      riskPenalty -
      blockedPenalty,
    0,
    100,
  );
  const badges = buildBadges(candidate, efficiencyScore, context.budget);
  const explanation = buildExplanation(
    candidate,
    efficiencyScore,
    unmetPrerequisites,
  );

  return {
    ...candidate,
    score: round(score, 1),
    priority: priorityForScore(score),
    costPerBenefitUnit:
      candidate.benefit.amount > 0
        ? round(candidate.cost / candidate.benefit.amount)
        : null,
    eligible,
    affordable,
    unmetPrerequisites,
    badges,
    explanation,
  };
}

function calculateStageFit(
  candidate: UpgradeCandidate,
  stage: ProgressionStage,
): number {
  const ranks = { early: 0, mid: 1, late: 2, endgame: 3 } as const;
  const current = ranks[stage];
  const minimum = candidate.minimumStage ? ranks[candidate.minimumStage] : 0;
  const maximum = candidate.maximumStage ? ranks[candidate.maximumStage] : 3;
  if (current >= minimum && current <= maximum) return 100;
  const distance = current < minimum ? minimum - current : current - maximum;
  return Math.max(25, 100 - distance * 35);
}

function calculateGoalFit(tags: readonly string[], goals: ReadonlySet<string>): number {
  if (goals.size === 0) return 55;
  const normalizedTags = tags.map((tag) => tag.trim().toLowerCase());
  return normalizedTags.some((tag) => goals.has(tag)) ? 100 : 35;
}

function calculateAffordability(cost: number, budget: number | undefined): number {
  if (cost === 0) return 100;
  if (budget === undefined || budget === 0) return 50;
  const share = cost / budget;
  if (share <= 0.25) return 100;
  return clamp(110 - share * 50, 0, 100);
}

function buildBadges(
  candidate: UpgradeCandidate,
  efficiencyScore: number,
  budget: number | undefined,
): RecommendationBadge[] {
  const badges: RecommendationBadge[] = [];
  if (efficiencyScore >= 72 && candidate.benefit.impactScore >= 45) badges.push("BEST VALUE");
  if (candidate.cost <= Math.min(1_000_000, (budget ?? 20_000_000) * 0.1)) {
    badges.push("CHEAP UPGRADE");
  }
  if (candidate.benefit.impactScore >= 75) badges.push("HIGH IMPACT");
  if ((candidate.grindHours ?? 0) >= 20) badges.push("LONG TERM");
  if ((candidate.grindHours ?? 0) > 0) badges.push("REQUIRES GRIND");
  if (candidate.marketDependent) badges.push("MARKET DEPENDENT");
  return badges;
}

function buildExplanation(
  candidate: UpgradeCandidate,
  efficiencyScore: number,
  unmetPrerequisites: readonly string[],
): string {
  const valueDescription =
    efficiencyScore >= 72
      ? "It is strong value for its expected impact."
      : efficiencyScore >= 45
        ? "Its cost is reasonable for the expected impact."
        : "Its impact is relatively expensive, so compare cheaper upgrades first.";
  const prerequisiteDescription =
    unmetPrerequisites.length > 0
      ? ` Complete first: ${unmetPrerequisites.join(", ")}.`
      : "";
  return `${candidate.rationale} ${valueDescription}${prerequisiteDescription}`;
}

function priorityForScore(score: number): RecommendationPriority {
  if (score >= 78) return "very-high";
  if (score >= 62) return "high";
  if (score >= 42) return "medium";
  return "low";
}

function validateCandidate(candidate: UpgradeCandidate): void {
  if (!candidate.id.trim() || !candidate.title.trim()) {
    throw new TypeError("recommendation id and title are required");
  }
  assertNonNegative(candidate.cost, `${candidate.id}.cost`);
  assertNonNegative(candidate.benefit.amount, `${candidate.id}.benefit.amount`);
  assertNonNegative(candidate.benefit.impactScore, `${candidate.id}.benefit.impactScore`);
  if (candidate.benefit.impactScore > 100) {
    throw new RangeError(`${candidate.id}.benefit.impactScore cannot exceed 100`);
  }
  if (candidate.grindHours !== undefined) {
    assertNonNegative(candidate.grindHours, `${candidate.id}.grindHours`);
  }
}

