import type { JsonRecord } from "@/lib/repositories/contracts";

export const MAX_SAVED_PROFILES = 50;
export const MAX_LINKED_ACCOUNTS = 25;
export const MAX_FAVORITES = 100;
export const MAX_SAVED_BUILDS = 50;

export const planningFocuses = ["progression", "economy", "completion"] as const;
export type PlanningFocus = (typeof planningFocuses)[number];

export const defaultSavedPreferences = {
  defaultPlayer: "",
  defaultBudgetCoins: 50_000_000,
  planningFocus: "progression" as PlanningFocus,
  compactAccountView: false,
};

export type SavedPreferences = typeof defaultSavedPreferences;

export const buildActivities = [
  "general",
  "farming",
  "mining",
  "dungeons",
  "slayers",
  "fishing",
] as const;
export type BuildActivity = (typeof buildActivities)[number];
export type BuildVisibility = "private" | "unlisted" | "public";

export type BuildConfiguration = {
  activity: BuildActivity;
  armor: string;
  weapon: string;
  equipment: string;
  pet: string;
  accessories: string;
  notes: string;
};

export type BuildMutation = {
  title: string;
  description: string | null;
  profileId: string | null;
  visibility: BuildVisibility;
  rotateShareLink: boolean;
  build: BuildConfiguration;
};

type ParseResult<T> = { ok: true; value: T } | { ok: false; message: string };

export function parseSavedProfileCreate(value: unknown): ParseResult<{
  username: string;
  profileId: string;
  alias: string | null;
  isPinned: boolean;
  isPrimary: boolean;
}> {
  if (!isObject(value) || !onlyKeys(value, ["username", "profileId", "alias", "isPinned", "isPrimary"])) {
    return invalid("Provide only the supported saved-profile fields.");
  }
  const username = text(value.username, 16);
  const profileId = normalizedProfileUuid(value.profileId);
  const alias = optionalText(value.alias, 60);
  if (!username || !/^[A-Za-z0-9_]{1,16}$/.test(username)) return invalid("Choose a valid Minecraft username.");
  if (!profileId) return invalid("Choose a profile returned by a live lookup.");
  if (value.alias !== undefined && value.alias !== null && value.alias !== "" && alias === null) return invalid("Profile aliases must be at most 60 characters.");
  if (value.isPinned !== undefined && typeof value.isPinned !== "boolean") return invalid("Pinned must be true or false.");
  if (value.isPrimary !== undefined && typeof value.isPrimary !== "boolean") return invalid("Primary must be true or false.");
  return { ok: true, value: {
    username,
    profileId,
    alias,
    isPinned: value.isPinned === true,
    isPrimary: value.isPrimary === true,
  } };
}

export function parseSavedProfileUpdate(value: unknown): ParseResult<{
  alias?: string | null;
  isPinned?: boolean;
}> {
  if (!isObject(value) || !onlyKeys(value, ["alias", "isPinned"])) return invalid("Provide only alias and pinned state.");
  if (value.alias === undefined && value.isPinned === undefined) return invalid("Choose a profile field to update.");
  const result: { alias?: string | null; isPinned?: boolean } = {};
  if (value.alias !== undefined) {
    const alias = optionalText(value.alias, 60);
    if (value.alias !== null && value.alias !== "" && alias === null) return invalid("Profile aliases must be at most 60 characters.");
    result.alias = alias;
  }
  if (value.isPinned !== undefined) {
    if (typeof value.isPinned !== "boolean") return invalid("Pinned must be true or false.");
    result.isPinned = value.isPinned;
  }
  return { ok: true, value: result };
}

