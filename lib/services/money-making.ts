import type {
  MoneyMakingAttention,
  MoneyMakingCategory,
  MoneyMakingMethodInput,
  MoneyMakingRisk,
  MoneyMakingRequirement,
} from "../engines/money-making.js";
import type { SkyBlockProfile } from "../models.js";

export interface MoneyMakingProfileFacts {
  skyBlockLevel: number | null;
  farmingLevel: number | null;
  miningLevel: number | null;
  fishingLevel: number | null;
  combatLevel: number | null;
  catacombsLevel: number | null;
  totalSlayerXp: number | null;
  marketAccess: boolean | null;
}

export interface MoneyMakingMethodOverride {
  expectedCoinsPerHour?: number;
  setupCost?: number;
  recurringCostPerHour?: number;
}

export type MoneyMakingMethodOverrides = Readonly<
  Record<string, MoneyMakingMethodOverride | undefined>
>;

type ReferenceMethod = {
  id: string;
  name: string;
  category: MoneyMakingCategory;
  expectedCoinsPerHour: number;
  setupCost: number;
  recurringCostPerHour: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  risk: MoneyMakingRisk;
  attention: MoneyMakingAttention;
  note: string;
  requirements: (facts: MoneyMakingProfileFacts) => MoneyMakingRequirement[];
};

const setupVerified = (id: string, verified: ReadonlySet<string>): MoneyMakingRequirement => ({
  id: `${id}-setup`,
  label: "Activity setup and route verified",
  met: verified.has(id),
  weight: 2,
});

const skillRequirement = (
  id: string,
  label: string,
  value: number | null,
  threshold: number,
): MoneyMakingRequirement => ({
  id,
  label: `${label} ${threshold}+`,
  met: value === null ? null : value >= threshold,
});

const referenceMethods: readonly ReferenceMethod[] = [
  {
    id: "farming-crop",
    name: "Crop farming",
    category: "farming",
    expectedCoinsPerHour: 4_500_000,
    setupCost: 18_000_000,
    recurringCostPerHour: 0,
    difficulty: 2,
    risk: "low",
    attention: "active",
    note: "Measure a crop-specific rate with your own Garden setup.",
    requirements: (facts) => [skillRequirement("farming-level", "Farming", facts.farmingLevel, 25)],
  },
  {
    id: "mining-route",
    name: "Mining route",
    category: "mining",
    expectedCoinsPerHour: 12_000_000,
    setupCost: 220_000_000,
    recurringCostPerHour: 250_000,
    difficulty: 5,
    risk: "medium",
    attention: "active",
    note: "Powder, tree allocation, gear, ping, and route execution materially change output.",
    requirements: (facts) => [skillRequirement("mining-level", "Mining", facts.miningLevel, 40)],
  },
  {
    id: "fishing-session",
    name: "Fishing session",
    category: "fishing",
    expectedCoinsPerHour: 5_000_000,
    setupCost: 45_000_000,
    recurringCostPerHour: 100_000,
    difficulty: 3,
    risk: "medium",
    attention: "active",
    note: "Catch availability, party, equipment, and rare drops create a wide range.",
    requirements: (facts) => [
      skillRequirement("fishing-level", "Fishing", facts.fishingLevel, 25),
      skillRequirement("fishing-combat", "Combat", facts.combatLevel, 20),
    ],
  },
  {
    id: "dungeon-runs",
    name: "Dungeon runs",
    category: "dungeons",
    expectedCoinsPerHour: 6_000_000,
    setupCost: 75_000_000,
    recurringCostPerHour: 800_000,
    difficulty: 4,
    risk: "high",
    attention: "active",
    note: "Use realized chest value and completion rate instead of assuming a rare drop.",
    requirements: (facts) => [
      skillRequirement("catacombs-level", "Catacombs", facts.catacombsLevel, 20),
      skillRequirement("dungeon-combat", "Combat", facts.combatLevel, 25),
    ],
  },
  {
    id: "slayer-cycle",
    name: "Slayer cycle",
    category: "slayers",
    expectedCoinsPerHour: 3_000_000,
    setupCost: 30_000_000,
    recurringCostPerHour: 1_500_000,
    difficulty: 4,
    risk: "high",
    attention: "active",
    note: "Quest costs and long-run drop value must be entered separately.",
    requirements: (facts) => [
      skillRequirement("slayer-combat", "Combat", facts.combatLevel, 25),
      {
        id: "slayer-xp",
        label: "50,000+ total visible Slayer XP",
        met: facts.totalSlayerXp === null ? null : facts.totalSlayerXp >= 50_000,
      },
    ],
  },
  {
    id: "bazaar-orders",
    name: "Bazaar orders",
    category: "bazaar",
    expectedCoinsPerHour: 4_000_000,
    setupCost: 25_000_000,
    recurringCostPerHour: 200_000,
    difficulty: 3,
    risk: "high",
    attention: "semi-active",
    note: "Fill speed, fees, competition, and price movement can erase a displayed spread.",
    requirements: (facts) => [
      {
        id: "bazaar-access",
        label: "Profile can use the Bazaar for ordinary products",
        met: facts.marketAccess,
      },
      skillRequirement("bazaar-level", "SkyBlock Level", facts.skyBlockLevel, 7),
    ],
  },
  {
    id: "auction-resale",
    name: "Auction resale",
    category: "auction",
    expectedCoinsPerHour: 5_000_000,
    setupCost: 80_000_000,
    recurringCostPerHour: 450_000,
    difficulty: 5,
    risk: "high",
    attention: "semi-active",
    note: "Completed comparable sales matter more than optimistic active listings.",
    requirements: (facts) => [{
      id: "auction-access",
      label: "Profile can use the Auction House",
      met: facts.marketAccess,
    }],
  },
  {
    id: "recipe-crafting",
    name: "Recipe crafting",
    category: "crafting",
    expectedCoinsPerHour: 3_000_000,
    setupCost: 12_000_000,
    recurringCostPerHour: 250_000,
    difficulty: 2,
    risk: "medium",
    attention: "semi-active",
    note: "Verify every recipe unlock, ingredient quantity, fee, and realistic sale price.",
    requirements: () => [],
  },
  {
    id: "npc-spread",
    name: "NPC comparison",
    category: "npc",
    expectedCoinsPerHour: 1_000_000,
    setupCost: 2_000_000,
    recurringCostPerHour: 0,
    difficulty: 1,
    risk: "low",
    attention: "semi-active",
    note: "Use only legitimate current limits and mechanics you have verified in game.",
    requirements: () => [],
  },
  {
    id: "custom-method",
    name: "Custom method",
    category: "other",
    expectedCoinsPerHour: 0,
    setupCost: 0,
    recurringCostPerHour: 0,
    difficulty: 1,
    risk: "low",
    attention: "active",
    note: "Replace the zero-rate scenario with a legitimate method you measured yourself.",
    requirements: () => [],
  },
] as const;

