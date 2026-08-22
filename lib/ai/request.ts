import { isJsonObject, normalizeMinecraftUsername, optionalProfileId } from "../providers/guards";
import type {
  AiCalculatorSelection,
  AiContextSelection,
  AiGoalCategory,
  AssistantMode,
  AssistantRequest,
} from "./types";

export type AiRequestParseResult =
  | { ok: true; value: AssistantRequest }
  | { ok: false; code: string; message: string };

type AiContextParseResult =
  | { ok: true; value: AiContextSelection }
  | { ok: false; code: string; message: string };

const CONTEXT_KEYS = new Set([
  "source",
  "username",
  "profileId",
  "budget",
  "goals",
  "economyProductIds",
  "calculator",
]);
const GOAL_CATEGORIES = new Set<AiGoalCategory>([
  "accessories",
  "dungeons",
  "economy",
  "farming",
  "minions",
  "progression",
  "slayers",
]);
const PRODUCT_ID_PATTERN = /^[A-Z0-9_:-]{1,80}$/;
const MAX_NUMBER = 1_000_000_000_000_000;

export function parseAssistantRequest(value: unknown): AiRequestParseResult {
  if (!isJsonObject(value)) return invalid("invalid_request", "The assistant request must be a JSON object.");
  if (!onlyKeys(value, new Set(["question", "mode", "context"]))) {
    return invalid("unsupported_field", "The assistant accepts only question, mode, and server context selectors.");
  }

  const question = typeof value.question === "string" ? value.question.trim() : "";
  if (question.length < 3 || question.length > 1_200) {
    return invalid("invalid_question", "Ask a question between 3 and 1,200 characters.");
  }
  const mode = assistantMode(value.mode);
  if (!mode) return invalid("invalid_mode", "Choose beginner, normal, or advanced detail.");

  const context = parseContext(value.context);
  if (!context.ok) return context;
  return { ok: true, value: { question, mode, context: context.value } };
}

function parseContext(value: unknown): AiContextParseResult {
  if (value === undefined) {
    return { ok: true, value: { source: "none", goals: [], economyProductIds: [] } };
  }
  if (!isJsonObject(value) || !onlyKeys(value, CONTEXT_KEYS)) {
    return invalid(
      "invalid_context_selector",
      "Context may contain only a source, player selectors, planning inputs, economy product IDs, and one calculator scenario.",
    );
  }

  if (value.source !== undefined && value.source !== "demo" && value.source !== "player" && value.source !== "none") {
    return invalid("invalid_context_source", "Choose none, demo, or player context.");
  }
  const source = value.source ?? "none";
  let username: string | undefined;
  let profileId: string | undefined;
  if (source === "player") {
    if (typeof value.username !== "string") {
      return invalid("invalid_player_selector", "A Minecraft username is required for live profile context.");
    }
    try {
      if (value.profileId !== undefined && typeof value.profileId !== "string") throw new TypeError("invalid profile selector");
      username = normalizeMinecraftUsername(value.username);
      profileId = optionalProfileId(typeof value.profileId === "string" ? value.profileId : null) ?? undefined;
    } catch {
      return invalid("invalid_player_selector", "Use a valid Minecraft username and optional profile identifier.");
    }
  } else if (value.username !== undefined || value.profileId !== undefined) {
    return invalid("invalid_player_selector", "Player selectors require the player context source.");
  }

  const budget = optionalNumber(value.budget, { min: 0, max: MAX_NUMBER });
  if (budget === "invalid") return invalid("invalid_budget", "Budget must be a finite non-negative number.");

  const goals = parseGoals(value.goals);
  if (!goals) return invalid("invalid_goals", "Choose up to five supported planning categories.");
  const economyProductIds = parseProductIds(value.economyProductIds);
  if (!economyProductIds) return invalid("invalid_economy_selector", "Choose up to eight valid Bazaar product IDs.");
  const calculator = parseCalculator(value.calculator);
  if (calculator === "invalid") {
    return invalid("invalid_calculator_selector", "The calculator scenario contains unsupported or out-of-range inputs.");
  }

  return {
    ok: true,
    value: {
      source,
      ...(username ? { username } : {}),
      ...(profileId ? { profileId } : {}),
      ...(budget !== undefined ? { budget } : {}),
      goals,
      economyProductIds,
      ...(calculator ? { calculator } : {}),
    },
  };
}

function parseGoals(value: unknown): AiGoalCategory[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 5) return null;
  const result: AiGoalCategory[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !GOAL_CATEGORIES.has(item as AiGoalCategory)) return null;
    if (!result.includes(item as AiGoalCategory)) result.push(item as AiGoalCategory);
  }
  return result;
}

function parseProductIds(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 8) return null;
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    const normalized = item.trim().toUpperCase();
    if (!PRODUCT_ID_PATTERN.test(normalized)) return null;
    if (!result.includes(normalized)) result.push(normalized);
  }
  return result;
}

