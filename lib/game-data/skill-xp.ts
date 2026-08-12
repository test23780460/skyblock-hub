/**
 * Standard SkyBlock skill XP required for each successive level. Versioned in
 * one module so profile normalization and calculators cannot silently diverge.
 */
export const STANDARD_SKILL_XP_INCREMENTS = [
  50, 125, 200, 300, 500, 750, 1_000, 1_500, 2_000, 3_500, 5_000, 7_500,
  10_000, 15_000, 20_000, 30_000, 50_000, 75_000, 100_000, 200_000,
  300_000, 400_000, 500_000, 600_000, 700_000, 800_000, 900_000,
  1_000_000, 1_100_000, 1_200_000, 1_300_000, 1_400_000, 1_500_000,
  1_600_000, 1_700_000, 1_800_000, 1_900_000, 2_000_000, 2_100_000,
  2_200_000, 2_300_000, 2_400_000, 2_500_000, 2_600_000, 2_750_000,
  2_900_000, 3_100_000, 3_400_000, 3_700_000, 4_000_000, 4_300_000,
  4_600_000, 4_900_000, 5_200_000, 5_500_000, 5_800_000, 6_100_000,
  6_400_000, 6_700_000, 7_000_000,
] as const;

export const CORE_SKILL_LEVEL_CAPS: Readonly<Record<string, number>> = {
  farming: 60,
  mining: 60,
  combat: 60,
  foraging: 60,
  fishing: 50,
  enchanting: 60,
  alchemy: 50,
};

export function totalStandardSkillXpForLevel(level: number, levelCap = 60): number {
  assertNonNegativeFinite(level, "level");
  if (!Number.isInteger(levelCap) || levelCap < 0 || levelCap > STANDARD_SKILL_XP_INCREMENTS.length) {
    throw new RangeError("levelCap is outside the standard skill curve");
  }
  if (level > levelCap) throw new RangeError(`level cannot exceed the ${levelCap} cap`);
  const wholeLevel = Math.floor(level);
  const completedXp = STANDARD_SKILL_XP_INCREMENTS
    .slice(0, wholeLevel)
    .reduce((sum, requirement) => sum + requirement, 0);
  const fraction = level - wholeLevel;
  const nextRequirement = STANDARD_SKILL_XP_INCREMENTS[wholeLevel] ?? 0;
  return round(completedXp + fraction * nextRequirement, 2);
}

export function standardSkillLevelFromXp(
  xpInput: number,
  levelCap = 60,
): { level: number; progress: number } {
  assertNonNegativeFinite(xpInput, "xp");
  if (!Number.isInteger(levelCap) || levelCap < 0 || levelCap > STANDARD_SKILL_XP_INCREMENTS.length) {
    throw new RangeError("levelCap is outside the standard skill curve");
  }
  let remaining = xpInput;
  let completed = 0;
  for (const requirement of STANDARD_SKILL_XP_INCREMENTS.slice(0, levelCap)) {
    if (remaining < requirement) {
      const fraction = remaining / requirement;
      return {
        level: round(completed + fraction, 2),
        progress: round(fraction * 100, 1),
      };
    }
    remaining -= requirement;
    completed += 1;
  }
  return { level: levelCap, progress: 100 };
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}