export function moneyMakingFactsFromProfile(
  profile: SkyBlockProfile,
): MoneyMakingProfileFacts {
  const skill = (key: string): number | null =>
    profile.skills.find((entry) => entry.key === key)?.level ?? null;
  const stat = (key: string): number | null =>
    profile.stats.find((entry) => entry.key === key)?.value ?? null;
  const normalMarketProfile = profile.gameMode.trim().toLowerCase() === "normal";

  return {
    skyBlockLevel: stat("level"),
    farmingLevel: skill("farming"),
    miningLevel: skill("mining"),
    fishingLevel: skill("fishing"),
    combatLevel: skill("combat"),
    catacombsLevel: stat("catacombs"),
    totalSlayerXp: stat("slayer"),
    marketAccess: normalMarketProfile,
  };
}

export function availableCoinsFromProfile(profile: SkyBlockProfile): number | null {
  const values = ["purse", "bank"].map(
    (key) => profile.stats.find((entry) => entry.key === key)?.value ?? null,
  );
  return values.every((value) => value === null)
    ? null
    : values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

export function buildReferenceMoneyMakingMethods(
  facts: MoneyMakingProfileFacts,
  verifiedMethodIds: ReadonlySet<string>,
  overrides: MoneyMakingMethodOverrides = {},
): MoneyMakingMethodInput[] {
  return referenceMethods.map((method) => {
    const override = overrides[method.id];
    return {
      id: method.id,
      name: method.name,
      category: method.category,
      expectedCoinsPerHour:
        override?.expectedCoinsPerHour ?? method.expectedCoinsPerHour,
      setupCost: override?.setupCost ?? method.setupCost,
      recurringCostPerHour:
        override?.recurringCostPerHour ?? method.recurringCostPerHour,
      difficulty: method.difficulty,
      risk: method.risk,
      attention: method.attention,
      note: method.note,
      requirements: [
        ...method.requirements(facts),
        setupVerified(method.id, verifiedMethodIds),
      ],
    };
  });
}

export function referenceMoneyMakingDefaults(): MoneyMakingMethodOverrides {
  return Object.fromEntries(
    referenceMethods.map((method) => [
      method.id,
      {
        expectedCoinsPerHour: method.expectedCoinsPerHour,
        setupCost: method.setupCost,
        recurringCostPerHour: method.recurringCostPerHour,
      },
    ]),
  );
}
