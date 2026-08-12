import { assertNonNegative, lexicalCompare, round } from "../internal.js";

export interface MinionTierCraft {
  id: string;
  minionId: string;
  minionName: string;
  tier: number;
  cost: number;
  crafted: boolean;
}

export interface MinionSlotOptimizerInput {
  currentUniqueCrafts: number;
  nextSlotAt: number;
  candidates: readonly MinionTierCraft[];
  budget?: number;
}

export interface RankedMinionCraftPath {
  target: MinionTierCraft;
  requiredCraftIds: string[];
  craftsGained: number;
  totalCost: number;
  averageCostPerCraft: number;
  immediatelyAvailable: boolean;
}

export interface MinionSlotPlan {
  craftsNeeded: number;
  selectedCrafts: MinionTierCraft[];
  totalCost: number;
  affordable: boolean;
  budgetShortfall: number;
}

export interface MinionSlotOptimizerResult {
  currentUniqueCrafts: number;
  nextSlotAt: number;
  craftsNeeded: number;
  reachable: boolean;
  plan: MinionSlotPlan | null;
  rankedPaths: RankedMinionCraftPath[];
  assumptions: string[];
}

type Family = { id: string; crafts: MinionTierCraft[]; uncrafted: MinionTierCraft[] };
type State = { cost: number; selected: MinionTierCraft[] };

export function optimizeNextMinionSlot(
  input: MinionSlotOptimizerInput,
): MinionSlotOptimizerResult {
  validateCount(input.currentUniqueCrafts, "currentUniqueCrafts");
  validateCount(input.nextSlotAt, "nextSlotAt");
  if (input.budget !== undefined) assertNonNegative(input.budget, "budget");
  if (input.candidates.length > 100) {
    throw new RangeError("candidates cannot contain more than 100 crafts");
  }
  const families = buildFamilies(input.candidates);
  const craftsNeeded = Math.max(0, input.nextSlotAt - input.currentUniqueCrafts);
  const rankedPaths = buildRankedPaths(families);
  if (craftsNeeded === 0) {
    return {
      currentUniqueCrafts: input.currentUniqueCrafts,
      nextSlotAt: input.nextSlotAt,
      craftsNeeded,
      reachable: true,
      plan: {
        craftsNeeded: 0,
        selectedCrafts: [],
        totalCost: 0,
        affordable: true,
        budgetShortfall: 0,
      },
      rankedPaths,
      assumptions: assumptions(),
    };
  }

  let states = new Map<number, State>([[0, { cost: 0, selected: [] }]]);
  for (const family of families) {
    const choices: State[] = [{ cost: 0, selected: [] }];
    let runningCost = 0;
    const runningCrafts: MinionTierCraft[] = [];
    for (const craft of family.uncrafted) {
      runningCost += craft.cost;
      runningCrafts.push(craft);
      choices.push({ cost: runningCost, selected: [...runningCrafts] });
    }

    const next = new Map<number, State>();
    for (const [gained, state] of states) {
      for (const choice of choices) {
        const nextGained = Math.min(craftsNeeded, gained + choice.selected.length);
        const candidate: State = {
          cost: state.cost + choice.cost,
          selected: [...state.selected, ...choice.selected],
        };
        const current = next.get(nextGained);
        if (!current || compareState(candidate, current) < 0) next.set(nextGained, candidate);
      }
    }
    states = next;
  }

  const best = states.get(craftsNeeded);
  if (!best) {
    return {
      currentUniqueCrafts: input.currentUniqueCrafts,
      nextSlotAt: input.nextSlotAt,
      craftsNeeded,
      reachable: false,
      plan: null,
      rankedPaths,
      assumptions: assumptions(),
    };
  }
  const budget = input.budget;
  const budgetShortfall = budget === undefined ? 0 : Math.max(0, best.cost - budget);

  return {
    currentUniqueCrafts: input.currentUniqueCrafts,
    nextSlotAt: input.nextSlotAt,
    craftsNeeded,
    reachable: true,
    plan: {
      craftsNeeded,
      selectedCrafts: best.selected,
      totalCost: round(best.cost),
      affordable: budgetShortfall === 0,
      budgetShortfall: round(budgetShortfall),
    },
    rankedPaths,
    assumptions: assumptions(),
  };
}

function buildFamilies(candidates: readonly MinionTierCraft[]): Family[] {
  const seenIds = new Set<string>();
  const byFamily = new Map<string, MinionTierCraft[]>();
  for (const candidate of candidates) {
    if (!candidate.id.trim() || !candidate.minionId.trim() || !candidate.minionName.trim()) {
      throw new TypeError("candidate id, minionId, and minionName are required");
    }
    if (seenIds.has(candidate.id)) throw new TypeError(`duplicate candidate id: ${candidate.id}`);
    seenIds.add(candidate.id);
    if (!Number.isInteger(candidate.tier) || candidate.tier <= 0) {
      throw new RangeError(`${candidate.id}.tier must be a positive integer`);
    }
    assertNonNegative(candidate.cost, `${candidate.id}.cost`);
    const family = byFamily.get(candidate.minionId) ?? [];
    family.push({ ...candidate });
    byFamily.set(candidate.minionId, family);
  }

  return [...byFamily.entries()]
    .map(([id, crafts]) => {
      crafts.sort((left, right) => left.tier - right.tier || lexicalCompare(left.id, right.id));
      const seenTiers = new Set<number>();
      let foundUncrafted = false;
      for (const craft of crafts) {
        if (seenTiers.has(craft.tier)) throw new TypeError(`${id} has duplicate tier ${craft.tier}`);
        seenTiers.add(craft.tier);
        if (!craft.crafted) foundUncrafted = true;
        if (craft.crafted && foundUncrafted) {
          throw new TypeError(`${id} crafted tiers must form a prefix of the supplied tier path`);
        }
      }
      return { id, crafts, uncrafted: crafts.filter((craft) => !craft.crafted) };
    })
    .sort((left, right) => lexicalCompare(left.id, right.id));
}

function buildRankedPaths(families: readonly Family[]): RankedMinionCraftPath[] {
  const paths: RankedMinionCraftPath[] = [];
  for (const family of families) {
    let totalCost = 0;
    const requiredCraftIds: string[] = [];
    for (const craft of family.uncrafted) {
      totalCost += craft.cost;
      requiredCraftIds.push(craft.id);
      paths.push({
        target: craft,
        requiredCraftIds: [...requiredCraftIds],
        craftsGained: requiredCraftIds.length,
        totalCost: round(totalCost),
        averageCostPerCraft: round(totalCost / requiredCraftIds.length),
        immediatelyAvailable: requiredCraftIds.length === 1,
      });
    }
  }
  return paths.sort(
    (left, right) =>
      left.averageCostPerCraft - right.averageCostPerCraft ||
      left.totalCost - right.totalCost ||
      lexicalCompare(left.target.id, right.target.id),
  );
}

function compareState(left: State, right: State): number {
  if (left.cost !== right.cost) return left.cost - right.cost;
  const leftIds = left.selected.map((craft) => craft.id).join("\u0000");
  const rightIds = right.selected.map((craft) => craft.id).join("\u0000");
  return lexicalCompare(leftIds, rightIds);
}

function validateCount(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}

function assumptions(): string[] {
  return [
    "Each supplied family must list its complete relevant tier path in ascending order.",
    "Craft costs are editable planning inputs and do not come from a live market feed.",
    "The exact plan minimizes total entered cost while preserving tier order within each minion family.",
    "Verify collection, material, game-mode, and recipe requirements in game before crafting.",
  ];
}
