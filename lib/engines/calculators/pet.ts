import { assertNonNegative, round } from "../internal.js";

export interface PetXpInput {
  currentPetXp: number;
  targetPetXp: number;
  skillXpPerHour: number;
  /** Pet XP earned per one point of source skill XP. */
  skillToPetXpRatio: number;
  petXpBoostPercent?: number;
}

export interface PetXpEstimate {
  remainingPetXp: number;
  effectivePetXpPerHour: number;
  hoursRemaining: number;
  complete: boolean;
  assumptions: string[];
}

export function estimatePetXp(input: PetXpInput): PetXpEstimate {
  assertNonNegative(input.currentPetXp, "currentPetXp");
  assertNonNegative(input.targetPetXp, "targetPetXp");
  assertNonNegative(input.skillXpPerHour, "skillXpPerHour");
  assertNonNegative(input.skillToPetXpRatio, "skillToPetXpRatio");
  const boost = input.petXpBoostPercent ?? 0;
  assertNonNegative(boost, "petXpBoostPercent");

  const remainingPetXp = Math.max(0, input.targetPetXp - input.currentPetXp);
  const effectivePetXpPerHour =
    input.skillXpPerHour * input.skillToPetXpRatio * (1 + boost / 100);
  const hoursRemaining = remainingPetXp === 0
    ? 0
    : effectivePetXpPerHour === 0
      ? Number.POSITIVE_INFINITY
      : remainingPetXp / effectivePetXpPerHour;

  return {
    remainingPetXp: round(remainingPetXp),
    effectivePetXpPerHour: round(effectivePetXpPerHour),
    hoursRemaining: round(hoursRemaining, 2),
    complete: remainingPetXp === 0,
    assumptions: [
      `Source rate: ${round(input.skillXpPerHour)} skill XP/hour.`,
      `Skill-to-pet XP ratio: ${round(input.skillToPetXpRatio, 4)}.`,
      `Pet XP boost: ${round(boost, 2)}%.`,
    ],
  };
}

