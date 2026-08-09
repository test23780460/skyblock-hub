import { assertNonNegative, lexicalCompare, round } from "./internal.js";

export interface AccessoryOption {
  id: string;
  name: string;
  familyId: string;
  tier: number;
  magicalPower: number;
  cost: number;
}

export interface AccessoryOptimizationInput {
  accessories: readonly AccessoryOption[];
  ownedAccessoryIds?: readonly string[];
  /** The player's complete current MP, including accessories absent from this catalog. */
  currentMagicalPower?: number;
  budget?: number;
  targetAdditionalMagicalPower?: number;
}

export interface AccessoryOpportunity extends AccessoryOption {
  magicalPowerGain: number;
  coinsPerMagicalPower: number;
  replacesAccessoryId: string | null;
}

export interface AccessoryOptimizationResult {
  currentMagicalPower: number;
  selected: AccessoryOpportunity[];
  spent: number;
  magicalPowerGain: number;
  resultingMagicalPower: number;
  targetAdditionalMagicalPower: number | null;
  targetReached: boolean | null;
  remainingBudget: number | null;
  rankedOpportunities: AccessoryOpportunity[];
}

interface FamilyChoice {
  opportunity: AccessoryOpportunity | null;
  cost: number;
  gain: number;
}

interface OptimizationState {
  cost: number;
  gain: number;
  selections: AccessoryOpportunity[];
}

/**
 * Uses an exact Pareto-frontier optimizer across accessory families. Only one
 * tier per family may be selected, preventing lower-family tiers from being
 * incorrectly counted alongside their upgrades.
 */
