import type {
  PlayerAnalysis,
  ProfileStat,
  Recommendation,
  SkillSnapshot,
  SkyBlockProfile,
} from "../models";
import type { MinecraftIdentity } from "../providers/mojang";
import type {
  HypixelPlayer,
  HypixelSkyBlockProfile,
} from "../providers/hypixel";
import { isJsonObject, type JsonObject } from "../providers/guards";
import { ProviderError } from "../providers/errors";

const CORE_SKILLS = [
  ["farming", "Farming"],
  ["mining", "Mining"],
  ["combat", "Combat"],
  ["foraging", "Foraging"],
  ["fishing", "Fishing"],
  ["enchanting", "Enchanting"],
  ["alchemy", "Alchemy"],
] as const;

// Standard skill XP increments. This table is versioned in one place so game
// updates cannot silently alter deterministic analysis.
const STANDARD_SKILL_XP = [
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

const SKILL_LEVEL_CAPS: Record<string, number> = {
  farming: 60,
  mining: 60,
  combat: 60,
  foraging: 60,
  fishing: 50,
  enchanting: 60,
  alchemy: 50,
};

export type ProfileRecommendationInputs = {
  skyBlockLevel: number | null;
  purse: number | null;
  bank: number | null;
  availableCoins: number | null;
  magicalPower: number | null;
  skillAverage: number | null;
  skills: Record<string, { level: number | null; xp: number | null }>;
  weakestSkill: { key: string; label: string; level: number } | null;
  catacombsLevel: number | null;
  catacombsXp: number | null;
  totalSlayerXp: number | null;
  hasInventoryData: boolean;
  hasAccessoryBagData: boolean;
};

export type BuildPlayerAnalysisInput = {
  identity: MinecraftIdentity;
  hypixelPlayer: HypixelPlayer;
  profiles: HypixelSkyBlockProfile[];
  requestedProfileId?: string | null;
  fetchedAt: string;
  cacheStatus: "fresh" | "cached" | "stale";
};

export function buildPlayerAnalysis(
  input: BuildPlayerAnalysisInput,
): PlayerAnalysis {
  if (input.profiles.length === 0) {
    throw new ProviderError({
      code: "no_skyblock_profiles",
      message: "This player does not have a visible SkyBlock profile.",
      status: 404,
      action:
        "Confirm the player has joined SkyBlock and enabled the relevant in-game API settings.",
    });
  }

  const requested = input.requestedProfileId
    ? input.profiles.find((profile) => profile.id === input.requestedProfileId)
    : null;
  if (input.requestedProfileId && !requested) {
    throw new ProviderError({
      code: "profile_not_found",
      message: "That SkyBlock profile is not available for this player.",
      status: 404,
      action: "Choose one of the profiles returned by the current lookup.",
    });
  }
  const selected =
    requested ??
    input.profiles.find((profile) => profile.selected) ??
    input.profiles[0];

  const profiles = input.profiles.map((profile) =>
    analyzeSkyBlockProfile(profile, input.identity.uuid),
  );
  const notices = [
    "SkyPilot is an independent project and is not affiliated with or endorsed by Hypixel Inc.",
    "Profile data is fetched only on user request and shared-cached to respect Hypixel API policy.",
    "SkyPilot recommendations and estimates are deterministic, unofficial analysis—not official Hypixel statistics.",
  ];
  if (input.cacheStatus === "stale") {
    notices.push(
      "Hypixel is currently unavailable or rate limited, so this response uses a clearly marked stale cache entry.",
    );
  }

  return {
    source: "hypixel",
    fetchedAt: input.fetchedAt,
    cacheStatus: input.cacheStatus,
    player: {
      username: input.hypixelPlayer.displayName || input.identity.username,
      uuid: input.identity.uuid,
      avatarUrl: null,
    },
    profiles,
    selectedProfileId: selected.id,
    notices,
  };
}

export function analyzeSkyBlockProfile(
  profile: HypixelSkyBlockProfile,
  playerUuid: string,
): SkyBlockProfile {
  const member = profile.members[playerUuid];
  if (!member) {
    return unavailableCoopProfile(profile);
  }

  const inputs = extractRecommendationInputs(profile, member);
  const skills = buildSkills(member);
  const unavailable = buildUnavailable(member, inputs);

  return {
    id: profile.id,
    name: profile.name,
    gameMode: formatGameMode(profile.gameMode),
    selected: profile.selected,
    lastSave: timestampToIso(
      firstNumber(member, [
        ["profile", "last_save"],
        ["last_save"],
      ]),
    ),
    stats: buildStats(inputs),
    skills,
    gear: [],
    recommendations: buildRecommendations(inputs),
    strengths: buildStrengths(inputs),
    weaknesses: buildWeaknesses(inputs),
    unavailable,
  };
}

export function extractRecommendationInputs(
  profile: HypixelSkyBlockProfile,
  member: JsonObject,
): ProfileRecommendationInputs {
  const skills = Object.fromEntries(
    CORE_SKILLS.map(([key]) => {
      const snapshot = skillSnapshot(member, key);
      return [key, { level: snapshot.level, xp: snapshot.xp ?? null }];
    }),
  );
  const knownSkillLevels = CORE_SKILLS.flatMap(([key, label]) => {
    const level = skills[key]?.level;
    return level === null || level === undefined ? [] : [{ key, label, level }];
  });
  const skillAverage = average(knownSkillLevels.map((skill) => skill.level));
  const weakestSkill = knownSkillLevels.reduce<
    { key: string; label: string; level: number } | null
  >((weakest, skill) =>
    !weakest || skill.level < weakest.level ? skill : weakest,
  null);

  const purse = firstNumber(member, [
    ["currencies", "coin_purse"],
    ["coin_purse"],
  ]);
  const bank = firstNumber(profile.banking, [["balance"]]);
  const skyBlockXp = firstNumber(member, [
    ["leveling", "experience"],
    ["leveling", "xp"],
  ]);
  const magicalPower = firstNumber(member, [
    ["accessory_bag_storage", "highest_magical_power"],
    ["accessory_bag_storage", "magical_power"],
    ["magical_power"],
  ]);
  const catacombsLevel = firstNumber(member, [
    ["dungeons", "dungeon_types", "catacombs", "level"],
    ["dungeons", "catacombs", "level"],
  ]);
  const catacombsXp = firstNumber(member, [
    ["dungeons", "dungeon_types", "catacombs", "experience"],
    ["dungeons", "catacombs", "experience"],
  ]);

  return {
    skyBlockLevel: skyBlockXp === null ? null : round(skyBlockXp / 100, 2),
    purse,
    bank,
    availableCoins:
      purse === null && bank === null ? null : (purse ?? 0) + (bank ?? 0),
    magicalPower,
    skillAverage,
    skills,
    weakestSkill,
    catacombsLevel,
    catacombsXp,
    totalSlayerXp: totalSlayerXp(member),
    hasInventoryData: hasNestedData(member, [
      ["inventory", "inv_contents", "data"],
      ["inv_contents", "data"],
    ]),
    hasAccessoryBagData:
      getPath(member, ["accessory_bag_storage"]) !== undefined ||
      hasNestedData(member, [
        ["inventory", "bag_contents", "talisman_bag", "data"],
        ["talisman_bag", "data"],
      ]),
  };
}

function buildStats(inputs: ProfileRecommendationInputs): ProfileStat[] {
  return [
    {
      key: "level",
      label: "SkyBlock Level",
      value: inputs.skyBlockLevel,
      unit: "level",
      note:
        inputs.skyBlockLevel === null
          ? "Unavailable from the current API response"
          : "Derived from official SkyBlock XP",
    },
    { key: "purse", label: "Purse", value: inputs.purse, unit: "coins" },
    { key: "bank", label: "Bank", value: inputs.bank, unit: "coins" },
    {
      key: "networth",
      label: "Estimated Net Worth",
      value: null,
      unit: "coins",
      note: "Requires the separate market valuation pipeline",
    },
    {
      key: "mp",
      label: "Magical Power",
      value: inputs.magicalPower,
      unit: "count",
    },
    {
      key: "skill-average",
      label: "Skill Average",
      value: inputs.skillAverage,
      unit: "level",
      note: "Calculated from visible core skill XP",
    },
    {
      key: "catacombs",
      label: inputs.catacombsLevel === null ? "Catacombs XP" : "Catacombs",
      value: inputs.catacombsLevel ?? inputs.catacombsXp,
      unit: inputs.catacombsLevel === null ? "xp" : "level",
    },
    {
      key: "slayer",
      label: "Slayer XP",
      value: inputs.totalSlayerXp,
      unit: "xp",
    },
    {
      key: "minions",
      label: "Minion Slots",
      value: null,
      unit: "count",
      note: "Unique-craft slot calculation is not yet available",
    },
    {
      key: "museum",
      label: "Museum Completion",
      value: null,
      unit: "percent",
      note: "Requires the separately cached Museum endpoint",
    },
  ];
}

function buildSkills(member: JsonObject): SkillSnapshot[] {
  return CORE_SKILLS.map(([key, label]) => ({
    ...skillSnapshot(member, key),
    key,
    label,
  }));
}

function skillSnapshot(
  member: JsonObject,
  key: string,
): Omit<SkillSnapshot, "key" | "label"> {
  const directLevel = firstNumber(member, [
    ["player_data", "skills", key, "level"],
    ["skills", key, "level"],
  ]);
  const xp = firstNumber(member, [
    ["player_data", "experience", `SKILL_${key.toUpperCase()}`],
    ["player_data", "experience", key],
    [`experience_skill_${key}`],
  ]);

  if (directLevel !== null) {
    const cappedLevel = Math.min(directLevel, SKILL_LEVEL_CAPS[key] ?? 60);
    const wholeLevel = Math.max(0, Math.floor(cappedLevel));
    return {
      level: round(cappedLevel, 2),
      progress:
        cappedLevel >= (SKILL_LEVEL_CAPS[key] ?? 60)
          ? 100
          : round((cappedLevel - wholeLevel) * 100, 1),
      xp,
    };
  }
  if (xp === null) return { level: null, progress: null, xp: null };

  const derived = levelFromXp(xp, SKILL_LEVEL_CAPS[key] ?? 60);
  return { level: derived.level, progress: derived.progress, xp };
}

function levelFromXp(
  xpInput: number,
  levelCap: number,
): { level: number; progress: number } {
  let remaining = Math.max(0, xpInput);
  let completed = 0;
  for (const requirement of STANDARD_SKILL_XP.slice(0, levelCap)) {
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

function buildRecommendations(
  inputs: ProfileRecommendationInputs,
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (inputs.magicalPower !== null && inputs.magicalPower < 500) {
    recommendations.push({
      id: "accessory-efficiency",
      title: "Review efficient Magical Power upgrades",
      reason:
        "Your visible Magical Power is below SkyPilot's 500 MP planning checkpoint, so account-wide accessory upgrades deserve review before speculative gear purchases.",
      category: "Accessories",
      priority: inputs.magicalPower < 300 ? "very-high" : "high",
      estimatedCost: null,
      estimatedBenefit: `Plan the next ${Math.ceil(500 - inputs.magicalPower)} Magical Power`,
      prerequisites: ["Current accessory data must be visible"],
      badge: "HIGH IMPACT",
      href: "/accessories",
    });
  }

  if (
    inputs.weakestSkill &&
    inputs.skillAverage !== null &&
    (inputs.weakestSkill.level < 25 ||
      inputs.skillAverage - inputs.weakestSkill.level >= 5)
  ) {
    recommendations.push({
      id: `skill-${inputs.weakestSkill.key}`,
      title: `Review ${inputs.weakestSkill.label} progression`,
      reason: `${inputs.weakestSkill.label} is the weakest visible core skill relative to this profile's current ${round(inputs.skillAverage, 1)} skill average.`,
      category: "Skills",
      priority: "medium",
      estimatedCost: null,
      estimatedBenefit: `Raise ${inputs.weakestSkill.label} from level ${round(inputs.weakestSkill.level, 1)}`,
      prerequisites: ["Choose a legitimate in-game training method"],
      badge: "REQUIRES GRIND",
      href: `/${inputs.weakestSkill.key}`,
    });
  }

  return recommendations;
}

function buildStrengths(inputs: ProfileRecommendationInputs): string[] {
  const strengths: string[] = [];
  if (inputs.skyBlockLevel !== null && inputs.skyBlockLevel >= 100) {
    strengths.push("Established SkyBlock level progression");
  }
  if (inputs.magicalPower !== null && inputs.magicalPower >= 500) {
    strengths.push("Solid visible Magical Power foundation");
  }
  if (inputs.skillAverage !== null && inputs.skillAverage >= 30) {
    strengths.push("Strong visible core skill average");
  }
  return strengths;
}

function buildWeaknesses(inputs: ProfileRecommendationInputs): string[] {
  const weaknesses: string[] = [];
  if (inputs.magicalPower !== null && inputs.magicalPower < 300) {
    weaknesses.push("Magical Power is below SkyPilot's early progression checkpoint");
  }
  if (
    inputs.weakestSkill &&
    inputs.skillAverage !== null &&
    inputs.skillAverage - inputs.weakestSkill.level >= 5
  ) {
    weaknesses.push(
      `${inputs.weakestSkill.label} trails the visible core skill average`,
    );
  }
  return weaknesses;
}

function buildUnavailable(
  member: JsonObject,
  inputs: ProfileRecommendationInputs,
): string[] {
  const unavailable: string[] = [];
  if (!inputs.hasInventoryData) {
    unavailable.push(
      "Inventory-based gear and net-worth analysis is unavailable because inventory data is hidden or absent.",
    );
  } else {
    unavailable.push(
      "Inventory NBT is visible but intentionally not presented until the size-bounded item parser is enabled.",
    );
  }
  if (!inputs.hasAccessoryBagData) {
    unavailable.push(
      "Detailed accessory ownership is unavailable because accessory bag data is hidden or absent.",
    );
  }
  if (firstNumber(member, [["leveling", "experience"]]) === null) {
    unavailable.push("SkyBlock level XP is unavailable in the current profile payload.");
  }
  unavailable.push(
    "Exact Museum completion requires a separate request-driven Museum lookup.",
  );
  return unavailable;
}

function unavailableCoopProfile(
  profile: HypixelSkyBlockProfile,
): SkyBlockProfile {
  return {
    id: profile.id,
    name: profile.name,
    gameMode: formatGameMode(profile.gameMode),
    selected: profile.selected,
    lastSave: null,
    stats: [],
    skills: [],
    gear: [],
    recommendations: [],
    strengths: [],
    weaknesses: [],
    unavailable: [
      "This profile exists, but the searched player's member data is not present in the current API response.",
    ],
  };
}

function totalSlayerXp(member: JsonObject): number | null {
  const bosses =
    getPath(member, ["slayer", "slayer_bosses"]) ??
    getPath(member, ["slayer_bosses"]);
  if (!isJsonObject(bosses)) return null;
  const values = Object.values(bosses).flatMap((boss) => {
    if (!isJsonObject(boss)) return [];
    const xp = numberOrNull(boss.xp);
    return xp === null ? [] : [xp];
  });
  return values.length > 0 ? values.reduce((sum, xp) => sum + xp, 0) : null;
}

function firstNumber(
  object: JsonObject | null,
  paths: readonly (readonly string[])[],
): number | null {
  if (!object) return null;
  for (const path of paths) {
    const value = numberOrNull(getPath(object, path));
    if (value !== null) return value;
  }
  return null;
}

function getPath(object: JsonObject, path: readonly string[]): unknown {
  let current: unknown = object;
  for (const segment of path) {
    if (!isJsonObject(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function hasNestedData(
  member: JsonObject,
  paths: readonly (readonly string[])[],
): boolean {
  return paths.some((path) => {
    const value = getPath(member, path);
    return typeof value === "string" && value.length > 0;
  });
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length, 2);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function timestampToIso(value: number | null): string | null {
  if (value === null || value > 8_640_000_000_000_000) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function formatGameMode(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "ironman") return "Ironman";
  if (normalized === "bingo") return "Bingo";
  if (normalized === "island") return "Stranded";
  return "Normal";
}
