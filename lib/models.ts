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
  status: "strong" | "upgrade" | "missing" | "unavailable";
  note: string;
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
