import { assertNonNegative, clamp, lexicalCompare, round } from "./internal.js";

export type ProgressionStage = "early" | "mid" | "late" | "endgame";

export interface ProgressionProfile {
  skyblockLevel?: number;
  skillAverage?: number;
  magicalPower?: number;
  netWorth?: number;
  catacombsLevel?: number;
  slayerXp?: number;
  minionSlots?: number;
  museumProgress?: number;
}

export interface ProgressionMetricResult {
  key: keyof ProgressionProfile;
  label: string;
  rawValue: number;
  normalized: number;
  weight: number;
  contribution: number;
}

export interface ProgressionResult {
  score: number;
  stage: ProgressionStage;
  metrics: ProgressionMetricResult[];
  strengths: string[];
  opportunities: string[];
  disclaimer: string;
}

interface MetricDefinition {
  key: keyof ProgressionProfile;
  label: string;
  weight: number;
  normalize: (value: number) => number;
}

const METRICS: readonly MetricDefinition[] = [
  {
    key: "skyblockLevel",
    label: "SkyBlock Level",
    weight: 0.2,
    normalize: (value) => value / 500,
  },
  {
    key: "skillAverage",
    label: "Skill Average",
    weight: 0.16,
    normalize: (value) => value / 60,
  },
  {
    key: "magicalPower",
    label: "Magical Power",
    weight: 0.15,
    normalize: (value) => value / 1_500,
  },
  {
    key: "netWorth",
    label: "Estimated Net Worth",
    weight: 0.15,
    normalize: (value) => Math.log1p(value) / Math.log1p(50_000_000_000),
  },
  {
    key: "catacombsLevel",
    label: "Catacombs Level",
    weight: 0.12,
    normalize: (value) => value / 50,
  },
  {
    key: "slayerXp",
    label: "Slayer XP",
    weight: 0.08,
    normalize: (value) => Math.log1p(value) / Math.log1p(20_000_000),
  },
  {
    key: "minionSlots",
    label: "Minion Slots",
    weight: 0.07,
    normalize: (value) => (value - 5) / 26,
  },
  {
    key: "museumProgress",
    label: "Museum Progress",
    weight: 0.07,
    normalize: (value) => value,
  },
] as const;

export const PROGRESSION_DISCLAIMER =
  "SkyPilot Progression Score is an analytical estimate created by SkyPilot, not an official Hypixel statistic.";

export function calculateProgression(
  profile: ProgressionProfile,
): ProgressionResult {
  validateProfile(profile);

  const metrics = METRICS.map((definition) => {
    const rawValue = profile[definition.key] ?? 0;
    const normalized = clamp(definition.normalize(rawValue), 0, 1);
    return {
      key: definition.key,
      label: definition.label,
      rawValue,
      normalized: round(normalized * 100, 1),
      weight: definition.weight,
      contribution: round(normalized * definition.weight * 100, 2),
    } satisfies ProgressionMetricResult;
  });

  const score = round(
    metrics.reduce((sum, metric) => sum + metric.contribution, 0),
    1,
  );
  const ordered = [...metrics].sort(
    (left, right) =>
      right.normalized - left.normalized || lexicalCompare(left.label, right.label),
  );

  return {
    score,
    stage: stageForScore(score),
    metrics,
    strengths: ordered.slice(0, 2).map((metric) => metric.label),
    opportunities: ordered
      .slice(-2)
      .reverse()
      .map((metric) => metric.label),
    disclaimer: PROGRESSION_DISCLAIMER,
  };
}

export function stageForScore(score: number): ProgressionStage {
  assertNonNegative(score, "score");
  if (score > 100) {
    throw new RangeError("score cannot exceed 100");
  }
  if (score < 25) return "early";
  if (score < 50) return "mid";
  if (score < 75) return "late";
  return "endgame";
}

export function progressionStageRank(stage: ProgressionStage): number {
  return ({ early: 0, mid: 1, late: 2, endgame: 3 } as const)[stage];
}

function validateProfile(profile: ProgressionProfile): void {
  for (const definition of METRICS) {
    const value = profile[definition.key];
    if (value !== undefined) {
      assertNonNegative(value, definition.label);
    }
  }
  if ((profile.museumProgress ?? 0) > 1) {
    throw new RangeError("Museum Progress must be expressed as a ratio from zero to one");
  }
}

