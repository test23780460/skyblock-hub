import {
  assertNonNegative,
  assertPositive,
  clamp,
  lexicalCompare,
  round,
} from "./internal.js";

export type MoneyMakingCategory =
  | "farming"
  | "mining"
  | "fishing"
  | "dungeons"
  | "slayers"
  | "bazaar"
  | "auction"
  | "crafting"
  | "npc"
  | "other";

export type MoneyMakingRisk = "low" | "medium" | "high";
export type MoneyMakingAttention = "active" | "semi-active" | "passive";

export interface MoneyMakingRequirement {
  id: string;
  label: string;
  /** `null` means the current profile does not expose enough evidence. */
  met: boolean | null;
  weight?: number;
}

export interface MoneyMakingMethodInput {
  id: string;
  name: string;
  category: MoneyMakingCategory;
  expectedCoinsPerHour: number;
  cautiousCoinsPerHour?: number;
  optimisticCoinsPerHour?: number;
  setupCost: number;
  recurringCostPerHour?: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  risk: MoneyMakingRisk;
  attention: MoneyMakingAttention;
  requirements?: readonly MoneyMakingRequirement[];
  note?: string;
}

export interface MoneyMakingContext {
  availableCapital: number;
  sessionHours: number;
  riskTolerance: MoneyMakingRisk;
  maximumDifficulty: 1 | 2 | 3 | 4 | 5;
  preferredAttention?: readonly MoneyMakingAttention[];
}

export interface RankedMoneyMakingMethod extends MoneyMakingMethodInput {
  cautiousNetCoinsPerHour: number;
  expectedNetCoinsPerHour: number;
  optimisticNetCoinsPerHour: number;
  expectedSessionProfit: number;
  setupReadinessPercent: number;
  knownRequirementPercent: number;
  missingRequirements: string[];
  unknownRequirements: string[];
  capitalShortfall: number;
  affordable: boolean;
  eligible: boolean;
  score: number;
  explanation: string;
}

export interface MoneyMakingPlan {
  rankedMethods: RankedMoneyMakingMethod[];
  readyMethods: RankedMoneyMakingMethod[];
  bestReadyMethod: RankedMoneyMakingMethod | null;
  assumptions: string[];
}

type EvaluatedMethod = Omit<RankedMoneyMakingMethod, "score" | "explanation">;

export function rankMoneyMakingMethods(
  methods: readonly MoneyMakingMethodInput[],
  context: MoneyMakingContext,
): MoneyMakingPlan {
  validateContext(context);
  if (methods.length === 0) {
    return {
      rankedMethods: [],
      readyMethods: [],
      bestReadyMethod: null,
      assumptions: buildAssumptions(context),
    };
  }
  if (methods.length > 100) {
    throw new RangeError("methods cannot contain more than 100 entries");
  }

  const seenIds = new Set<string>();
  const evaluated = methods.map((method) => {
    validateMethod(method, seenIds);
    return evaluateMethod(method, context);
  });
  const maximumPositiveProfit = Math.max(
    1,
    ...evaluated.map((method) => Math.max(0, method.expectedNetCoinsPerHour)),
  );
  const rankedMethods = evaluated
    .map((method) => scoreMethod(method, context, maximumPositiveProfit))
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.expectedNetCoinsPerHour - left.expectedNetCoinsPerHour ||
        lexicalCompare(left.id, right.id),
    );
  const readyMethods = rankedMethods.filter((method) => method.eligible);

  return {
    rankedMethods,
    readyMethods,
    bestReadyMethod: readyMethods[0] ?? null,
    assumptions: buildAssumptions(context),
  };
}

