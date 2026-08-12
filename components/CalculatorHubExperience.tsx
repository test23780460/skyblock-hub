"use client";

import { useMemo, useState } from "react";
import Link from "@/components/AppLink";
import { DungeonReadinessEvaluator } from "@/components/DungeonReadinessEvaluator";
import { MinionSlotOptimizer } from "@/components/MinionSlotOptimizer";
import {
  estimateDungeonRuns,
  estimateFarmingLevelTarget,
  estimateMinionProfit,
  estimatePetXp,
  estimateSlayerProgress,
} from "@/lib/engines/calculators/index";
import { scoreBazaarFlip } from "@/lib/engines/bazaar";

type CalculatorId = "farming" | "pet" | "minion" | "dungeon" | "slayer" | "bazaar";

export type CalculatorPageFocus = "hub" | "dungeon" | "slayer" | "minion";

type CalculatorField = {
  key: string;
  label: string;
  help: string;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
};

type ResultMetric = {
  label: string;
  value: string;
  tone?: "positive" | "warning";
};

type CalculatorResult = {
  title: string;
  summary: string;
  metrics: ResultMetric[];
  assumptions: string[];
};

type CalculatorDefinition = {
  id: CalculatorId;
  short: string;
  title: string;
  description: string;
  icon: string;
  fields: CalculatorField[];
  defaults: Record<string, number>;
};

