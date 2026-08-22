import { assertNonNegative, lexicalCompare, round } from "../internal.js";

export interface GardenFortuneSource {
  id: string;
  label: string;
  fortune: number;
}

export interface GardenUpgradeCandidate {
  id: string;
  name: string;
  fortuneGain: number;
  cost: number;
}

export interface GardenYieldInput {
  baseFortune: number;
  cropSpecificFortune?: number;
  sources?: readonly GardenFortuneSource[];
  blocksPerHour: number;
  baseDropsPerBlock?: number;
  coinValuePerItem?: number;
  budget?: number;
  upgrades?: readonly GardenUpgradeCandidate[];
}

export interface GardenUpgradeResult extends GardenUpgradeCandidate {
  coinsPerFortune: number;
  incrementalItemsPerHour: number;
  incrementalCoinsPerHour: number;
  affordable: boolean | null;
}

export interface GardenYieldEstimate {
  totalFortune: number;
  expectedDropMultiplier: number;
  guaranteedDropMultiplier: number;
  extraDropChancePercent: number;
  expectedItemsPerHour: number;
  expectedGrossCoinsPerHour: number;
  sources: GardenFortuneSource[];
  rankedUpgrades: GardenUpgradeResult[];
  assumptions: string[];
}

/**
 * Expected crop drops follow Hypixel's documented Fortune rule: the base drop
 * plus one expected extra drop multiplier per 100 Fortune. Crop-specific
 * Fortune is additive for the selected crop.
 */
export function estimateGardenYield(input: GardenYieldInput): GardenYieldEstimate {
  assertNonNegative(input.baseFortune, "baseFortune");
  const cropSpecificFortune = input.cropSpecificFortune ?? 0;
  assertNonNegative(cropSpecificFortune, "cropSpecificFortune");
  assertNonNegative(input.blocksPerHour, "blocksPerHour");
  const baseDropsPerBlock = input.baseDropsPerBlock ?? 1;
  const coinValuePerItem = input.coinValuePerItem ?? 0;
  assertNonNegative(baseDropsPerBlock, "baseDropsPerBlock");
  assertNonNegative(coinValuePerItem, "coinValuePerItem");
  if (input.budget !== undefined) assertNonNegative(input.budget, "budget");

  const seenSourceIds = new Set<string>();
  const sources = (input.sources ?? []).map((source) => {
    if (!source.id.trim() || !source.label.trim()) {
      throw new TypeError("fortune source id and label are required");
    }
    if (seenSourceIds.has(source.id)) throw new TypeError(`duplicate fortune source id: ${source.id}`);
    seenSourceIds.add(source.id);
    assertNonNegative(source.fortune, `${source.id}.fortune`);
    return { ...source };
  });

  const sourceFortune = sources.reduce((sum, source) => sum + source.fortune, 0);
  const totalFortune = input.baseFortune + cropSpecificFortune + sourceFortune;
  const expectedDropMultiplier = 1 + totalFortune / 100;
  const guaranteedDropMultiplier = 1 + Math.floor(totalFortune / 100);
  const extraDropChancePercent = totalFortune % 100;
  const baseItemsPerHour = input.blocksPerHour * baseDropsPerBlock;
  const expectedItemsPerHour = baseItemsPerHour * expectedDropMultiplier;

  const seenUpgradeIds = new Set<string>();
  const rankedUpgrades = (input.upgrades ?? []).map((upgrade): GardenUpgradeResult => {
    if (!upgrade.id.trim() || !upgrade.name.trim()) {
      throw new TypeError("upgrade id and name are required");
    }
    if (seenUpgradeIds.has(upgrade.id)) throw new TypeError(`duplicate upgrade id: ${upgrade.id}`);
    seenUpgradeIds.add(upgrade.id);
    assertNonNegative(upgrade.fortuneGain, `${upgrade.id}.fortuneGain`);
    assertNonNegative(upgrade.cost, `${upgrade.id}.cost`);
    const incrementalItemsPerHour = baseItemsPerHour * upgrade.fortuneGain / 100;
    return {
      ...upgrade,
      coinsPerFortune: upgrade.fortuneGain === 0 ? Number.POSITIVE_INFINITY : round(upgrade.cost / upgrade.fortuneGain),
      incrementalItemsPerHour: round(incrementalItemsPerHour, 2),
      incrementalCoinsPerHour: round(incrementalItemsPerHour * coinValuePerItem, 2),
      affordable: input.budget === undefined ? null : upgrade.cost <= input.budget,
    };
  }).sort((left, right) =>
    left.coinsPerFortune - right.coinsPerFortune ||
    right.fortuneGain - left.fortuneGain ||
    lexicalCompare(left.id, right.id));

  return {
    totalFortune: round(totalFortune, 2),
    expectedDropMultiplier: round(expectedDropMultiplier, 4),
    guaranteedDropMultiplier,
    extraDropChancePercent: round(extraDropChancePercent, 2),
    expectedItemsPerHour: round(expectedItemsPerHour, 2),
    expectedGrossCoinsPerHour: round(expectedItemsPerHour * coinValuePerItem, 2),
    sources,
    rankedUpgrades,
    assumptions: [
      `${round(input.blocksPerHour)} crop blocks broken per hour.`,
      `${round(baseDropsPerBlock, 4)} base items per broken block.`,
      "Every 100 total applicable Fortune adds one expected crop-drop multiplier.",
      "Gross coin output excludes downtime, inventory limits, compacting, taxes, and price movement.",
    ],
  };
}
