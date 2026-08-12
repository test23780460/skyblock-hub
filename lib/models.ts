export type DataSource = "hypixel" | "demo";

export type ProfileStat = {
  key: string;
  label: string;
  value: number | null;
  unit?: "coins" | "level" | "percent" | "count" | "xp";
  note?: string;
};

export type SkillSnapshot = {
  key: string;
  label: string;
  level: number | null;
  progress: number | null;
  xp?: number | null;
};

export type GearSnapshot = {
  slot: string;
  name: string;
  rarity: string;
  status: "detected" | "strong" | "upgrade" | "missing" | "unavailable";
  note: string;
};

export type ProfileItemRarity =
  | "COMMON"
  | "UNCOMMON"
  | "RARE"
  | "EPIC"
  | "LEGENDARY"
  | "MYTHIC"
  | "DIVINE"
  | "SUPREME"
  | "SPECIAL"
  | "VERY SPECIAL"
  | "UNKNOWN";

export type ProfileItemCategory =
  | "helmet"
  | "chestplate"
  | "leggings"
  | "boots"
  | "weapon"
  | "tool"
  | "equipment"
  | "accessory"
  | "item";

export type ProfileItemSummary = {
  slot: number | null;
  id: string | null;
  name: string;
  count: number;
  rarity: ProfileItemRarity;
  category: ProfileItemCategory;
  stars: number;
  recombobulated: boolean;
};

export type ProfileItemContainerState =
  | "parsed"
  | "hidden"
  | "malformed"
  | "oversized"
  | "unsupported";

export type ProfileItemContainerSummary = {
  key: "inventory" | "armor" | "equipment" | "accessories" | "wardrobe";
  label: string;
  state: ProfileItemContainerState;
  itemCount: number;
  skippedItemCount: number;
  items: ProfileItemSummary[];
  truncated: boolean;
  note: string;
};

export type ProfileItemData = {
  version: "skyblock-items-v1";
  containers: ProfileItemContainerSummary[];
};

export type ProfileAccessorySummary = {
  id: string;
  name: string;
  rarity: ProfileItemRarity;
  familyId: string;
  count: number;
};

export type RecommendationPriority = "critical" | "very-high" | "high" | "medium" | "long-term";

export type Recommendation = {
  id: string;
  title: string;
  reason: string;
  category: string;
  priority: RecommendationPriority;
  estimatedCost: number | null;
  estimatedBenefit: string;
  prerequisites: string[];
  badge: "BEST VALUE" | "CHEAP UPGRADE" | "HIGH IMPACT" | "LONG TERM" | "REQUIRES GRIND" | "MARKET DEPENDENT";
  href: string;
};

export type SkyBlockProfile = {
  id: string;
  name: string;
  gameMode: string;
  selected: boolean;
  lastSave: string | null;
  stats: ProfileStat[];
  skills: SkillSnapshot[];
  gear: GearSnapshot[];
  itemData?: ProfileItemData;
  accessories?: ProfileAccessorySummary[];
  recommendations: Recommendation[];
  strengths: string[];
  weaknesses: string[];
  unavailable: string[];
};

export type PlayerAnalysis = {
  source: DataSource;
  fetchedAt: string;
  cacheStatus: "fresh" | "cached" | "stale" | "demo";
  player: {
    username: string;
    uuid: string;
    avatarUrl: string | null;
  };
  profiles: SkyBlockProfile[];
  selectedProfileId: string;
  notices: string[];
};

export type ApiFailure = {
  error: {
    code: string;
    message: string;
    action?: string;
    retryAfterSeconds?: number;
  };
};