const calculators: CalculatorDefinition[] = [
  {
    id: "farming",
    short: "Farming",
    title: "Farming XP target",
    description: "Turn a measured crop rate into hours and play sessions to a Farming XP target.",
    icon: "F",
    fields: [
      { key: "currentLevel", label: "Current Farming level", help: "Fractional levels are accepted, from 0 through 60.", min: 0, max: 60, step: 0.01 },
      { key: "targetLevel", label: "Target Farming level", help: "The desired level on the standard Farming XP curve.", min: 0, max: 60, step: 0.01 },
      { key: "baseXpPerHour", label: "Measured XP per hour", help: "Use a rate you can sustain, before the boost below.", min: 0, step: 1, suffix: "XP/h" },
      { key: "xpBoostPercent", label: "Additional XP boost", help: "Optional boost applied to the measured base rate.", min: 0, step: 0.1, suffix: "%" },
      { key: "hoursPerDay", label: "Hours per play day", help: "Used only to estimate play days.", min: 0.1, step: 0.1, suffix: "h" },
    ],
    defaults: { currentLevel: 30, targetLevel: 40, baseXpPerHour: 900_000, xpBoostPercent: 20, hoursPerDay: 2 },
  },
  {
    id: "pet",
    short: "Pet XP",
    title: "Pet leveling time",
    description: "Estimate pet XP from a source-skill rate, conversion ratio, and pet XP boosts.",
    icon: "P",
    fields: [
      { key: "currentPetXp", label: "Current pet XP", help: "Current total XP on this pet.", min: 0, step: 1 },
      { key: "targetPetXp", label: "Target pet XP", help: "Total XP needed for the desired level.", min: 0, step: 1 },
      { key: "skillXpPerHour", label: "Source skill XP/hour", help: "Your measured rate in the skill feeding pet XP.", min: 0, step: 1, suffix: "XP/h" },
      { key: "skillToPetXpRatio", label: "Skill-to-pet ratio", help: "Pet XP earned per point of source skill XP.", min: 0, step: 0.01, suffix: "x" },
      { key: "petXpBoostPercent", label: "Pet XP boost", help: "Pet item and other applicable boosts combined.", min: 0, step: 0.1, suffix: "%" },
    ],
    defaults: { currentPetXp: 2_500_000, targetPetXp: 25_000_000, skillXpPerHour: 1_200_000, skillToPetXpRatio: 0.25, petXpBoostPercent: 40 },
  },
  {
    id: "minion",
    short: "Minions",
    title: "Minion production",
    description: "Model output and net income with speed, fuel, uptime, duration, and operating costs exposed.",
    icon: "M",
    fields: [
      { key: "minionCount", label: "Minion count", help: "Number of identical minions in this model.", min: 1, step: 1 },
      { key: "baseActionTimeSeconds", label: "Base action time", help: "Seconds per action before speed bonuses.", min: 0.01, step: 0.01, suffix: "sec" },
      { key: "actionsPerOutput", label: "Actions per output", help: "Many minions require two actions per output.", min: 0.01, step: 0.01 },
      { key: "itemsPerOutput", label: "Items per output", help: "Items produced by one completed output cycle.", min: 0, step: 0.01 },
      { key: "sellPricePerItem", label: "Sale price per item", help: "Your chosen net sale-price assumption.", min: 0, step: 0.01, suffix: "coins" },
      { key: "durationHours", label: "Modeled duration", help: "How long the minions are modeled to run.", min: 0.01, step: 0.1, suffix: "h" },
      { key: "fuelSpeedBonusPercent", label: "Fuel speed bonus", help: "Fuel speed increase as a percentage.", min: 0, step: 0.1, suffix: "%" },
      { key: "upgradeSpeedBonusPercent", label: "Upgrade speed bonus", help: "Combined speed from supported upgrades.", min: 0, step: 0.1, suffix: "%" },
      { key: "outputMultiplier", label: "Output multiplier", help: "Use 1 unless an applicable upgrade changes output.", min: 0, step: 0.01, suffix: "x" },
      { key: "uptimePercent", label: "Expected uptime", help: "Allows for storage caps or collection downtime.", min: 0, max: 100, step: 0.1, suffix: "%" },
      { key: "operatingCostPerDay", label: "Operating cost/day", help: "Fuel and consumable cost for the whole setup.", min: 0, step: 1, suffix: "coins" },
    ],
    defaults: { minionCount: 20, baseActionTimeSeconds: 12, actionsPerOutput: 2, itemsPerOutput: 1, sellPricePerItem: 50, durationHours: 24, fuelSpeedBonusPercent: 25, upgradeSpeedBonusPercent: 10, outputMultiplier: 1, uptimePercent: 95, operatingCostPerDay: 50_000 },
  },
  {
    id: "dungeon",
    short: "Dungeons",
    title: "Dungeon run target",
    description: "Estimate completions, attempts, time, and a cautious reward-cost scenario for a Catacombs target.",
    icon: "D",
    fields: [
      { key: "currentCatacombsXp", label: "Current Catacombs XP", help: "Current total Catacombs XP.", min: 0, step: 1 },
      { key: "targetCatacombsXp", label: "Target Catacombs XP", help: "Total XP at the target level.", min: 0, step: 1 },
      { key: "catacombsXpPerCompletion", label: "XP per completion", help: "A conservative average for the floor and score.", min: 0.01, step: 1, suffix: "XP" },
      { key: "minutesPerAttempt", label: "Minutes per attempt", help: "Include queueing and failed runs.", min: 0.01, step: 0.1, suffix: "min" },
      { key: "completionRatePercent", label: "Completion rate", help: "Expected successful completions divided by attempts.", min: 0.1, max: 100, step: 0.1, suffix: "%" },
      { key: "expectedRewardPerCompletion", label: "Expected reward/run", help: "Average realized value, not a rare-drop promise.", min: 0, step: 1, suffix: "coins" },
      { key: "chestCostPerCompletion", label: "Chest cost/run", help: "Average chest purchase cost per completion.", min: 0, step: 1, suffix: "coins" },
      { key: "costPerAttempt", label: "Other cost/attempt", help: "Consumables and other recurring costs.", min: 0, step: 1, suffix: "coins" },
    ],
    defaults: { currentCatacombsXp: 2_000_000, targetCatacombsXp: 6_000_000, catacombsXpPerCompletion: 25_000, minutesPerAttempt: 8, completionRatePercent: 90, expectedRewardPerCompletion: 50_000, chestCostPerCompletion: 25_000, costPerAttempt: 2_000 },
  },
  {
    id: "slayer",
    short: "Slayers",
    title: "Slayer XP and cost",
    description: "Project bosses, attempts, time, quest costs, and expected drops without assuming rare-drop luck.",
    icon: "S",
    fields: [
      { key: "currentSlayerXp", label: "Current Slayer XP", help: "Current XP in the selected Slayer category.", min: 0, step: 1 },
      { key: "targetSlayerXp", label: "Target Slayer XP", help: "Total XP at your chosen target.", min: 0, step: 1 },
      { key: "xpPerBoss", label: "XP per boss", help: "XP awarded by the modeled boss tier.", min: 0.01, step: 1, suffix: "XP" },
      { key: "secondsPerAttempt", label: "Seconds per attempt", help: "Include spawning and kill time.", min: 0.01, step: 0.1, suffix: "sec" },
      { key: "successRatePercent", label: "Success rate", help: "Expected successful kills divided by attempts.", min: 0.1, max: 100, step: 0.1, suffix: "%" },
      { key: "costPerAttempt", label: "Quest cost/attempt", help: "Coins spent for each attempt.", min: 0, step: 1, suffix: "coins" },
      { key: "expectedDropValuePerKill", label: "Expected drops/kill", help: "Long-run average value, not a guaranteed return.", min: 0, step: 1, suffix: "coins" },
    ],
    defaults: { currentSlayerXp: 10_000, targetSlayerXp: 100_000, xpPerBoss: 500, secondsPerAttempt: 90, successRatePercent: 98, costPerAttempt: 50_000, expectedDropValuePerKill: 20_000 },
  },
  {
    id: "bazaar",
    short: "Bazaar",
    title: "Bazaar flip quality",
    description: "Score a buy-order to sell-offer scenario using fees, liquidity, participation, and volatility.",
    icon: "B",
    fields: [
      { key: "buyOrderPrice", label: "Buy-order price", help: "Expected filled acquisition price per unit.", min: 0.01, step: 0.01, suffix: "coins" },
      { key: "sellOfferPrice", label: "Sell-offer price", help: "Expected gross proceeds per filled unit.", min: 0.01, step: 0.01, suffix: "coins" },
      { key: "buyVolume", label: "Buy-side volume", help: "Observed volume across the selected window.", min: 0, step: 1 },
      { key: "sellVolume", label: "Sell-side volume", help: "Observed volume across the selected window.", min: 0, step: 1 },
      { key: "buyOrders", label: "Buy orders", help: "Observed order count for depth context.", min: 0, step: 1 },
      { key: "sellOrders", label: "Sell orders", help: "Observed order count for depth context.", min: 0, step: 1 },
      { key: "volatilityPercent", label: "Modeled volatility", help: "Zero is stable and 100% is extreme.", min: 0, max: 100, step: 0.1, suffix: "%" },
      { key: "volumeWindowHours", label: "Volume window", help: "Hours covered by the volume inputs.", min: 0.01, step: 1, suffix: "h" },
      { key: "participationPercent", label: "Your participation", help: "Share of minimum-side volume you might fill.", min: 0, max: 100, step: 0.1, suffix: "%" },
      { key: "sellFeePercent", label: "Sell fee", help: "Applied to gross sale proceeds.", min: 0, max: 100, step: 0.01, suffix: "%" },
    ],
    defaults: { buyOrderPrice: 950, sellOfferPrice: 1_100, buyVolume: 4_000_000, sellVolume: 3_500_000, buyOrders: 600, sellOrders: 550, volatilityPercent: 15, volumeWindowHours: 168, participationPercent: 5, sellFeePercent: 1.25 },
  },
];

