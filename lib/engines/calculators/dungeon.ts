import { assertNonNegative, assertPositive, assertRate, round } from "../internal.js";

export interface DungeonRunInput {
  currentCatacombsXp: number;
  targetCatacombsXp: number;
  catacombsXpPerCompletion: number;
  minutesPerAttempt: number;
  completionRate?: number;
  expectedRewardPerCompletion?: number;
  chestCostPerCompletion?: number;
  costPerAttempt?: number;
}

export interface DungeonRunEstimate {
  remainingXp: number;
  successfulCompletions: number;
  expectedAttempts: number;
  estimatedHours: number;
  expectedNetProfit: number;
  assumptions: string[];
}

export function estimateDungeonRuns(input: DungeonRunInput): DungeonRunEstimate {
  assertNonNegative(input.currentCatacombsXp, "currentCatacombsXp");
  assertNonNegative(input.targetCatacombsXp, "targetCatacombsXp");
  assertPositive(input.catacombsXpPerCompletion, "catacombsXpPerCompletion");
  assertPositive(input.minutesPerAttempt, "minutesPerAttempt");
  const completionRate = input.completionRate ?? 1;
  assertRate(completionRate, "completionRate");
  if (completionRate === 0) {
    throw new RangeError("completionRate must be greater than zero");
  }
  const reward = input.expectedRewardPerCompletion ?? 0;
  const chestCost = input.chestCostPerCompletion ?? 0;
  const attemptCost = input.costPerAttempt ?? 0;
  assertNonNegative(reward, "expectedRewardPerCompletion");
  assertNonNegative(chestCost, "chestCostPerCompletion");
  assertNonNegative(attemptCost, "costPerAttempt");

  const remainingXp = Math.max(0, input.targetCatacombsXp - input.currentCatacombsXp);
  const successfulCompletions = Math.ceil(remainingXp / input.catacombsXpPerCompletion);
  const expectedAttempts = Math.ceil(successfulCompletions / completionRate);
  const estimatedHours = expectedAttempts * input.minutesPerAttempt / 60;
  const expectedNetProfit =
    successfulCompletions * (reward - chestCost) - expectedAttempts * attemptCost;

  return {
    remainingXp: round(remainingXp),
    successfulCompletions,
    expectedAttempts,
    estimatedHours: round(estimatedHours, 2),
    expectedNetProfit: round(expectedNetProfit, 2),
    assumptions: [
      `${round(completionRate * 100, 2)}% estimated completion rate.`,
      `${round(input.minutesPerAttempt, 2)} minutes per attempt.`,
      "Run time, XP, and rewards are estimates and do not guarantee floor readiness or profit.",
    ],
  };
}

