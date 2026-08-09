import {
  calculateProgression,
  stageForScore,
  type ProgressionProfile,
  type ProgressionStage,
} from "../engines/index.js";
import type { SkyBlockProfile } from "../models.js";

const PROGRESSION_KEYS: readonly (keyof ProgressionProfile)[] = [
  "skyblockLevel",
  "skillAverage",
  "magicalPower",
  "netWorth",
  "catacombsLevel",
  "slayerXp",
  "minionSlots",
  "museumProgress",
];

const METRIC_LABELS: Readonly<Record<keyof ProgressionProfile, string>> = {
  skyblockLevel: "SkyBlock Level",
  skillAverage: "Skill Average",
  magicalPower: "Magical Power",
  netWorth: "Estimated Net Worth",
  catacombsLevel: "Catacombs Level",
  slayerXp: "Slayer XP",
  minionSlots: "Minion Slots",
  museumProgress: "Museum Progress",
};

export interface ProfileProgressionSummary {
  score: number;
  stage: ProgressionStage;
  coverage: number;
  complete: boolean;
  availableMetrics: string[];
  missingMetrics: string[];
  disclaimer: string;
}

export function buildProgressionSummary(
  profile: SkyBlockProfile,
): ProfileProgressionSummary | null {
  const values = extractProgressionProfile(profile);
  const knownKeys = new Set(
    PROGRESSION_KEYS.filter((key) => values[key] !== undefined),
  );
  if (knownKeys.size === 0) return null;

  const engineResult = calculateProgression(values);
  const knownMetrics = engineResult.metrics.filter((metric) => knownKeys.has(metric.key));
  const knownWeight = knownMetrics.reduce((sum, metric) => sum + metric.weight, 0);
  const partialScore = knownMetrics.reduce(
    (sum, metric) => sum + metric.contribution,
    0,
  ) / knownWeight;
  const complete = knownKeys.size === PROGRESSION_KEYS.length;
  const score = complete ? engineResult.score : round(partialScore, 1);
  const missingKeys = PROGRESSION_KEYS.filter((key) => !knownKeys.has(key));

  return {
    score,
    stage: complete ? engineResult.stage : stageForScore(score),
    coverage: round(knownWeight * 100, 1),
    complete,
    availableMetrics: PROGRESSION_KEYS.filter((key) => knownKeys.has(key)).map(
      (key) => METRIC_LABELS[key],
    ),
    missingMetrics: missingKeys.map((key) => METRIC_LABELS[key]),
    disclaimer: complete
      ? engineResult.disclaimer
      : "SkyPilot's unofficial planning score is reweighted across available metrics only; missing metrics are not treated as zero.",
  };
}

function extractProgressionProfile(profile: SkyBlockProfile): ProgressionProfile {
  const stats = new Map(profile.stats.map((stat) => [stat.key.toLowerCase(), stat]));
  const result: ProgressionProfile = {};
  copyStat(stats, "level", result, "skyblockLevel");
  copyStat(stats, "skill-average", result, "skillAverage");
  copyStat(stats, "mp", result, "magicalPower");
  copyStat(stats, "networth", result, "netWorth");
  copyStat(stats, "catacombs", result, "catacombsLevel", "level");
  copyStat(stats, "slayer", result, "slayerXp");
  copyStat(stats, "minions", result, "minionSlots");

  const museum = stats.get("museum");
  const museumValue = knownNonNegative(museum?.value);
  if (museumValue !== null && museum?.unit === "percent" && museumValue <= 100) {
    result.museumProgress = museumValue / 100;
  }
  return result;
}

function copyStat(
  stats: ReadonlyMap<string, SkyBlockProfile["stats"][number]>,
  statKey: string,
  target: ProgressionProfile,
  targetKey: keyof ProgressionProfile,
  requiredUnit?: SkyBlockProfile["stats"][number]["unit"],
): void {
  const stat = stats.get(statKey);
  const value = knownNonNegative(stat?.value);
  if (value !== null && (requiredUnit === undefined || stat?.unit === requiredUnit)) {
    target[targetKey] = value;
  }
}

function knownNonNegative(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