const pageCopy: Record<CalculatorPageFocus, { eyebrow: string; title: string; description: string; cta: string }> = {
  hub: { eyebrow: "TRANSPARENT SKYBLOCK MATH", title: "Calculator lab", description: "Six working, deterministic planners with every rate, cost, and assumption kept visible.", cta: "Start calculating" },
  dungeon: { eyebrow: "CATACOMBS XP · ATTEMPTS · COST", title: "Dungeon run planner", description: "Model completions, failed attempts, time, and a cautious reward-cost scenario for your next Catacombs target.", cta: "Plan dungeon runs" },
  slayer: { eyebrow: "SLAYER XP · BOSSES · EXPECTED COST", title: "Slayer roadmap", description: "Turn a selected boss tier and measured kill rate into transparent XP, time, quest-cost, and expected-drop scenarios.", cta: "Plan Slayer target" },
  minion: { eyebrow: "OUTPUT · FUEL · UPTIME · NET", title: "Minion production planner", description: "Model an identical minion setup with speed, output, storage uptime, sale-price, and operating-cost assumptions exposed.", cta: "Model minion output" },
};

const initialValues = Object.fromEntries(
  calculators.map((calculator) => [calculator.id, calculator.defaults]),
) as Record<CalculatorId, Record<string, number>>;

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });

