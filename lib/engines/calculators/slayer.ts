import { assertNonNegative, assertPositive, assertRate, round } from "../internal.js";

export interface SlayerEstimateInput {
  currentSlayerXp: number;
  targetSlayerXp: number;
  xpPerBoss: number;
  secondsPerAttempt: number;
  successRate?: number;
  costPerAttempt?: number;
  expectedDropValuePerKill?: number;
}

export interface SlayerEstimate {
  remainingXp: number;
  successfulBosses: number;
  expectedAttempts: number;
  estimatedHours: number;
  grossExpectedDrops: number;
  totalAttemptCost: number;
  expectedNetCost: number;
  assumptions: string[];
}

export function estimateSlayerProgress(
  input: SlayerEstimateInput,
): SlayerEstimate {
  assertNonNegative(input.currentSlayerXp, "currentSlayerXp");
  assertNonNegative(input.targetSlayerXp, "targetSlayerXp");
  assertPositive(input.xpPerBoss, "xpPerBoss");
  assertPositive(input.secondsPerAttempt, "secondsPerAttempt");
  const successRate = input.successRate ?? 1;
  assertRate(successRate, "successRate");
  if (successRate === 0) throw new RangeError("successRate must be greater than zero");
  const costPerAttempt = input.costPerAttempt ?? 0;
  const dropValue = input.expectedDropValuePerKill ?? 0;
  assertNonNegative(costPerAttempt, "costPerAttempt");
  assertNonNegative(dropValue, "expectedDropValuePerKill");

  const remainingXp = Math.max(0, input.targetSlayerXp - input.currentSlayerXp);
  const successfulBosses = Math.ceil(remainingXp / input.xpPerBoss);
  const expectedAttempts = Math.ceil(successfulBosses / successRate);
  const estimatedHours = expectedAttempts * input.secondsPerAttempt / 3_600;
  const grossExpectedDrops = successfulBosses * dropValue;
  const totalAttemptCost = expectedAttempts * costPerAttempt;

  return {
    remainingXp: round(remainingXp),
    successfulBosses,
    expectedAttempts,
    estimatedHours: round(estimatedHours, 2),
    grossExpectedDrops: round(grossExpectedDrops, 2),
    totalAttemptCost: round(totalAttemptCost, 2),
    expectedNetCost: round(totalAttemptCost - grossExpectedDrops, 2),
    assumptions: [
      `${round(successRate * 100, 2)}% estimated boss success rate.`,
      `${round(input.secondsPerAttempt, 2)} seconds per attempt including spawn time.`,
      "Average drop value is an expectation, not a guaranteed return.",
    ],
  };
}

