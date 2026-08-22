import { assertNonNegative, assertPositive, round } from "../internal.js";
import { totalStandardSkillXpForLevel } from "../../game-data/skill-xp.js";

export interface FarmingXpInput {
  currentXp: number;
  targetXp: number;
  baseXpPerHour: number;
  xpBoostPercent?: number;
  hoursPerDay?: number;
}

export interface FarmingXpEstimate {
  remainingXp: number;
  effectiveXpPerHour: number;
  hoursRemaining: number;
  daysRemaining: number | null;
  complete: boolean;
  assumptions: string[];
}

export interface FarmingLevelTargetInput {
  currentLevel: number;
  targetLevel: number;
  baseXpPerHour: number;
  xpBoostPercent?: number;
  hoursPerDay?: number;
}

export interface FarmingLevelTargetEstimate extends FarmingXpEstimate {
  currentLevel: number;
  targetLevel: number;
  currentXp: number;
  targetXp: number;
}

export function estimateFarmingXp(input: FarmingXpInput): FarmingXpEstimate {
  assertNonNegative(input.currentXp, "currentXp");
  assertNonNegative(input.targetXp, "targetXp");
  assertNonNegative(input.baseXpPerHour, "baseXpPerHour");
  const boost = input.xpBoostPercent ?? 0;
  assertNonNegative(boost, "xpBoostPercent");
  if (input.hoursPerDay !== undefined) assertPositive(input.hoursPerDay, "hoursPerDay");

  const remainingXp = Math.max(0, input.targetXp - input.currentXp);
  const effectiveXpPerHour = input.baseXpPerHour * (1 + boost / 100);
  const hoursRemaining = remainingXp === 0
    ? 0
    : effectiveXpPerHour === 0
      ? Number.POSITIVE_INFINITY
      : remainingXp / effectiveXpPerHour;
  const daysRemaining = input.hoursPerDay === undefined
    ? null
    : hoursRemaining / input.hoursPerDay;

  return {
    remainingXp: round(remainingXp),
    effectiveXpPerHour: round(effectiveXpPerHour),
    hoursRemaining: round(hoursRemaining, 2),
    daysRemaining: daysRemaining === null ? null : round(daysRemaining, 2),
    complete: remainingXp === 0,
    assumptions: [
      `Base rate: ${round(input.baseXpPerHour)} Farming XP/hour.`,
      `XP boost: ${round(boost, 2)}%.`,
      "Estimate assumes the measured farming rate remains constant.",
    ],
  };
}

export function estimateFarmingLevelTarget(
  input: FarmingLevelTargetInput,
): FarmingLevelTargetEstimate {
  const currentXp = totalStandardSkillXpForLevel(input.currentLevel, 60);
  const targetXp = totalStandardSkillXpForLevel(input.targetLevel, 60);
  const estimate = estimateFarmingXp({
    currentXp,
    targetXp,
    baseXpPerHour: input.baseXpPerHour,
    xpBoostPercent: input.xpBoostPercent,
    hoursPerDay: input.hoursPerDay,
  });
  return {
    ...estimate,
    currentLevel: input.currentLevel,
    targetLevel: input.targetLevel,
    currentXp,
    targetXp,
    assumptions: [
      `Current and target levels use the versioned standard Farming XP curve through level 60.`,
      ...estimate.assumptions,
    ],
  };
}
