import {
  estimateDungeonRuns,
  estimateFarmingXp,
  estimateMinionProfit,
  estimatePetXp,
  estimateSlayerProgress,
  type DungeonRunEstimate,
  type DungeonRunInput,
  type FarmingXpEstimate,
  type FarmingXpInput,
  type MinionProfitEstimate,
  type MinionProfitInput,
  type PetXpEstimate,
  type PetXpInput,
  type SlayerEstimate,
  type SlayerEstimateInput,
} from "../engines/index.js";
import type { SkyBlockProfile } from "../models.js";

export type CalculatorInputSource = "profile" | "manual" | "engine-default";

export interface CalculatorAdapterSuccess<T> {
  status: "ready";
  result: T;
  inputSources: Readonly<Record<string, CalculatorInputSource>>;
  warnings: string[];
}

export interface CalculatorAdapterUnavailable {
  status: "unavailable";
  missingInputs: string[];
  reason: string;
}

export type CalculatorAdapterResult<T> =
  | CalculatorAdapterSuccess<T>
  | CalculatorAdapterUnavailable;

export type FarmingCalculatorRequest = Omit<FarmingXpInput, "currentXp"> & {
  currentXp?: number;
};

export type DungeonCalculatorRequest = Omit<DungeonRunInput, "currentCatacombsXp"> & {
  currentCatacombsXp?: number;
};

export type SlayerCalculatorRequest = Omit<SlayerEstimateInput, "currentSlayerXp"> & {
  currentSlayerXp?: number;
};

export function calculateFarmingForProfile(
  profile: SkyBlockProfile,
  request: FarmingCalculatorRequest,
): CalculatorAdapterResult<FarmingXpEstimate> {
  const profileXp = findSkillXp(profile, "farming");
  const currentXp = request.currentXp ?? profileXp;
  if (currentXp === null || currentXp === undefined) {
    return unavailable(
      ["currentXp"],
      "Farming XP is absent from the normalized profile; enter it manually instead of estimating from level.",
    );
  }
  const result = estimateFarmingXp({ ...request, currentXp });
  return ready(result, {
    currentXp: request.currentXp === undefined ? "profile" : "manual",
    targetXp: "manual",
    baseXpPerHour: "manual",
    xpBoostPercent: request.xpBoostPercent === undefined ? "engine-default" : "manual",
    hoursPerDay: request.hoursPerDay === undefined ? "engine-default" : "manual",
  });
}

/** Pet XP is not present in SkyBlockProfile, so every pet-specific value is explicit manual input. */
export function calculatePetPlan(
  request: PetXpInput,
): CalculatorAdapterResult<PetXpEstimate> {
  return ready(estimatePetXp(request), {
    currentPetXp: "manual",
    targetPetXp: "manual",
    skillXpPerHour: "manual",
    skillToPetXpRatio: "manual",
    petXpBoostPercent: request.petXpBoostPercent === undefined ? "engine-default" : "manual",
  }, [
    "The normalized profile does not expose pet XP; no profile value was inferred.",
  ]);
}

/** Minion production mechanics and prices are scenario inputs, not profile-derived facts. */
export function calculateMinionPlan(
  request: MinionProfitInput,
): CalculatorAdapterResult<MinionProfitEstimate> {
  return ready(estimateMinionProfit(request), {
    minionCount: "manual",
    baseActionTimeSeconds: "manual",
    actionsPerOutput: request.actionsPerOutput === undefined ? "engine-default" : "manual",
    itemsPerOutput: "manual",
    sellPricePerItem: "manual",
    durationHours: request.durationHours === undefined ? "engine-default" : "manual",
    fuelSpeedBonusPercent: request.fuelSpeedBonusPercent === undefined ? "engine-default" : "manual",
    upgradeSpeedBonusPercent: request.upgradeSpeedBonusPercent === undefined ? "engine-default" : "manual",
    outputMultiplier: request.outputMultiplier === undefined ? "engine-default" : "manual",
    uptime: request.uptime === undefined ? "engine-default" : "manual",
    operatingCostPerDay: request.operatingCostPerDay === undefined ? "engine-default" : "manual",
  });
}

export function calculateDungeonForProfile(
  profile: SkyBlockProfile,
  request: DungeonCalculatorRequest,
): CalculatorAdapterResult<DungeonRunEstimate> {
  const profileXp = findStat(profile, "catacombs", "xp");
  const currentCatacombsXp = request.currentCatacombsXp ?? profileXp;
  if (currentCatacombsXp === null || currentCatacombsXp === undefined) {
    return unavailable(
      ["currentCatacombsXp"],
      "Catacombs XP is unavailable. A Catacombs level is not converted to XP without a versioned XP table.",
    );
  }
  const result = estimateDungeonRuns({ ...request, currentCatacombsXp });
  return ready(result, {
    currentCatacombsXp:
      request.currentCatacombsXp === undefined ? "profile" : "manual",
    targetCatacombsXp: "manual",
    catacombsXpPerCompletion: "manual",
    minutesPerAttempt: "manual",
    completionRate: request.completionRate === undefined ? "engine-default" : "manual",
    expectedRewardPerCompletion:
      request.expectedRewardPerCompletion === undefined ? "engine-default" : "manual",
    chestCostPerCompletion:
      request.chestCostPerCompletion === undefined ? "engine-default" : "manual",
    costPerAttempt: request.costPerAttempt === undefined ? "engine-default" : "manual",
  });
}

export function calculateSlayerForProfile(
  profile: SkyBlockProfile,
  request: SlayerCalculatorRequest,
): CalculatorAdapterResult<SlayerEstimate> {
  const profileXp = findStat(profile, "slayer", "xp");
  const currentSlayerXp = request.currentSlayerXp ?? profileXp;
  if (currentSlayerXp === null || currentSlayerXp === undefined) {
    return unavailable(
      ["currentSlayerXp"],
      "Slayer XP is absent from the normalized profile; enter it manually.",
    );
  }
  const result = estimateSlayerProgress({ ...request, currentSlayerXp });
  return ready(result, {
    currentSlayerXp: request.currentSlayerXp === undefined ? "profile" : "manual",
    targetSlayerXp: "manual",
    xpPerBoss: "manual",
    secondsPerAttempt: "manual",
    successRate: request.successRate === undefined ? "engine-default" : "manual",
    costPerAttempt: request.costPerAttempt === undefined ? "engine-default" : "manual",
    expectedDropValuePerKill:
      request.expectedDropValuePerKill === undefined ? "engine-default" : "manual",
  });
}

function findSkillXp(profile: SkyBlockProfile, key: string): number | null {
  const skill = profile.skills.find(
    (candidate) => candidate.key.trim().toLowerCase() === key,
  );
  return knownNonNegative(skill?.xp);
}

function findStat(
  profile: SkyBlockProfile,
  key: string,
  unit: SkyBlockProfile["stats"][number]["unit"],
): number | null {
  const stat = profile.stats.find(
    (candidate) => candidate.key.trim().toLowerCase() === key && candidate.unit === unit,
  );
  return knownNonNegative(stat?.value);
}

function ready<T>(
  result: T,
  inputSources: Readonly<Record<string, CalculatorInputSource>>,
  warnings: string[] = [],
): CalculatorAdapterSuccess<T> {
  return { status: "ready", result, inputSources, warnings };
}

function unavailable(
  missingInputs: string[],
  reason: string,
): CalculatorAdapterUnavailable {
  return { status: "unavailable", missingInputs, reason };
}

function knownNonNegative(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

