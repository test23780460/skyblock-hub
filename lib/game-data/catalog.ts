import type {
  CatalogMetadata,
  CropDefinition,
  FeatureDefinition,
  RarityDefinition,
  SkillDefinition,
  SlayerDefinition,
} from "./types.js";

export const gameDataMetadata: CatalogMetadata = {
  schemaVersion: 1,
  catalogVersion: "2026.08.1",
  note:
    "Stable identifiers and display metadata live here; volatile prices, recipes, XP tables, and balance values belong to versioned resource data.",
};

export const rarities: readonly RarityDefinition[] = [
  { id: "common", label: "COMMON", rank: 0, color: "#c9d1d9", aliases: ["common"] },
  { id: "uncommon", label: "UNCOMMON", rank: 1, color: "#62e887", aliases: ["uncommon"] },
  { id: "rare", label: "RARE", rank: 2, color: "#56a8ff", aliases: ["rare"] },
  { id: "epic", label: "EPIC", rank: 3, color: "#bd7cff", aliases: ["epic"] },
  { id: "legendary", label: "LEGENDARY", rank: 4, color: "#ffb84d", aliases: ["legendary"] },
  { id: "mythic", label: "MYTHIC", rank: 5, color: "#ff78cd", aliases: ["mythic"] },
  { id: "divine", label: "DIVINE", rank: 6, color: "#61ecff", aliases: ["divine"] },
  { id: "special", label: "SPECIAL", rank: 7, color: "#ff7373", aliases: ["special"] },
  {
    id: "very_special",
    label: "VERY SPECIAL",
    rank: 8,
    color: "#ff7373",
    aliases: ["very special", "very_special", "veryspecial"],
  },
];

export const skills: readonly SkillDefinition[] = [
  { id: "farming", label: "Farming", profileKey: "farming", kind: "core", route: "/garden", aliases: [] },
  { id: "mining", label: "Mining", profileKey: "mining", kind: "core", route: "/mining", aliases: [] },
  { id: "combat", label: "Combat", profileKey: "combat", kind: "core", route: "/skills?skill=combat", aliases: [] },
  { id: "foraging", label: "Foraging", profileKey: "foraging", kind: "core", route: "/foraging", aliases: [] },
  { id: "fishing", label: "Fishing", profileKey: "fishing", kind: "core", route: "/fishing", aliases: [] },
  { id: "enchanting", label: "Enchanting", profileKey: "enchanting", kind: "core", route: "/skills?skill=enchanting", aliases: [] },
  { id: "alchemy", label: "Alchemy", profileKey: "alchemy", kind: "core", route: "/skills?skill=alchemy", aliases: [] },
  { id: "taming", label: "Taming", profileKey: "taming", kind: "support", route: "/skills?skill=taming", aliases: [] },
  { id: "carpentry", label: "Carpentry", profileKey: "carpentry", kind: "support", route: "/skills?skill=carpentry", aliases: [] },
  { id: "runecrafting", label: "Runecrafting", profileKey: "runecrafting", kind: "cosmetic", route: "/skills?skill=runecrafting", aliases: ["rune crafting"] },
  { id: "social", label: "Social", profileKey: "social", kind: "social", route: "/skills?skill=social", aliases: [] },
];

export const crops: readonly CropDefinition[] = [
  { id: "wheat", label: "Wheat", collectionKey: "WHEAT", itemIds: ["WHEAT"], aliases: [] },
  { id: "carrot", label: "Carrot", collectionKey: "CARROT_ITEM", itemIds: ["CARROT_ITEM"], aliases: ["carrots"] },
  { id: "potato", label: "Potato", collectionKey: "POTATO_ITEM", itemIds: ["POTATO_ITEM"], aliases: ["potatoes"] },
  { id: "pumpkin", label: "Pumpkin", collectionKey: "PUMPKIN", itemIds: ["PUMPKIN"], aliases: ["pumpkins"] },
  { id: "melon", label: "Melon", collectionKey: "MELON", itemIds: ["MELON"], aliases: ["melons"] },
  { id: "mushroom", label: "Mushroom", collectionKey: "MUSHROOM_COLLECTION", itemIds: ["RED_MUSHROOM", "BROWN_MUSHROOM"], aliases: ["mushrooms"] },
  { id: "cactus", label: "Cactus", collectionKey: "CACTUS", itemIds: ["CACTUS"], aliases: [] },
  { id: "sugar_cane", label: "Sugar Cane", collectionKey: "SUGAR_CANE", itemIds: ["SUGAR_CANE"], aliases: ["sugarcane", "cane"] },
  { id: "cocoa_beans", label: "Cocoa Beans", collectionKey: "INK_SACK:3", itemIds: ["INK_SACK:3"], aliases: ["cocoa", "cocoa bean"] },
  { id: "nether_wart", label: "Nether Wart", collectionKey: "NETHER_STALK", itemIds: ["NETHER_STALK"], aliases: ["wart", "netherwart"] },
];

