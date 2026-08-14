import type {
  GearSnapshot,
  PlayerAnalysis,
  ProfileAccessorySummary,
  ProfileItemContainerSummary,
  ProfileItemData,
  ProfileItemSummary,
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
import {
  cleanMinecraftText,
  isJsonObject,
  type JsonObject,
} from "../providers/guards";
import { ProviderError } from "../providers/errors";
import {
  CORE_SKILL_LEVEL_CAPS,
  standardSkillLevelFromXp,
} from "../game-data/skill-xp";

const CORE_SKILLS = [
  ["farming", "Farming"],
  ["mining", "Mining"],
  ["combat", "Combat"],
  ["foraging", "Foraging"],
  ["fishing", "Fishing"],
  ["enchanting", "Enchanting"],
  ["alchemy", "Alchemy"],
] as const;

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

  const itemData = readProfileItemData(member);
  const inputs = extractRecommendationInputs(profile, member);
  const skills = buildSkills(member);
  const unavailable = buildUnavailable(member, inputs, itemData);

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
    stats: buildStats(inputs, itemData),
    skills,
    gear: buildGearDiagnostics(itemData),
    itemData,
    accessories: buildAccessorySummaries(itemData),
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
  const itemData = readProfileItemData(member);
  const inventoryContainer = itemData?.containers.find(
    (container) => container.key === "inventory",
  );
  const accessoryContainer = itemData?.containers.find(
    (container) => container.key === "accessories",
  );

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
    hasInventoryData: inventoryContainer?.state === "parsed",
    hasAccessoryBagData:
      getPath(member, ["accessory_bag_storage"]) !== undefined ||
      accessoryContainer?.state === "parsed",
  };
}