function format(value: number, unit?: "coins" | "hours" | "percent" | "count" | "xp"): string {
  if (!Number.isFinite(value)) return "No finite estimate";
  if (unit === "coins") return compact.format(value) + " coins";
  if (unit === "hours") return number.format(value) + " hours";
  if (unit === "percent") return number.format(value * 100) + "%";
  if (unit === "xp") return compact.format(value) + " XP";
  return number.format(value);
}

function calculate(id: CalculatorId, values: Record<string, number>): CalculatorResult {
  if (id === "farming") {
    const result = estimateFarmingLevelTarget({
      currentLevel: values.currentLevel,
      targetLevel: values.targetLevel,
      baseXpPerHour: values.baseXpPerHour,
      xpBoostPercent: values.xpBoostPercent,
      hoursPerDay: values.hoursPerDay,
    });
    return {
      title: result.complete ? "Target already reached" : format(result.hoursRemaining, "hours"),
      summary: result.complete ? "Your current XP meets or exceeds this target." : `${format(result.remainingXp, "xp")} remain at ${compact.format(result.effectiveXpPerHour)} XP/hour.`,
      metrics: [
        { label: "Remaining XP", value: format(result.remainingXp, "xp") },
        { label: "Effective rate", value: compact.format(result.effectiveXpPerHour) + " XP/h" },
        { label: "Play days", value: result.daysRemaining === null ? "Not modeled" : number.format(result.daysRemaining) },
        { label: "Status", value: result.complete ? "Complete" : "In progress", tone: result.complete ? "positive" : undefined },
      ],
      assumptions: result.assumptions,
    };
  }

  if (id === "pet") {
    const result = estimatePetXp({
      currentPetXp: values.currentPetXp,
      targetPetXp: values.targetPetXp,
      skillXpPerHour: values.skillXpPerHour,
      skillToPetXpRatio: values.skillToPetXpRatio,
      petXpBoostPercent: values.petXpBoostPercent,
    });
    return {
      title: result.complete ? "Target already reached" : format(result.hoursRemaining, "hours"),
      summary: `${format(result.remainingPetXp, "xp")} remain at ${compact.format(result.effectivePetXpPerHour)} pet XP/hour.`,
      metrics: [
        { label: "Remaining pet XP", value: format(result.remainingPetXp, "xp") },
        { label: "Effective rate", value: compact.format(result.effectivePetXpPerHour) + " XP/h" },
        { label: "Hours", value: format(result.hoursRemaining, "hours") },
        { label: "Status", value: result.complete ? "Complete" : "In progress", tone: result.complete ? "positive" : undefined },
      ],
      assumptions: result.assumptions,
    };
  }

  if (id === "minion") {
    const result = estimateMinionProfit({
      minionCount: Math.round(values.minionCount),
      baseActionTimeSeconds: values.baseActionTimeSeconds,
      actionsPerOutput: values.actionsPerOutput,
      itemsPerOutput: values.itemsPerOutput,
      sellPricePerItem: values.sellPricePerItem,
      durationHours: values.durationHours,
      fuelSpeedBonusPercent: values.fuelSpeedBonusPercent,
      upgradeSpeedBonusPercent: values.upgradeSpeedBonusPercent,
      outputMultiplier: values.outputMultiplier,
      uptime: values.uptimePercent / 100,
      operatingCostPerDay: values.operatingCostPerDay,
    });
    return {
      title: format(result.netProfit, "coins") + " net",
      summary: `${compact.format(result.expectedItems)} items across ${number.format(values.durationHours)} modeled hours.`,
      metrics: [
        { label: "Net per day", value: format(result.netProfitPerDay, "coins"), tone: result.netProfitPerDay >= 0 ? "positive" : "warning" },
        { label: "Net per hour", value: format(result.netProfitPerHour, "coins"), tone: result.netProfitPerHour >= 0 ? "positive" : "warning" },
        { label: "Gross revenue", value: format(result.grossRevenue, "coins") },
        { label: "Effective action", value: number.format(result.effectiveActionTimeSeconds) + " seconds" },
      ],
      assumptions: result.assumptions,
    };
  }

  if (id === "dungeon") {
    const result = estimateDungeonRuns({
      currentCatacombsXp: values.currentCatacombsXp,
      targetCatacombsXp: values.targetCatacombsXp,
      catacombsXpPerCompletion: values.catacombsXpPerCompletion,
      minutesPerAttempt: values.minutesPerAttempt,
      completionRate: values.completionRatePercent / 100,
      expectedRewardPerCompletion: values.expectedRewardPerCompletion,
      chestCostPerCompletion: values.chestCostPerCompletion,
      costPerAttempt: values.costPerAttempt,
    });
    return {
      title: `${number.format(result.expectedAttempts)} expected attempts`,
      summary: `${number.format(result.successfulCompletions)} successful completions over about ${format(result.estimatedHours, "hours")}.`,
      metrics: [
        { label: "Completions", value: format(result.successfulCompletions, "count") },
        { label: "Attempts", value: format(result.expectedAttempts, "count") },
        { label: "Estimated time", value: format(result.estimatedHours, "hours") },
        { label: "Expected net", value: format(result.expectedNetProfit, "coins"), tone: result.expectedNetProfit >= 0 ? "positive" : "warning" },
      ],
      assumptions: result.assumptions,
    };
  }

  if (id === "slayer") {
    const result = estimateSlayerProgress({
      currentSlayerXp: values.currentSlayerXp,
      targetSlayerXp: values.targetSlayerXp,
      xpPerBoss: values.xpPerBoss,
      secondsPerAttempt: values.secondsPerAttempt,
      successRate: values.successRatePercent / 100,
      costPerAttempt: values.costPerAttempt,
      expectedDropValuePerKill: values.expectedDropValuePerKill,
    });
    return {
      title: `${number.format(result.expectedAttempts)} expected attempts`,
      summary: `${number.format(result.successfulBosses)} successful bosses over about ${format(result.estimatedHours, "hours")}.`,
      metrics: [
        { label: "Successful bosses", value: format(result.successfulBosses, "count") },
        { label: "Total quest cost", value: format(result.totalAttemptCost, "coins") },
        { label: "Expected drops", value: format(result.grossExpectedDrops, "coins") },
        { label: "Expected net cost", value: format(result.expectedNetCost, "coins"), tone: result.expectedNetCost <= 0 ? "positive" : "warning" },
      ],
      assumptions: result.assumptions,
    };
  }

  const result = scoreBazaarFlip({
    productId: "MANUAL_SCENARIO",
    displayName: "Manual scenario",
    buyOrderPrice: values.buyOrderPrice,
    sellOfferPrice: values.sellOfferPrice,
    buyVolume: values.buyVolume,
    sellVolume: values.sellVolume,
    buyOrders: values.buyOrders,
    sellOrders: values.sellOrders,
    volatility: values.volatilityPercent / 100,
    volumeWindowHours: values.volumeWindowHours,
    participationRate: values.participationPercent / 100,
    fees: { sellRate: values.sellFeePercent / 100 },
  });
  return {
    title: `${number.format(result.opportunityScore)}/100 · ${result.quality}`,
    summary: `${format(result.netMarginPerUnit, "coins")} net per unit and ${format(result.estimatedHourlyProfit, "coins")} modeled hourly profit.`,
    metrics: [
      { label: "Net margin/unit", value: format(result.netMarginPerUnit, "coins"), tone: result.netMarginPerUnit > 0 ? "positive" : "warning" },
      { label: "Return", value: format(result.returnOnInvestment, "percent") },
      { label: "Liquidity score", value: number.format(result.liquidityScore) + "/100" },
      { label: "Risk score", value: number.format(result.riskScore) + "/100", tone: result.riskScore >= 62 ? "warning" : undefined },
    ],
    assumptions: [
      `${number.format(result.estimatedHourlyUnits)} units/hour at the entered participation rate.`,
      `${format(result.feesPerUnit, "coins")} in modeled fees per unit.`,
      result.disclaimer,
    ],
  };
}

