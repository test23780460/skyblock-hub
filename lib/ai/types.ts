import type { PlayerAnalysis } from "../models";

export type AssistantMode = "beginner" | "normal" | "advanced";

export type AiQuestionCategory =
  | "accessories"
  | "dungeons"
  | "economy"
  | "farming"
  | "minions"
  | "progression"
  | "slayers"
  | "spending"
  | "general";

export type AiContextSource = "none" | "demo" | "player";

export type AiGoalCategory =
  | "accessories"
  | "dungeons"
  | "economy"
  | "farming"
  | "minions"
  | "progression"
  | "slayers";

export type AiCalculatorSelection =
  | {
      kind: "farming";
      inputs: {
        currentXp?: number;
        targetXp: number;
        baseXpPerHour: number;
        xpBoostPercent?: number;
        hoursPerDay?: number;
      };
    }
  | {
      kind: "pet";
      inputs: {
        currentPetXp: number;
        targetPetXp: number;
        skillXpPerHour: number;
        skillToPetXpRatio: number;
        petXpBoostPercent?: number;
      };
    }
  | {
      kind: "minion";
      inputs: {
        minionCount: number;
        baseActionTimeSeconds: number;
        actionsPerOutput?: number;
        itemsPerOutput: number;
        sellPricePerItem: number;
        durationHours?: number;
        fuelSpeedBonusPercent?: number;
        upgradeSpeedBonusPercent?: number;
        outputMultiplier?: number;
        uptime?: number;
        operatingCostPerDay?: number;
      };
    }
  | {
      kind: "dungeon";
      inputs: {
        currentCatacombsXp?: number;
        targetCatacombsXp: number;
        catacombsXpPerCompletion: number;
        minutesPerAttempt: number;
        completionRate?: number;
        expectedRewardPerCompletion?: number;
        chestCostPerCompletion?: number;
        costPerAttempt?: number;
      };
    }
  | {
      kind: "slayer";
      inputs: {
        currentSlayerXp?: number;
        targetSlayerXp: number;
        xpPerBoss: number;
        secondsPerAttempt: number;
        successRate?: number;
        costPerAttempt?: number;
        expectedDropValuePerKill?: number;
      };
    }
  | {
      kind: "garden";
      inputs: {
        baseFortune: number;
        cropSpecificFortune?: number;
        blocksPerHour: number;
        baseDropsPerBlock?: number;
        coinValuePerItem?: number;
        budget?: number;
      };
    };

export interface AiContextSelection {
  source: AiContextSource;
  username?: string;
  profileId?: string;
  budget?: number;
  goals: AiGoalCategory[];
  economyProductIds: string[];
  calculator?: AiCalculatorSelection;
}

export interface AssistantRequest {
  question: string;
  mode: AssistantMode;
  context: AiContextSelection;
}

export type AiFactAuthority =
  | "hypixel-snapshot"
  | "economy-snapshot"
  | "deterministic-engine"
  | "manual-scenario"
  | "demo-fixture";

export interface AiGroundedFact {
  id: string;
  label: string;
  display: string;
  authority: AiFactAuthority;
  freshness?: "fresh" | "cached" | "stale" | "demo";
}

export interface AiGroundedContext {
  schemaVersion: 1;
  source: AiContextSource;
  sourceLabel: string;
  generatedAt: string;
  profile: {
    profileName: string;
    gameMode: string;
    fetchedAt: string;
    cacheStatus: PlayerAnalysis["cacheStatus"];
  } | null;
  progression: unknown | null;
  recommendations: unknown[];
  roadmap: unknown | null;
  economy: unknown[];
  calculator: unknown | null;
  facts: AiGroundedFact[];
  limitations: string[];
  immutableRules: string[];
}

export interface AiStructuredAnswer {
  answer: string;
  evidenceFactIds: string[];
  assumptions: string[];
  missingData: string[];
}

export interface AiProviderUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface AiProviderResult {
  outputText: string | null;
  refusal: string | null;
  usage: AiProviderUsage | null;
}

export interface AiMetricEvent {
  model: string;
  category: AiQuestionCategory;
  failed: boolean;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  occurredAt: Date;
}
