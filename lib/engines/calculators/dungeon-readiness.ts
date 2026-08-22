import { assertNonNegative, assertRate, clamp, lexicalCompare, round } from "../internal.js";

export type DungeonFloorId =
  | "entrance"
  | "f1" | "f2" | "f3" | "f4" | "f5" | "f6" | "f7"
  | "m1" | "m2" | "m3" | "m4" | "m5" | "m6" | "m7";

export type DungeonReadinessStatus = "locked" | "needs-work" | "practice-ready" | "confident";

export interface DungeonReadinessMetricInput {
  id: "class-level" | "effective-health" | "boss-damage" | "secrets" | "completion-rate";
  label: string;
  current: number;
  target: number;
  unit: string;
  weight: number;
}

export interface DungeonReadinessInput {
  floor: DungeonFloorId;
  combatLevel: number;
  catacombsLevel: number;
  floorUnlocked: boolean;
  metrics: readonly DungeonReadinessMetricInput[];
}

export interface DungeonReadinessDeficiency {
  id: string;
  label: string;
  current: number;
  target: number;
  gap: number;
  unit: string;
  completionPercent: number;
  recommendation: string;
}

export interface DungeonReadinessResult {
  floor: DungeonFloorId;
  floorLabel: string;
  officialMinimumCombatLevel: number;
  officialMinimumCatacombsLevel: number;
  entryEligible: boolean;
  entryBlockers: string[];
  readinessScore: number | null;
  coveragePercent: number;
  status: DungeonReadinessStatus;
  deficiencies: DungeonReadinessDeficiency[];
  strengths: string[];
  explanation: string;
  disclaimer: string;
}

const floors: Readonly<Record<DungeonFloorId, { label: string; combat: number; catacombs: number }>> = {
  entrance: { label: "Entrance", combat: 15, catacombs: 0 },
  f1: { label: "Floor I", combat: 15, catacombs: 1 },
  f2: { label: "Floor II", combat: 15, catacombs: 3 },
  f3: { label: "Floor III", combat: 15, catacombs: 5 },
  f4: { label: "Floor IV", combat: 15, catacombs: 9 },
  f5: { label: "Floor V", combat: 15, catacombs: 14 },
  f6: { label: "Floor VI", combat: 15, catacombs: 19 },
  f7: { label: "Floor VII", combat: 15, catacombs: 24 },
  m1: { label: "Master Mode I", combat: 15, catacombs: 24 },
  m2: { label: "Master Mode II", combat: 15, catacombs: 26 },
  m3: { label: "Master Mode III", combat: 15, catacombs: 28 },
  m4: { label: "Master Mode IV", combat: 15, catacombs: 30 },
  m5: { label: "Master Mode V", combat: 15, catacombs: 32 },
  m6: { label: "Master Mode VI", combat: 15, catacombs: 34 },
  m7: { label: "Master Mode VII", combat: 15, catacombs: 36 },
};