function evaluateMethod(
  method: MoneyMakingMethodInput,
  context: MoneyMakingContext,
): EvaluatedMethod {
  const recurringCost = method.recurringCostPerHour ?? 0;
  const expectedNetCoinsPerHour = method.expectedCoinsPerHour - recurringCost;
  const cautiousNetCoinsPerHour =
    (method.cautiousCoinsPerHour ?? method.expectedCoinsPerHour * 0.7) -
    recurringCost;
  const optimisticNetCoinsPerHour =
    (method.optimisticCoinsPerHour ?? method.expectedCoinsPerHour * 1.2) -
    recurringCost;
  const requirements = method.requirements ?? [];
  const totalWeight = requirements.reduce(
    (sum, requirement) => sum + (requirement.weight ?? 1),
    0,
  );
  const metWeight = requirements.reduce(
    (sum, requirement) =>
      sum + (requirement.met === true ? requirement.weight ?? 1 : 0),
    0,
  );
  const knownWeight = requirements.reduce(
    (sum, requirement) =>
      sum + (requirement.met === null ? 0 : requirement.weight ?? 1),
    0,
  );
  const setupReadinessPercent = totalWeight === 0 ? 100 : metWeight / totalWeight * 100;
  const knownRequirementPercent = totalWeight === 0 ? 100 : knownWeight / totalWeight * 100;
  const missingRequirements = requirements
    .filter((requirement) => requirement.met === false)
    .map((requirement) => requirement.label);
  const unknownRequirements = requirements
    .filter((requirement) => requirement.met === null)
    .map((requirement) => requirement.label);
  const capitalShortfall = Math.max(0, method.setupCost - context.availableCapital);
  const affordable = capitalShortfall === 0;
  const eligible =
    affordable &&
    missingRequirements.length === 0 &&
    unknownRequirements.length === 0 &&
    method.difficulty <= context.maximumDifficulty;

  return {
    ...method,
    cautiousNetCoinsPerHour: round(cautiousNetCoinsPerHour),
    expectedNetCoinsPerHour: round(expectedNetCoinsPerHour),
    optimisticNetCoinsPerHour: round(optimisticNetCoinsPerHour),
    expectedSessionProfit: round(expectedNetCoinsPerHour * context.sessionHours),
    setupReadinessPercent: round(setupReadinessPercent, 1),
    knownRequirementPercent: round(knownRequirementPercent, 1),
    missingRequirements,
    unknownRequirements,
    capitalShortfall: round(capitalShortfall),
    affordable,
    eligible,
  };
}

function scoreMethod(
  method: EvaluatedMethod,
  context: MoneyMakingContext,
  maximumPositiveProfit: number,
): RankedMoneyMakingMethod {
  const profitScore = clamp(
    Math.max(0, method.expectedNetCoinsPerHour) / maximumPositiveProfit * 100,
    0,
    100,
  );
  const riskFit = riskScore(method.risk, context.riskTolerance);
  const attentionFit =
    !context.preferredAttention?.length ||
    context.preferredAttention.includes(method.attention)
      ? 100
      : 45;
  const difficultyFit =
    method.difficulty <= context.maximumDifficulty
      ? 100 - Math.max(0, method.difficulty - 1) * 5
      : 0;
  const capitalFit = method.affordable
    ? method.setupCost === 0
      ? 100
      : clamp(110 - method.setupCost / Math.max(1, context.availableCapital) * 35, 60, 100)
    : 0;
  const evidenceFit = method.knownRequirementPercent;
  const blockedPenalty = method.eligible ? 0 : 18;
  const lossPenalty = method.expectedNetCoinsPerHour < 0 ? 25 : 0;
  const score = clamp(
    profitScore * 0.35 +
      method.setupReadinessPercent * 0.25 +
      capitalFit * 0.12 +
      riskFit * 0.1 +
      attentionFit * 0.08 +
      difficultyFit * 0.05 +
      evidenceFit * 0.05 -
      blockedPenalty -
      lossPenalty,
    0,
    100,
  );

  return {
    ...method,
    score: round(score, 1),
    explanation: buildExplanation(method, context),
  };
}

function buildExplanation(
  method: EvaluatedMethod,
  context: MoneyMakingContext,
): string {
  const blockers: string[] = [];
  if (method.capitalShortfall > 0) {
    blockers.push(`${round(method.capitalShortfall)} more setup coins`);
  }
  if (method.missingRequirements.length > 0) {
    blockers.push(...method.missingRequirements);
  }
  if (method.unknownRequirements.length > 0) {
    blockers.push(`verify ${method.unknownRequirements.join(", ")}`);
  }
  if (method.difficulty > context.maximumDifficulty) {
    blockers.push(`difficulty ${method.difficulty} exceeds your ${context.maximumDifficulty} limit`);
  }
  if (blockers.length > 0) {
    return `Not ready under the current inputs: ${blockers.join("; ")}.`;
  }

  const fit = method.risk === "high" && context.riskTolerance !== "high"
    ? "The method is available, but its risk is above your stated preference."
    : "The visible requirements, capital, and difficulty inputs are satisfied.";
  return `${fit} Compare its cautious and optimistic cases before choosing it.`;
}

