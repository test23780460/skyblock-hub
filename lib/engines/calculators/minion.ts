import { assertNonNegative, assertPositive, assertRate, round } from "../internal.js";

export interface MinionProfitInput {
  minionCount: number;
  baseActionTimeSeconds: number;
  /** Number of actions needed to produce one output batch. Usually two. */
  actionsPerOutput?: number;
  itemsPerOutput: number;
  sellPricePerItem: number;
  durationHours?: number;
  fuelSpeedBonusPercent?: number;
  upgradeSpeedBonusPercent?: number;
  outputMultiplier?: number;
  uptime?: number;
  operatingCostPerDay?: number;
}

export interface MinionProfitEstimate {
  effectiveActionTimeSeconds: number;
  expectedItems: number;
  grossRevenue: number;
  operatingCost: number;
  netProfit: number;
  netProfitPerHour: number;
  netProfitPerDay: number;
  assumptions: string[];
}

export function estimateMinionProfit(
  input: MinionProfitInput,
): MinionProfitEstimate {
  if (!Number.isInteger(input.minionCount) || input.minionCount <= 0) {
    throw new RangeError("minionCount must be a positive integer");
  }
  assertPositive(input.baseActionTimeSeconds, "baseActionTimeSeconds");
  const actionsPerOutput = input.actionsPerOutput ?? 2;
  assertPositive(actionsPerOutput, "actionsPerOutput");
  assertNonNegative(input.itemsPerOutput, "itemsPerOutput");
  assertNonNegative(input.sellPricePerItem, "sellPricePerItem");
  const durationHours = input.durationHours ?? 24;
  assertPositive(durationHours, "durationHours");
  const fuelBonus = input.fuelSpeedBonusPercent ?? 0;
  const upgradeBonus = input.upgradeSpeedBonusPercent ?? 0;
  assertNonNegative(fuelBonus, "fuelSpeedBonusPercent");
  assertNonNegative(upgradeBonus, "upgradeSpeedBonusPercent");
  const outputMultiplier = input.outputMultiplier ?? 1;
  assertNonNegative(outputMultiplier, "outputMultiplier");
  const uptime = input.uptime ?? 1;
  assertRate(uptime, "uptime");
  const operatingCostPerDay = input.operatingCostPerDay ?? 0;
  assertNonNegative(operatingCostPerDay, "operatingCostPerDay");

  const speedMultiplier = 1 + (fuelBonus + upgradeBonus) / 100;
  const effectiveActionTimeSeconds = input.baseActionTimeSeconds / speedMultiplier;
  const actions =
    input.minionCount * durationHours * 3_600 / effectiveActionTimeSeconds * uptime;
  const expectedItems =
    actions / actionsPerOutput * input.itemsPerOutput * outputMultiplier;
  const grossRevenue = expectedItems * input.sellPricePerItem;
  const operatingCost = operatingCostPerDay * durationHours / 24;
  const netProfit = grossRevenue - operatingCost;

  return {
    effectiveActionTimeSeconds: round(effectiveActionTimeSeconds, 3),
    expectedItems: round(expectedItems, 2),
    grossRevenue: round(grossRevenue, 2),
    operatingCost: round(operatingCost, 2),
    netProfit: round(netProfit, 2),
    netProfitPerHour: round(netProfit / durationHours, 2),
    netProfitPerDay: round(netProfit / durationHours * 24, 2),
    assumptions: [
      `${actionsPerOutput} actions per output batch.`,
      `${round(uptime * 100, 2)}% uptime over ${round(durationHours, 2)} hours.`,
      "Sale price and production rate are assumed constant; storage limits are not modeled.",
    ],
  };
}