export function parseLinkedAccountUpdate(value: unknown): ParseResult<{
  label?: string | null;
  isPrimary?: boolean;
}> {
  if (!isObject(value) || !onlyKeys(value, ["label", "isPrimary"])) return invalid("Provide only label and primary state.");
  if (value.label === undefined && value.isPrimary === undefined) return invalid("Choose an account field to update.");
  const result: { label?: string | null; isPrimary?: boolean } = {};
  if (value.label !== undefined) {
    const label = optionalText(value.label, 60);
    if (value.label !== null && value.label !== "" && label === null) return invalid("Account labels must be at most 60 characters.");
    result.label = label;
  }
  if (value.isPrimary !== undefined) {
    if (typeof value.isPrimary !== "boolean") return invalid("Primary must be true or false.");
    result.isPrimary = value.isPrimary;
  }
  return { ok: true, value: result };
}

export function parsePreferences(value: unknown): ParseResult<SavedPreferences> {
  if (!isObject(value) || !onlyKeys(value, ["defaultPlayer", "defaultBudgetCoins", "planningFocus", "compactAccountView"])) {
    return invalid("Provide only supported preference fields.");
  }
  const defaultPlayer = value.defaultPlayer === "" ? "" : text(value.defaultPlayer, 16);
  if (defaultPlayer === null || (defaultPlayer && !/^[A-Za-z0-9_]{1,16}$/.test(defaultPlayer))) {
    return invalid("The default player must be a valid Minecraft username or blank.");
  }
  if (!Number.isSafeInteger(value.defaultBudgetCoins) || (value.defaultBudgetCoins as number) < 0 || (value.defaultBudgetCoins as number) > 100_000_000_000) {
    return invalid("The default budget must be a whole number from 0 to 100 billion coins.");
  }
  if (typeof value.planningFocus !== "string" || !planningFocuses.includes(value.planningFocus as PlanningFocus)) {
    return invalid("Choose a supported planning focus.");
  }
  if (typeof value.compactAccountView !== "boolean") return invalid("Compact view must be true or false.");
  return { ok: true, value: {
    defaultPlayer: defaultPlayer ?? "",
    defaultBudgetCoins: value.defaultBudgetCoins as number,
    planningFocus: value.planningFocus as PlanningFocus,
    compactAccountView: value.compactAccountView,
  } };
}

export function normalizePreferences(value: JsonRecord | undefined): SavedPreferences {
  const parsed = parsePreferences(value);
  return parsed.ok ? parsed.value : { ...defaultSavedPreferences };
}

export function preferencesRecord(value: SavedPreferences): JsonRecord {
  return { ...value };
}

export function parseFavorite(value: unknown): ParseResult<{
  resourceType: "tool" | "recommendation" | "profile" | "build";
  resourceId: string;
  label: string | null;
}> {
  if (!isObject(value) || !onlyKeys(value, ["resourceType", "resourceId", "label"])) return invalid("Provide only supported favorite fields.");
  const resourceTypes = ["tool", "recommendation", "profile", "build"] as const;
  if (typeof value.resourceType !== "string" || !resourceTypes.includes(value.resourceType as (typeof resourceTypes)[number])) {
    return invalid("Choose a supported favorite type.");
  }
  const resourceId = text(value.resourceId, 128);
  if (!resourceId || !/^[A-Za-z0-9_:/.-]+$/.test(resourceId)) return invalid("The favorite resource identifier is invalid.");
  const label = optionalText(value.label, 120);
  if (value.label !== undefined && value.label !== null && value.label !== "" && label === null) return invalid("Favorite labels must be at most 120 characters.");
  return { ok: true, value: {
    resourceType: value.resourceType as "tool" | "recommendation" | "profile" | "build",
    resourceId,
    label,
  } };
}