export const slayers: readonly SlayerDefinition[] = [
  { id: "zombie", label: "Zombie Slayer", bossName: "Revenant Horror", profileKey: "zombie", area: "overworld", route: "/slayers?type=zombie", aliases: ["revenant", "revenant horror", "rev"] },
  { id: "spider", label: "Spider Slayer", bossName: "Tarantula Broodfather", profileKey: "spider", area: "overworld", route: "/slayers?type=spider", aliases: ["tarantula", "tarantula broodfather", "tara"] },
  { id: "wolf", label: "Wolf Slayer", bossName: "Sven Packmaster", profileKey: "wolf", area: "overworld", route: "/slayers?type=wolf", aliases: ["sven", "sven packmaster"] },
  { id: "enderman", label: "Enderman Slayer", bossName: "Voidgloom Seraph", profileKey: "enderman", area: "end", route: "/slayers?type=enderman", aliases: ["voidgloom", "voidgloom seraph", "eman"] },
  { id: "blaze", label: "Blaze Slayer", bossName: "Inferno Demonlord", profileKey: "blaze", area: "crimson-isle", route: "/slayers?type=blaze", aliases: ["inferno", "inferno demonlord"] },
  { id: "vampire", label: "Vampire Slayer", bossName: "Riftstalker Bloodfiend", profileKey: "vampire", area: "rift", route: "/slayers?type=vampire", aliases: ["riftstalker", "riftstalker bloodfiend", "bloodfiend"] },
];

export const features: readonly FeatureDefinition[] = [
  { id: "dashboard", label: "Dashboard", route: "/dashboard", category: "profile", dataSource: "profile", maturity: "core", requiredProfileKeys: [], engine: null },
  { id: "progression", label: "Progression", route: "/progression", category: "progression", dataSource: "profile", maturity: "core", requiredProfileKeys: ["level", "mp", "skill-average"], engine: "progression" },
  { id: "gear", label: "Gear", route: "/gear", category: "profile", dataSource: "profile", maturity: "conditional", requiredProfileKeys: ["inventory"], engine: null },
  { id: "accessories", label: "Accessories", route: "/accessories", category: "progression", dataSource: "profile-and-economy", maturity: "conditional", requiredProfileKeys: ["mp", "accessory-bag"], engine: "accessories" },
  { id: "bazaar", label: "Bazaar", route: "/bazaar", category: "economy", dataSource: "economy", maturity: "core", requiredProfileKeys: [], engine: "bazaar" },
  { id: "auctions", label: "Auctions", route: "/auctions", category: "economy", dataSource: "economy", maturity: "conditional", requiredProfileKeys: [], engine: "valuation" },
  { id: "garden", label: "Garden", route: "/garden", category: "skill", dataSource: "profile-or-manual", maturity: "core", requiredProfileKeys: ["farming"], engine: "farming" },
  { id: "mining", label: "Mining", route: "/mining", category: "skill", dataSource: "profile-or-manual", maturity: "conditional", requiredProfileKeys: ["mining"], engine: null },
  { id: "foraging", label: "Foraging", route: "/foraging", category: "skill", dataSource: "profile-or-manual", maturity: "conditional", requiredProfileKeys: ["foraging"], engine: null },
  { id: "fishing", label: "Fishing", route: "/fishing", category: "skill", dataSource: "profile-or-manual", maturity: "conditional", requiredProfileKeys: ["fishing"], engine: null },
  { id: "dungeons", label: "Dungeons", route: "/dungeons", category: "progression", dataSource: "profile-or-manual", maturity: "conditional", requiredProfileKeys: ["catacombs"], engine: "dungeon" },
  { id: "slayers", label: "Slayers", route: "/slayers", category: "progression", dataSource: "profile-or-manual", maturity: "conditional", requiredProfileKeys: ["slayer"], engine: "slayer" },
  { id: "minions", label: "Minions", route: "/minions", category: "completion", dataSource: "profile-or-manual", maturity: "conditional", requiredProfileKeys: ["minions"], engine: "minion" },
  { id: "museum", label: "Museum", route: "/museum", category: "completion", dataSource: "profile", maturity: "conditional", requiredProfileKeys: ["museum"], engine: null },
  { id: "collections", label: "Collections", route: "/collections", category: "completion", dataSource: "profile", maturity: "conditional", requiredProfileKeys: ["collections"], engine: null },
  { id: "bestiary", label: "Bestiary", route: "/bestiary", category: "completion", dataSource: "profile", maturity: "conditional", requiredProfileKeys: ["bestiary"], engine: null },
  { id: "rift", label: "Rift", route: "/rift", category: "completion", dataSource: "profile", maturity: "conditional", requiredProfileKeys: ["rift"], engine: null },
  { id: "calculators", label: "Calculators", route: "/calculators", category: "tool", dataSource: "manual", maturity: "core", requiredProfileKeys: [], engine: "calculators" },
];

export function findRarity(value: string): RarityDefinition | undefined {
  return findByIdentity(rarities, value);
}

export function findSkill(value: string): SkillDefinition | undefined {
  return findByIdentity(skills, value);
}

export function findCrop(value: string): CropDefinition | undefined {
  return findByIdentity(crops, value);
}

export function findSlayer(value: string): SlayerDefinition | undefined {
  return findByIdentity(slayers, value);
}

export function findFeature(value: string): FeatureDefinition | undefined {
  const normalized = normalize(value);
  return features.find(
    (feature) => normalize(feature.id) === normalized || normalize(feature.route) === normalized,
  );
}

function findByIdentity<T extends { id: string; label: string; aliases: readonly string[] }>(
  entries: readonly T[],
  value: string,
): T | undefined {
  const normalized = normalize(value);
  return entries.find(
    (entry) =>
      normalize(entry.id) === normalized ||
      normalize(entry.label) === normalized ||
      entry.aliases.some((alias) => normalize(alias) === normalized),
  );
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}