function parseCalculator(value: unknown): AiCalculatorSelection | undefined | "invalid" {
  if (value === undefined) return undefined;
  if (!isJsonObject(value) || !onlyKeys(value, new Set(["kind", "inputs"])) || !isJsonObject(value.inputs)) return "invalid";
  const inputs = value.inputs;
  switch (value.kind) {
    case "farming": {
      if (!onlyKeys(inputs, new Set(["currentXp", "targetXp", "baseXpPerHour", "xpBoostPercent", "hoursPerDay"]))) return "invalid";
      return calculator(value.kind, inputs, {
        currentXp: optionalNonNegative,
        targetXp: requiredNonNegative,
        baseXpPerHour: requiredPositive,
        xpBoostPercent: optionalPercent,
        hoursPerDay: optionalPositive,
      });
    }
    case "pet": {
      if (!onlyKeys(inputs, new Set(["currentPetXp", "targetPetXp", "skillXpPerHour", "skillToPetXpRatio", "petXpBoostPercent"]))) return "invalid";
      return calculator(value.kind, inputs, {
        currentPetXp: requiredNonNegative,
        targetPetXp: requiredNonNegative,
        skillXpPerHour: requiredPositive,
        skillToPetXpRatio: requiredPositive,
        petXpBoostPercent: optionalPercent,
      });
    }
    case "minion": {
      if (!onlyKeys(inputs, new Set(["minionCount", "baseActionTimeSeconds", "actionsPerOutput", "itemsPerOutput", "sellPricePerItem", "durationHours", "fuelSpeedBonusPercent", "upgradeSpeedBonusPercent", "outputMultiplier", "uptime", "operatingCostPerDay"]))) return "invalid";
      return calculator(value.kind, inputs, {
        minionCount: requiredPositiveInteger,
        baseActionTimeSeconds: requiredPositive,
        actionsPerOutput: optionalPositive,
        itemsPerOutput: requiredNonNegative,
        sellPricePerItem: requiredNonNegative,
        durationHours: optionalPositive,
        fuelSpeedBonusPercent: optionalPercent,
        upgradeSpeedBonusPercent: optionalPercent,
        outputMultiplier: optionalNonNegative,
        uptime: optionalRate,
        operatingCostPerDay: optionalNonNegative,
      });
    }
    case "dungeon": {
      if (!onlyKeys(inputs, new Set(["currentCatacombsXp", "targetCatacombsXp", "catacombsXpPerCompletion", "minutesPerAttempt", "completionRate", "expectedRewardPerCompletion", "chestCostPerCompletion", "costPerAttempt"]))) return "invalid";
      return calculator(value.kind, inputs, {
        currentCatacombsXp: optionalNonNegative,
        targetCatacombsXp: requiredNonNegative,
        catacombsXpPerCompletion: requiredPositive,
        minutesPerAttempt: requiredPositive,
        completionRate: optionalPositiveRate,
        expectedRewardPerCompletion: optionalNonNegative,
        chestCostPerCompletion: optionalNonNegative,
        costPerAttempt: optionalNonNegative,
      });
    }
    case "slayer": {
      if (!onlyKeys(inputs, new Set(["currentSlayerXp", "targetSlayerXp", "xpPerBoss", "secondsPerAttempt", "successRate", "costPerAttempt", "expectedDropValuePerKill"]))) return "invalid";
      return calculator(value.kind, inputs, {
        currentSlayerXp: optionalNonNegative,
        targetSlayerXp: requiredNonNegative,
        xpPerBoss: requiredPositive,
        secondsPerAttempt: requiredPositive,
        successRate: optionalPositiveRate,
        costPerAttempt: optionalNonNegative,
        expectedDropValuePerKill: optionalNonNegative,
      });
    }
    case "garden": {
      if (!onlyKeys(inputs, new Set(["baseFortune", "cropSpecificFortune", "blocksPerHour", "baseDropsPerBlock", "coinValuePerItem", "budget"]))) return "invalid";
      return calculator(value.kind, inputs, {
        baseFortune: requiredNonNegative,
        cropSpecificFortune: optionalNonNegative,
        blocksPerHour: requiredPositive,
        baseDropsPerBlock: optionalPositive,
        coinValuePerItem: optionalNonNegative,
        budget: optionalNonNegative,
      });
    }
    default:
      return "invalid";
  }
}

type NumberReader = (value: unknown) => number | undefined | "invalid";

function calculator(
  kind: AiCalculatorSelection["kind"],
  raw: Record<string, unknown>,
  readers: Record<string, NumberReader>,
): AiCalculatorSelection | "invalid" {
  const parsed: Record<string, number> = {};
  for (const [key, reader] of Object.entries(readers)) {
    const value = reader(raw[key]);
    if (value === "invalid") return "invalid";
    if (value !== undefined) parsed[key] = value;
  }
  return { kind, inputs: parsed } as AiCalculatorSelection;
}

function requiredNonNegative(value: unknown) { return number(value, 0, MAX_NUMBER, true); }
function optionalNonNegative(value: unknown) { return number(value, 0, MAX_NUMBER, false); }
function requiredPositive(value: unknown) { return number(value, Number.MIN_VALUE, MAX_NUMBER, true); }
function optionalPositive(value: unknown) { return number(value, Number.MIN_VALUE, MAX_NUMBER, false); }
function optionalPercent(value: unknown) { return number(value, 0, 10_000, false); }
function optionalRate(value: unknown) { return number(value, 0, 1, false); }
function optionalPositiveRate(value: unknown) { return number(value, Number.MIN_VALUE, 1, false); }
function requiredPositiveInteger(value: unknown) {
  const result = number(value, 1, 10_000, true);
  return typeof result === "number" && !Number.isInteger(result) ? "invalid" : result;
}

function number(value: unknown, min: number, max: number, required: boolean): number | undefined | "invalid" {
  if (value === undefined) return required ? "invalid" : undefined;
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : "invalid";
}

function optionalNumber(value: unknown, range: { min: number; max: number }): number | undefined | "invalid" {
  return number(value, range.min, range.max, false);
}

function assistantMode(value: unknown): AssistantMode | null {
  return value === "beginner" || value === "normal" || value === "advanced" ? value : value === undefined ? "normal" : null;
}

function onlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function invalid(code: string, message: string): { ok: false; code: string; message: string } {
  return { ok: false, code, message };
}