export function parseBuildMutation(value: unknown): ParseResult<BuildMutation> {
  if (!isObject(value) || !onlyKeys(value, ["title", "description", "profileId", "visibility", "rotateShareLink", "build"])) {
    return invalid("Provide only supported build fields.");
  }
  const title = text(value.title, 80);
  const description = optionalText(value.description, 400);
  if (!title) return invalid("Build titles must be 1-80 characters.");
  if (value.description !== undefined && value.description !== null && value.description !== "" && description === null) return invalid("Build descriptions must be at most 400 characters.");
  const visibility = value.visibility;
  if (visibility !== "private" && visibility !== "unlisted" && visibility !== "public") return invalid("Choose private, unlisted, or public visibility.");
  const profileId = value.profileId === null || value.profileId === "" || value.profileId === undefined
    ? null
    : safeProfileId(value.profileId);
  if (value.profileId && !profileId) return invalid("The linked saved profile identifier is invalid.");
  if (value.rotateShareLink !== undefined && typeof value.rotateShareLink !== "boolean") return invalid("Rotate share link must be true or false.");
  const build = parseBuildConfiguration(value.build);
  if (!build.ok) return build;
  return { ok: true, value: {
    title,
    description,
    profileId,
    visibility,
    rotateShareLink: value.rotateShareLink === true,
    build: build.value,
  } };
}

export function buildRecord(configuration: BuildConfiguration): JsonRecord {
  return { ...configuration };
}

export function normalizeBuildConfiguration(value: JsonRecord): BuildConfiguration | null {
  const parsed = parseBuildConfiguration(value);
  return parsed.ok ? parsed.value : null;
}

export function safeProfileId(value: unknown): string | null {
  return typeof value === "string" && /^profile_[0-9a-f]{32}$/.test(value) ? value : null;
}

export function safeMinecraftAccountId(value: unknown): string | null {
  return typeof value === "string" && /^minecraft_[0-9a-f]{32}$/.test(value) ? value : null;
}

export function safeBuildId(value: unknown): string | null {
  return typeof value === "string" && /^build_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value) ? value : null;
}

export function safeShareSlug(value: unknown): string | null {
  return typeof value === "string" && /^share_[0-9a-f]{32}$/.test(value) ? value : null;
}

export function newShareSlug(): string {
  return "share_" + crypto.randomUUID().replaceAll("-", "");
}

export function resolveShareSlug(
  current: string | null,
  visibility: BuildVisibility,
  rotate: boolean,
  create: () => string = newShareSlug,
): string | null {
  if (visibility === "private") return null;
  return !current || rotate ? create() : current;
}

function parseBuildConfiguration(value: unknown): ParseResult<BuildConfiguration> {
  if (!isObject(value) || !onlyKeys(value, ["activity", "armor", "weapon", "equipment", "pet", "accessories", "notes"])) {
    return invalid("Build details contain unsupported fields.");
  }
  if (typeof value.activity !== "string" || !buildActivities.includes(value.activity as BuildActivity)) return invalid("Choose a supported build activity.");
  const armor = optionalText(value.armor, 120);
  const weapon = optionalText(value.weapon, 120);
  const equipment = optionalText(value.equipment, 120);
  const pet = optionalText(value.pet, 120);
  const accessories = optionalText(value.accessories, 200);
  const notes = optionalText(value.notes, 800);
  for (const [raw, parsed, label] of [
    [value.armor, armor, "Armor"],
    [value.weapon, weapon, "Weapon"],
    [value.equipment, equipment, "Equipment"],
    [value.pet, pet, "Pet"],
    [value.accessories, accessories, "Accessories and power"],
    [value.notes, notes, "Notes"],
  ] as const) {
    if (raw !== undefined && raw !== null && raw !== "" && parsed === null) return invalid(`${label} exceeds its allowed length.`);
  }
  return { ok: true, value: {
    activity: value.activity as BuildActivity,
    armor: armor ?? "",
    weapon: weapon ?? "",
    equipment: equipment ?? "",
    pet: pet ?? "",
    accessories: accessories ?? "",
    notes: notes ?? "",
  } };
}

function normalizedProfileUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replaceAll("-", "").toLowerCase();
  return /^[0-9a-f]{32}$/.test(normalized) ? normalized : null;
}

function optionalText(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  return text(value, maxLength);
}

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function onlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function invalid<T>(message: string): ParseResult<T> {
  return { ok: false, message };
}