function riskScore(methodRisk: MoneyMakingRisk, tolerance: MoneyMakingRisk): number {
  const ranks: Record<MoneyMakingRisk, number> = { low: 1, medium: 2, high: 3 };
  const difference = ranks[methodRisk] - ranks[tolerance];
  if (difference <= 0) return 100;
  return difference === 1 ? 45 : 10;
}

function validateContext(context: MoneyMakingContext): void {
  assertNonNegative(context.availableCapital, "availableCapital");
  assertPositive(context.sessionHours, "sessionHours");
  if (!([1, 2, 3, 4, 5] as const).includes(context.maximumDifficulty)) {
    throw new RangeError("maximumDifficulty must be an integer from 1 to 5");
  }
  if (!(["low", "medium", "high"] as const).includes(context.riskTolerance)) {
    throw new TypeError("riskTolerance is invalid");
  }
  for (const preference of context.preferredAttention ?? []) {
    if (!(["active", "semi-active", "passive"] as const).includes(preference)) {
      throw new TypeError("preferredAttention contains an invalid value");
    }
  }
}

function validateMethod(method: MoneyMakingMethodInput, seenIds: Set<string>): void {
  if (!method.id.trim() || !method.name.trim()) {
    throw new TypeError("method id and name are required");
  }
  if (seenIds.has(method.id)) throw new TypeError(`duplicate method id: ${method.id}`);
  seenIds.add(method.id);
  assertNonNegative(method.expectedCoinsPerHour, `${method.id}.expectedCoinsPerHour`);
  assertNonNegative(method.setupCost, `${method.id}.setupCost`);
  assertNonNegative(method.recurringCostPerHour ?? 0, `${method.id}.recurringCostPerHour`);
  if (method.cautiousCoinsPerHour !== undefined) {
    assertNonNegative(method.cautiousCoinsPerHour, `${method.id}.cautiousCoinsPerHour`);
  }
  if (method.optimisticCoinsPerHour !== undefined) {
    assertNonNegative(method.optimisticCoinsPerHour, `${method.id}.optimisticCoinsPerHour`);
  }
  if (
    method.cautiousCoinsPerHour !== undefined &&
    method.cautiousCoinsPerHour > method.expectedCoinsPerHour
  ) {
    throw new RangeError(`${method.id}.cautiousCoinsPerHour cannot exceed expectedCoinsPerHour`);
  }
  if (
    method.optimisticCoinsPerHour !== undefined &&
    method.optimisticCoinsPerHour < method.expectedCoinsPerHour
  ) {
    throw new RangeError(`${method.id}.optimisticCoinsPerHour cannot be below expectedCoinsPerHour`);
  }
  if (!Number.isInteger(method.difficulty) || method.difficulty < 1 || method.difficulty > 5) {
    throw new RangeError(`${method.id}.difficulty must be an integer from 1 to 5`);
  }
  if (!(["low", "medium", "high"] as const).includes(method.risk)) {
    throw new TypeError(`${method.id}.risk is invalid`);
  }
  if (!(["active", "semi-active", "passive"] as const).includes(method.attention)) {
    throw new TypeError(`${method.id}.attention is invalid`);
  }
  const requirements = method.requirements ?? [];
  if (requirements.length > 25) {
    throw new RangeError(`${method.id}.requirements cannot exceed 25 entries`);
  }
  const requirementIds = new Set<string>();
  for (const requirement of requirements) {
    if (!requirement.id.trim() || !requirement.label.trim()) {
      throw new TypeError(`${method.id}.requirements require ids and labels`);
    }
    if (requirementIds.has(requirement.id)) {
      throw new TypeError(`${method.id} has duplicate requirement ${requirement.id}`);
    }
    requirementIds.add(requirement.id);
    assertPositive(requirement.weight ?? 1, `${method.id}.${requirement.id}.weight`);
  }
}

function buildAssumptions(context: MoneyMakingContext): string[] {
  return [
    `Session output uses ${round(context.sessionHours, 2)} hours without adding setup or queue time.`,
    "Coins per hour, setup cost, recurring cost, and requirements are editable planning inputs—not live prices or guaranteed returns.",
    "Readiness uses only supplied or explicitly resolved profile evidence; unknown requirements block a ready-now claim.",
    "SkyPilot does not automate gameplay, trades, the Minecraft client, or market orders.",
  ];
}