function buildStats(
  inputs: ProfileRecommendationInputs,
  itemData: ProfileItemData | undefined,
): ProfileStat[] {
  const normalizedItemCount =
    itemData?.containers.reduce(
      (total, container) =>
        container.state === "parsed" ? total + container.itemCount : total,
      0,
    ) ?? 0;
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
      note:
        normalizedItemCount > 0
          ? `${normalizedItemCount.toLocaleString("en-US")} safe item summaries are ready, but no current market-price join is available.`
          : "Requires visible item data and the separate current-market valuation pipeline",
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

function readProfileItemData(member: JsonObject): ProfileItemData | undefined {
  const root = getPath(member, ["item_data"]);
  if (!isJsonObject(root) || root.version !== "skyblock-items-v1") {
    return undefined;
  }
  if (!Array.isArray(root.containers) || root.containers.length > 5) {
    return undefined;
  }

  const containers: ProfileItemContainerSummary[] = [];
  for (const value of root.containers) {
    if (!isJsonObject(value)) continue;
    const key = itemContainerKey(value.key);
    const state = itemContainerState(value.state);
    if (!key || !state || typeof value.label !== "string") continue;
    if (
      value.label.length < 1 ||
      value.label.length > 64 ||
      typeof value.note !== "string" ||
      value.note.length > 240 ||
      !Number.isSafeInteger(value.itemCount) ||
      (value.itemCount as number) < 0 ||
      (value.itemCount as number) > 512 ||
      !Number.isSafeInteger(value.skippedItemCount) ||
      (value.skippedItemCount as number) < 0 ||
      (value.skippedItemCount as number) > 512 ||
      typeof value.truncated !== "boolean" ||
      !Array.isArray(value.items) ||
      value.items.length > 216
    ) {
      continue;
    }
    const items = value.items.flatMap((item) => {
      const normalized = readProfileItem(item);
      return normalized ? [normalized] : [];
    });
    if (
      items.length > (value.itemCount as number) ||
      (state !== "parsed" &&
        (items.length > 0 ||
          (value.itemCount as number) > 0 ||
          (value.skippedItemCount as number) > 0))
    ) {
      continue;
    }
    containers.push({
      key,
      label: cleanMinecraftText(value.label, 64),
      state,
      itemCount: value.itemCount as number,
      skippedItemCount: value.skippedItemCount as number,
      items,
      truncated: value.truncated,
      note: cleanMinecraftText(value.note, 240),
    });
  }
  return { version: "skyblock-items-v1", containers };
}

function readProfileItem(value: unknown): ProfileItemSummary | null {
  if (!isJsonObject(value)) return null;
  const slot = value.slot;
  const id = value.id;
  const rarity = itemRarity(value.rarity);
  const category = itemCategory(value.category);
  if (
    !(
      slot === null ||
      (Number.isSafeInteger(slot) && (slot as number) >= 0 && (slot as number) <= 255)
    ) ||
    !(
      id === null ||
      (typeof id === "string" && /^[A-Z0-9_:-]{1,96}$/.test(id))
    ) ||
    typeof value.name !== "string" ||
    value.name.length < 1 ||
    value.name.length > 96 ||
    !Number.isSafeInteger(value.count) ||
    (value.count as number) < 1 ||
    (value.count as number) > 255 ||
    !rarity ||
    !category ||
    !Number.isSafeInteger(value.stars) ||
    (value.stars as number) < 0 ||
    (value.stars as number) > 15 ||
    typeof value.recombobulated !== "boolean"
  ) {
    return null;
  }
  return {
    slot: slot as number | null,
    id: id as string | null,
    name: cleanMinecraftText(value.name, 96),
    count: value.count as number,
    rarity,
    category,
    stars: value.stars as number,
    recombobulated: value.recombobulated,
  };
}

function itemContainerKey(
  value: unknown,
): ProfileItemContainerSummary["key"] | null {
  return value === "inventory" ||
    value === "armor" ||
    value === "equipment" ||
    value === "accessories" ||
    value === "wardrobe"
    ? value
    : null;
}

function itemContainerState(
  value: unknown,
): ProfileItemContainerSummary["state"] | null {
  return value === "parsed" ||
    value === "hidden" ||
    value === "malformed" ||
    value === "oversized" ||
    value === "unsupported"
    ? value
    : null;
}

function itemRarity(value: unknown): ProfileItemSummary["rarity"] | null {
  return value === "COMMON" ||
    value === "UNCOMMON" ||
    value === "RARE" ||
    value === "EPIC" ||
    value === "LEGENDARY" ||
    value === "MYTHIC" ||
    value === "DIVINE" ||
    value === "SUPREME" ||
    value === "SPECIAL" ||
    value === "VERY SPECIAL" ||
    value === "UNKNOWN"
    ? value
    : null;
}

function itemCategory(value: unknown): ProfileItemSummary["category"] | null {
  return value === "helmet" ||
    value === "chestplate" ||
    value === "leggings" ||
    value === "boots" ||
    value === "weapon" ||
    value === "tool" ||
    value === "equipment" ||
    value === "accessory" ||
    value === "item"
    ? value
    : null;
}

function buildGearDiagnostics(
  itemData: ProfileItemData | undefined,
): GearSnapshot[] {
  if (!itemData) return [];
  const armor = itemData.containers.find((item) => item.key === "armor");
  const equipment = itemData.containers.find((item) => item.key === "equipment");
  const inventory = itemData.containers.find((item) => item.key === "inventory");
  const diagnostics: GearSnapshot[] = [];
  const detectedArmorSlots = new Set<string>();

  if (armor?.state === "parsed") {
    for (const [index, item] of armor.items.entries()) {
      const slot = equippedArmorSlot(item, index);
      detectedArmorSlots.add(slot);
      diagnostics.push(gearDiagnostic(slot, item));
    }
    if (!armor.truncated) {
      for (const slot of ["Helmet", "Chestplate", "Leggings", "Boots"]) {
        if (detectedArmorSlots.has(slot)) continue;
        diagnostics.push({
          slot,
          name: "Empty equipped slot",
          rarity: "—",
          status: "missing",
          note: "No item occupied this slot in the decoded equipped-armor container.",
        });
      }
    }
  }

  if (equipment?.state === "parsed") {
    for (const [index, item] of equipment.items.slice(0, 8).entries()) {
      diagnostics.push(gearDiagnostic(`Equipment ${index + 1}`, item));
    }
  }

  if (inventory?.state === "parsed") {
    for (const item of inventory.items
      .filter((candidate) =>
        candidate.category === "weapon" || candidate.category === "tool",
      )
      .slice(0, 4)) {
      diagnostics.push(
        gearDiagnostic(
          item.category === "weapon" ? "Carried weapon" : "Carried tool",
          item,
        ),
      );
    }
  }

  if (diagnostics.length === 0) {
    const failure = [armor, equipment, inventory].find(
      (container) =>
        container &&
        container.state !== "parsed" &&
        container.state !== "hidden",
    );
    if (failure) {
      diagnostics.push({
        slot: "Item data",
        name: "Safe decode unavailable",
        rarity: "—",
        status: "unavailable",
        note: failure.note,
      });
    }
  }
  return diagnostics.slice(0, 20);
}

function gearDiagnostic(slot: string, item: ProfileItemSummary): GearSnapshot {
  const modifiers = [
    item.stars > 0 ? `${item.stars} visible star${item.stars === 1 ? "" : "s"}` : null,
    item.recombobulated ? "recombobulator marker detected" : null,
  ].filter((value): value is string => value !== null);
  return {
    slot,
    name: item.name,
    rarity: item.rarity,
    status: "detected",
    note:
      modifiers.length > 0
        ? `Detected in the latest requested snapshot; ${modifiers.join(", ")}.`
        : "Detected in the latest requested snapshot; no upgrade rating is inferred.",
  };
}

function equippedArmorSlot(item: ProfileItemSummary, index: number): string {
  if (item.category === "helmet") return "Helmet";
  if (item.category === "chestplate") return "Chestplate";
  if (item.category === "leggings") return "Leggings";
  if (item.category === "boots") return "Boots";
  const slot = item.slot ?? index;
  return (["Boots", "Leggings", "Chestplate", "Helmet"] as const)[slot] ??
    `Armor ${index + 1}`;
}

function buildAccessorySummaries(
  itemData: ProfileItemData | undefined,
): ProfileAccessorySummary[] {
  const container = itemData?.containers.find(
    (item) => item.key === "accessories",
  );
  if (container?.state !== "parsed") return [];
  const byId = new Map<string, ProfileAccessorySummary>();
  for (const item of container.items) {
    if (!item.id) continue;
    const existing = byId.get(item.id);
    if (existing) {
      existing.count = Math.min(255, existing.count + item.count);
      continue;
    }
    byId.set(item.id, {
      id: item.id,
      name: item.name,
      rarity: item.rarity,
      familyId: accessoryFamilyId(item.id),
      count: item.count,
    });
  }
  return [...byId.values()].slice(0, 216);
}

function accessoryFamilyId(id: string): string {
  const family = id.replace(/_(?:TALISMAN|RING|ARTIFACT|RELIC)$/, "");
  return family || id;
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
    const cappedLevel = Math.min(directLevel, CORE_SKILL_LEVEL_CAPS[key] ?? 60);
    const wholeLevel = Math.max(0, Math.floor(cappedLevel));
    return {
      level: round(cappedLevel, 2),
      progress:
        cappedLevel >= (CORE_SKILL_LEVEL_CAPS[key] ?? 60)
          ? 100
          : round((cappedLevel - wholeLevel) * 100, 1),
      xp,
    };
  }
  if (xp === null) return { level: null, progress: null, xp: null };

  const derived = standardSkillLevelFromXp(xp, CORE_SKILL_LEVEL_CAPS[key] ?? 60);
  return { level: derived.level, progress: derived.progress, xp };
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
  itemData: ProfileItemData | undefined,
): string[] {
  const unavailable: string[] = [];
  const itemContainers =
    itemData?.containers.filter((container) => container.key !== "accessories") ??
    [];
  const parsedItemContainers = itemContainers.filter(
    (container) => container.state === "parsed",
  );
  const failedContainers = itemData?.containers.filter(
    (container) =>
      container.state === "malformed" ||
      container.state === "oversized" ||
      container.state === "unsupported",
  ) ?? [];

  if (parsedItemContainers.length === 0) {
    unavailable.push(
      "Inventory-based gear and net-worth analysis is unavailable because inventory data is hidden or absent.",
    );
  } else {
    unavailable.push(
      "Safe item identities are available, but exact net worth remains unavailable until a current market-price snapshot is joined.",
    );
  }
  for (const container of failedContainers) {
    unavailable.push(`${container.label}: ${container.note}`);
  }
  if (itemData?.containers.some((container) => container.truncated)) {
    unavailable.push(
      "At least one item container summary reached the fixed safe-item output limit; omitted items were not analyzed.",
    );
  }

  const accessoryContainer = itemData?.containers.find(
    (container) => container.key === "accessories",
  );
  if (!inputs.hasAccessoryBagData || accessoryContainer?.state !== "parsed") {
    unavailable.push(
      "Detailed accessory ownership is unavailable because accessory item identities are hidden, absent, or could not be safely decoded; aggregate Magical Power may still be visible.",
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