export function CalculatorHubExperience({ focus = "hub" }: { focus?: CalculatorPageFocus }) {
  const initialCalculator: CalculatorId = focus === "dungeon" ? "dungeon" : focus === "slayer" ? "slayer" : focus === "minion" ? "minion" : "farming";
  const copy = pageCopy[focus];
  const [active, setActive] = useState<CalculatorId>(initialCalculator);
  const [allValues, setAllValues] = useState(initialValues);
  const definition = calculators.find((calculator) => calculator.id === active) ?? calculators[0];
  const values = allValues[active];

  const calculated = useMemo(() => {
    try {
      return { result: calculate(active, values), error: null };
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : "Check the calculator inputs.",
      };
    }
  }, [active, values]);

  function updateValue(key: string, raw: string) {
    const nextValue = raw === "" ? 0 : Number(raw);
    setAllValues((current) => ({
      ...current,
      [active]: { ...current[active], [key]: Number.isFinite(nextValue) ? nextValue : 0 },
    }));
  }

  function resetActive() {
    setAllValues((current) => ({ ...current, [active]: { ...definition.defaults } }));
  }

  return (
    <div className="page-shell module-page calculator-hub">
      <header className="page-header module-header">
        <div className="page-title">
          <small>{copy.eyebrow}</small>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <div className="toolbar">
          <Link className="button-secondary" href="/dashboard">Analyze a player</Link>
          <a className="button-primary" href="#calculator-workspace">{copy.cta}</a>
        </div>
      </header>

      <div className="notice module-note">
        <strong>MANUAL</strong>
        <span>Inputs are not live market quotes or gameplay guarantees. Measure your own rates and verify changing in-game mechanics.</span>
      </div>

      <nav className="calculator-tabs panel" aria-label="SkyBlock calculators">
        {calculators.map((calculator) => (
          <button
            aria-pressed={active === calculator.id}
            className={active === calculator.id ? "active" : ""}
            key={calculator.id}
            onClick={() => setActive(calculator.id)}
            type="button"
          >
            <span aria-hidden="true">{calculator.icon}</span>
            <strong>{calculator.short}</strong>
          </button>
        ))}
      </nav>

      <section className="calculator-workspace" id="calculator-workspace">
        <div className="panel calculator-input-panel">
          <div className="panel-header">
            <div><h2>{definition.title}</h2><small>{definition.description}</small></div>
            <button className="calculator-reset" onClick={resetActive} type="button">Reset</button>
          </div>
          <form className="calculator-fields" onSubmit={(event) => event.preventDefault()}>
            {definition.fields.map((field) => (
              <label key={field.key}>
                <span>{field.label}{field.suffix ? <small>{field.suffix}</small> : null}</span>
                <input
                  aria-describedby={`${active}-${field.key}-help`}
                  inputMode="decimal"
                  max={field.max}
                  min={field.min ?? 0}
                  onChange={(event) => updateValue(field.key, event.target.value)}
                  step={field.step ?? "any"}
                  type="number"
                  value={values[field.key]}
                />
                <small id={`${active}-${field.key}-help`}>{field.help}</small>
              </label>
            ))}
          </form>
        </div>

        <aside className="panel calculator-output-panel" aria-live="polite">
          <div className="panel-header"><div><h2>Modeled result</h2><small>Calculated locally · no AI</small></div><span className="lab-symbol" aria-hidden="true">=</span></div>
          {calculated.result ? (
            <>
              <div className="calculator-headline">
                <small>{definition.short.toUpperCase()} ESTIMATE</small>
                <strong>{calculated.result.title}</strong>
                <p>{calculated.result.summary}</p>
              </div>
              <dl className="calculator-result-grid">
                {calculated.result.metrics.map((metric) => (
                  <div className={metric.tone ? `tone-${metric.tone}` : ""} key={metric.label}>
                    <dt>{metric.label}</dt>
                    <dd>{metric.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="calculator-assumptions">
                <strong>Assumptions</strong>
                <ul>{calculated.result.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul>
              </div>
            </>
          ) : (
            <div className="calculator-invalid" role="alert">
              <strong>Input needs attention</strong>
              <p>{calculated.error}</p>
            </div>
          )}
        </aside>
      </section>

      {focus === "dungeon" ? <DungeonReadinessEvaluator /> : null}
      {focus === "minion" ? <MinionSlotOptimizer /> : null}

      <section className="three-column guidance-grid">
        <article className="guidance-card panel"><span>01</span><h2>Inputs stay visible</h2><p>Nothing is hidden behind a score. Change one assumption and the complete result updates immediately.</p></article>
        <article className="guidance-card panel"><span>02</span><h2>Ranges beat promises</h2><p>Use cautious and optimistic input passes to see how real-world rates, fills, and success change the outcome.</p></article>
        <article className="guidance-card panel"><span>03</span><h2>Live data stays separate</h2><p>These manual tools continue to work when API integrations are disabled, stale, private, or unavailable.</p></article>
      </section>
    </div>
  );
}
