import { CORE_SKILL_LEVEL_CAPS, totalStandardSkillXpForLevel } from "../../game-data/skill-xp.js";
import { assertNonNegative, assertPositive, round } from "../internal.js";

export type CoreSkillId = "farming" | "mining" | "foraging" | "fishing" | "combat" | "enchanting" | "alchemy";

export interface SkillLevelTargetInput {
  skill: CoreSkillId;
  currentLevel: number;
  targetLevel: number;
  baseXpPerHour: number;
  xpBoostPercent?: number;
  hoursPerSession?: number;
}

export interface SkillLevelTargetEstimate {
  skill: CoreSkillId;
  levelCap: number;
  currentLevel: number;
  targetLevel: number;
  currentXp: number;
  targetXp: number;
  remainingXp: number;
  nextLevel: number;
  xpToNextLevel: number;
  effectiveXpPerHour: number;
  hoursRemaining: number;
  sessionsRemaining: number | null;
  complete: boolean;
  assumptions: string[];
}

export function estimateSkillLevelTarget(input: SkillLevelTargetInput): SkillLevelTargetEstimate {
  const levelCap = CORE_SKILL_LEVEL_CAPS[input.skill];
  if (levelCap === undefined) throw new TypeError("skill is not a configured core skill");
  assertNonNegative(input.currentLevel, "currentLevel");
  assertNonNegative(input.targetLevel, "targetLevel");
  if (input.currentLevel > levelCap || input.targetLevel > levelCap) {
    throw new RangeError(`${input.skill} levels cannot exceed the configured ${levelCap} cap`);
  }
  assertNonNegative(input.baseXpPerHour, "baseXpPerHour");
  const boost = input.xpBoostPercent ?? 0;
  assertNonNegative(boost, "xpBoostPercent");
  if (input.hoursPerSession !== undefined) assertPositive(input.hoursPerSession, "hoursPerSession");

  const currentXp = totalStandardSkillXpForLevel(input.currentLevel, levelCap);
  const targetXp = totalStandardSkillXpForLevel(input.targetLevel, levelCap);
  const remainingXp = Math.max(0, targetXp - currentXp);
  const nextLevel = Math.min(levelCap, Math.floor(input.currentLevel) + 1);
  const nextLevelXp = totalStandardSkillXpForLevel(nextLevel, levelCap);
  const xpToNextLevel = Math.max(0, nextLevelXp - currentXp);
  const effectiveXpPerHour = input.baseXpPerHour * (1 + boost / 100);
  const hoursRemaining = remainingXp === 0
    ? 0
    : effectiveXpPerHour === 0
      ? Number.POSITIVE_INFINITY
      : remainingXp / effectiveXpPerHour;
  const sessionsRemaining = input.hoursPerSession === undefined
    ? null
    : hoursRemaining / input.hoursPerSession;

  return {
    skill: input.skill,
    levelCap,
    currentLevel: input.currentLevel,
    targetLevel: input.targetLevel,
    currentXp,
    targetXp,
    remainingXp: round(remainingXp),
    nextLevel,
    xpToNextLevel: round(xpToNextLevel),
    effectiveXpPerHour: round(effectiveXpPerHour),
    hoursRemaining: round(hoursRemaining, 2),
    sessionsRemaining: sessionsRemaining === null ? null : round(sessionsRemaining, 2),
    complete: remainingXp === 0,
    assumptions: [
      `${input.skill} uses the centralized standard XP curve and configured level ${levelCap} cap.`,
      `Base rate: ${round(input.baseXpPerHour)} XP/hour; entered boost: ${round(boost, 2)}%.`,
      "Time assumes the entered rate remains sustainable and excludes downtime unless already reflected in that rate.",
    ],
  };
}