export function optimizeAccessories(
  input: AccessoryOptimizationInput,
): AccessoryOptimizationResult {
  const budget = input.budget ?? Number.MAX_SAFE_INTEGER;
  assertNonNegative(budget, "budget");
  const target = input.targetAdditionalMagicalPower;
  if (target !== undefined) assertNonNegative(target, "targetAdditionalMagicalPower");
  const ownedIds = new Set(input.ownedAccessoryIds ?? []);
  const seenIds = new Set<string>();
  const families = new Map<string, AccessoryOption[]>();

  for (const accessory of input.accessories) {
    validateAccessory(accessory);
    if (seenIds.has(accessory.id)) {
      throw new TypeError(`duplicate accessory id: ${accessory.id}`);
    }
    seenIds.add(accessory.id);
    const family = families.get(accessory.familyId) ?? [];
    family.push(accessory);
    families.set(accessory.familyId, family);
  }

  for (const ownedId of ownedIds) {
    if (!seenIds.has(ownedId)) {
      throw new TypeError(`owned accessory is missing from catalog: ${ownedId}`);
    }
  }

  const familyChoices: FamilyChoice[][] = [];
  const allOpportunities: AccessoryOpportunity[] = [];
  let catalogOwnedMp = 0;

  for (const [, family] of [...families.entries()].sort(([left], [right]) => lexicalCompare(left, right))) {
    family.sort(
      (left, right) =>
        left.tier - right.tier ||
        left.magicalPower - right.magicalPower ||
        lexicalCompare(left.id, right.id),
    );
    const owned = family
      .filter((accessory) => ownedIds.has(accessory.id))
      .sort(
        (left, right) =>
          right.magicalPower - left.magicalPower || right.tier - left.tier,
      )[0];
    const ownedMp = owned?.magicalPower ?? 0;
    catalogOwnedMp += ownedMp;
    const choices: FamilyChoice[] = [{ opportunity: null, cost: 0, gain: 0 }];

    for (const accessory of family) {
      const gain = accessory.magicalPower - ownedMp;
      if (gain <= 0 || ownedIds.has(accessory.id)) continue;
      const opportunity: AccessoryOpportunity = {
        ...accessory,
        magicalPowerGain: gain,
        coinsPerMagicalPower: round(accessory.cost / gain),
        replacesAccessoryId: owned?.id ?? null,
      };
      choices.push({ opportunity, cost: accessory.cost, gain });
      allOpportunities.push(opportunity);
    }
    familyChoices.push(choices);
  }

  const currentMagicalPower = input.currentMagicalPower ?? catalogOwnedMp;
  assertNonNegative(currentMagicalPower, "currentMagicalPower");
  if (currentMagicalPower < catalogOwnedMp) {
    throw new RangeError(
      "currentMagicalPower cannot be lower than MP represented by owned accessories",
    );
  }

  let states: OptimizationState[] = [{ cost: 0, gain: 0, selections: [] }];
  for (const choices of familyChoices) {
    const expanded: OptimizationState[] = [];
    for (const state of states) {
      for (const choice of choices) {
        const cost = state.cost + choice.cost;
        if (cost > budget) continue;
        expanded.push({
          cost,
          gain: state.gain + choice.gain,
          selections: choice.opportunity
            ? [...state.selections, choice.opportunity]
            : state.selections,
        });
      }
    }
    states = pruneDominatedStates(expanded);
  }

  const desiredGain = target ?? Number.POSITIVE_INFINITY;
  const reachingTarget = states
    .filter((state) => state.gain >= desiredGain)
    .sort(compareMinimumCostState);
  const best =
    reachingTarget[0] ??
    [...states].sort(
      (left, right) =>
        right.gain - left.gain || left.cost - right.cost || compareSelections(left, right),
    )[0] ?? { cost: 0, gain: 0, selections: [] };

  const rankedOpportunities = allOpportunities.sort(
    (left, right) =>
      left.coinsPerMagicalPower - right.coinsPerMagicalPower ||
      right.magicalPowerGain - left.magicalPowerGain ||
      lexicalCompare(left.id, right.id),
  );

  return {
    currentMagicalPower,
    selected: [...best.selections].sort(
      (left, right) =>
        left.coinsPerMagicalPower - right.coinsPerMagicalPower || lexicalCompare(left.id, right.id),
    ),
    spent: round(best.cost),
    magicalPowerGain: best.gain,
    resultingMagicalPower: currentMagicalPower + best.gain,
    targetAdditionalMagicalPower: target ?? null,
    targetReached: target === undefined ? null : best.gain >= target,
    remainingBudget: input.budget === undefined ? null : round(budget - best.cost),
    rankedOpportunities,
  };
}

function pruneDominatedStates(states: readonly OptimizationState[]): OptimizationState[] {
  const ordered = [...states].sort(
    (left, right) =>
      left.cost - right.cost || right.gain - left.gain || compareSelections(left, right),
  );
  const frontier: OptimizationState[] = [];
  let bestGain = -1;
  for (const state of ordered) {
    if (state.gain <= bestGain) continue;
    frontier.push(state);
    bestGain = state.gain;
  }
  return frontier;
}

function compareMinimumCostState(
  left: OptimizationState,
  right: OptimizationState,
): number {
  return left.cost - right.cost || right.gain - left.gain || compareSelections(left, right);
}

function compareSelections(left: OptimizationState, right: OptimizationState): number {
  const leftIds = left.selections.map((selection) => selection.id).sort().join("|");
  const rightIds = right.selections.map((selection) => selection.id).sort().join("|");
  return lexicalCompare(leftIds, rightIds);
}

function validateAccessory(accessory: AccessoryOption): void {
  if (!accessory.id.trim() || !accessory.name.trim() || !accessory.familyId.trim()) {
    throw new TypeError("accessory id, name, and familyId are required");
  }
  if (!Number.isInteger(accessory.tier) || accessory.tier < 0) {
    throw new RangeError(`${accessory.id}.tier must be a non-negative integer`);
  }
  assertNonNegative(accessory.magicalPower, `${accessory.id}.magicalPower`);
  assertNonNegative(accessory.cost, `${accessory.id}.cost`);
}