export function evaluateDungeonReadiness(input: DungeonReadinessInput): DungeonReadinessResult {
  const floor = floors[input.floor];
  if (!floor) throw new TypeError("floor is invalid");
  assertNonNegative(input.combatLevel, "combatLevel");
  assertNonNegative(input.catacombsLevel, "catacombsLevel");
  if (input.metrics.length > 20) throw new RangeError("metrics cannot exceed 20 entries");

  const seen = new Set<string>();
  const activeMetrics = input.metrics.filter((metric) => {
    if (seen.has(metric.id)) throw new TypeError(`duplicate readiness metric: ${metric.id}`);
    seen.add(metric.id);
    if (!metric.label.trim() || !metric.unit.trim()) throw new TypeError(`${metric.id} requires a label and unit`);
    assertNonNegative(metric.current, `${metric.id}.current`);
    assertNonNegative(metric.target, `${metric.id}.target`);
    assertNonNegative(metric.weight, `${metric.id}.weight`);
    if (metric.id === "completion-rate") {
      assertRate(metric.current, `${metric.id}.current`);
      assertRate(metric.target, `${metric.id}.target`);
    }
    return metric.target > 0 && metric.weight > 0;
  });
  const totalWeight = activeMetrics.reduce((sum, metric) => sum + metric.weight, 0);
  const achievedWeight = activeMetrics.reduce(
    (sum, metric) => sum + clamp(metric.current / metric.target, 0, 1) * metric.weight,
    0,
  );
  const readinessScore = totalWeight === 0 ? null : round(achievedWeight / totalWeight * 100, 1);
  const coveragePercent = input.metrics.length === 0
    ? 0
    : round(activeMetrics.length / input.metrics.length * 100, 1);
  const entryBlockers: string[] = [];
  if (input.combatLevel < floor.combat) entryBlockers.push(`Combat ${floor.combat}`);
  if (input.catacombsLevel < floor.catacombs) entryBlockers.push(`Catacombs ${floor.catacombs}`);
  if (!input.floorUnlocked) entryBlockers.push("Required prior floor or mode completion");
  const entryEligible = entryBlockers.length === 0;
  const deficiencies = activeMetrics
    .filter((metric) => metric.current < metric.target)
    .map((metric): DungeonReadinessDeficiency => ({
      id: metric.id,
      label: metric.label,
      current: round(metric.current, 2),
      target: round(metric.target, 2),
      gap: round(metric.target - metric.current, 2),
      unit: metric.unit,
      completionPercent: round(clamp(metric.current / metric.target * 100, 0, 100), 1),
      recommendation: recommendationFor(metric),
    }))
    .sort(
      (left, right) =>
        left.completionPercent - right.completionPercent || lexicalCompare(left.id, right.id),
    );
  const strengths = activeMetrics
    .filter((metric) => metric.current >= metric.target)
    .map((metric) => `${metric.label} meets the entered planning checkpoint.`);
  const status = readinessStatus(entryEligible, readinessScore);

  return {
    floor: input.floor,
    floorLabel: floor.label,
    officialMinimumCombatLevel: floor.combat,
    officialMinimumCatacombsLevel: floor.catacombs,
    entryEligible,
    entryBlockers,
    readinessScore,
    coveragePercent,
    status,
    deficiencies,
    strengths,
    explanation: explain(status, floor.label, deficiencies.length, entryBlockers),
    disclaimer:
      "Official entry levels only determine access. The editable SkyPilot readiness score is unofficial, cannot prove survivability or party acceptance, and never guarantees a completion.",
  };
}

export function dungeonFloorCatalog(): readonly { id: DungeonFloorId; label: string; minimumCatacombsLevel: number }[] {
  return (Object.entries(floors) as [DungeonFloorId, (typeof floors)[DungeonFloorId]][]).map(
    ([id, floor]) => ({ id, label: floor.label, minimumCatacombsLevel: floor.catacombs }),
  );
}

function readinessStatus(entryEligible: boolean, score: number | null): DungeonReadinessStatus {
  if (!entryEligible) return "locked";
  if (score === null || score < 55) return "needs-work";
  if (score < 80) return "practice-ready";
  return "confident";
}

function recommendationFor(metric: DungeonReadinessMetricInput): string {
  if (metric.id === "class-level") return "Train the intended class on a lower floor and verify its milestone bonuses.";
  if (metric.id === "effective-health") return "Review dungeonized armor, stars, survivability modifiers, pet, and class role.";
  if (metric.id === "boss-damage") return "Review weapon requirements, upgrades, Magical Power, class scaling, and target mechanics.";
  if (metric.id === "secrets") return "Practice room routes and secret recognition without automation or unfair client assistance.";
  return "Use measured recent completions; lower the target floor if failed runs remain common.";
}

function explain(
  status: DungeonReadinessStatus,
  floorLabel: string,
  deficiencyCount: number,
  entryBlockers: readonly string[],
): string {
  if (status === "locked") return `${floorLabel} is not entry-eligible under the supplied levels and unlock confirmation: ${entryBlockers.join(", ")}.`;
  if (status === "needs-work") return `${floorLabel} is unlocked, but the supplied setup remains below several planning checkpoints.`;
  if (status === "practice-ready") return `${floorLabel} is unlocked and the supplied setup is suitable for cautious practice; ${deficiencyCount} checkpoint${deficiencyCount === 1 ? " remains" : "s remain"}.`;
  return `${floorLabel} is unlocked and the supplied metrics meet most or all entered checkpoints; verify the setup in real runs.`;
}
