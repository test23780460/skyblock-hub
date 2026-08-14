"use client";

import { useMemo, useState } from "react";
import Link from "@/components/AppLink";
import { estimateGardenYield, type GardenUpgradeCandidate } from "@/lib/engines/calculators/index";

const crops = ["Wheat", "Carrot", "Potato", "Pumpkin", "Melon", "Mushroom", "Cocoa Beans", "Cactus", "Sugar Cane", "Nether Wart"] as const;
const sourceDefinitions = [
  ["skill", "Farming skill"], ["armor", "Armor and equipment"], ["tool", "Tool and enchantments"],
  ["pet", "Pet and pet item"], ["garden", "Garden and plots"], ["other", "Other applicable sources"],
] as const;

const initialSources: Record<(typeof sourceDefinitions)[number][0], number> = {
  skill: 160, armor: 150, tool: 120, pet: 110, garden: 70, other: 0,
};

const initialUpgrades: GardenUpgradeCandidate[] = [
  { id: "crop-upgrade", name: "Next crop-specific upgrade", fortuneGain: 5, cost: 1_500_000 },
  { id: "permanent-source", name: "Next permanent Garden source", fortuneGain: 4, cost: 2_000_000 },
  { id: "tool-improvement", name: "Tool or enchantment improvement", fortuneGain: 20, cost: 5_000_000 },
  { id: "armor-improvement", name: "Armor or equipment improvement", fortuneGain: 30, cost: 12_000_000 },
  { id: "pet-improvement", name: "Pet setup improvement", fortuneGain: 40, cost: 25_000_000 },
];

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export function GardenOptimizerExperience() {
  const [crop, setCrop] = useState<(typeof crops)[number]>("Melon");
  const [baseFortune, setBaseFortune] = useState(0);
  const [cropFortune, setCropFortune] = useState(45);
  const [sources, setSources] = useState(initialSources);
  const [blocksPerHour, setBlocksPerHour] = useState(18_000);
  const [baseDropsPerBlock, setBaseDropsPerBlock] = useState(1);
  const [coinValuePerItem, setCoinValuePerItem] = useState(4);
  const [budget, setBudget] = useState(15_000_000);
  const [upgrades, setUpgrades] = useState(initialUpgrades);

  const calculation = useMemo(() => {
    try {
      return { result: estimateGardenYield({
        baseFortune,
        cropSpecificFortune: cropFortune,
        sources: sourceDefinitions.map(([id, label]) => ({ id, label, fortune: sources[id] })),
        blocksPerHour,
        baseDropsPerBlock,
        coinValuePerItem,
        budget,
        upgrades,
      }), error: null };
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : "Check the Garden inputs." };
    }
  }, [baseDropsPerBlock, baseFortune, blocksPerHour, budget, coinValuePerItem, cropFortune, sources, upgrades]);

  function numeric(raw: string): number {
    const value = Number(raw);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  function updateUpgrade(id: string, key: "fortuneGain" | "cost", raw: string) {
    const value = numeric(raw);
    setUpgrades((current) => current.map((upgrade) => upgrade.id === id ? { ...upgrade, [key]: value } : upgrade));
  }

  const result = calculation.result;

  return (
    <div className="page-shell module-page accent-mint garden-optimizer">
      <header className="page-header module-header">
        <div className="page-title"><small>FORTUNE · CROPS · UPGRADE VALUE</small><h1>Garden optimizer</h1><p>Attribute Farming Fortune, model expected crop output, and rank upgrades by marginal value with every assumption editable.</p></div>
        <div className="toolbar"><Link className="button-secondary" href="/dashboard">Analyze a player</Link><a className="button-primary" href="#garden-workspace">Open crop lab</a></div>
      </header>

      <div className="notice module-note"><strong>FORMULA</strong><span>Hypixel documents one additional expected crop-drop multiplier per 100 applicable Fortune. Prices and block rates below are manual assumptions, not live data.</span></div>

      <div className="garden-crop-tabs panel" role="group" aria-label="Garden crop">
        {crops.map((name) => <button aria-pressed={crop === name} className={crop === name ? "active" : ""} key={name} onClick={() => setCrop(name)} type="button">{name}</button>)}
      </div>

      <section className="two-column garden-workspace" id="garden-workspace">
        <div className="garden-input-stack">
          <div className="panel garden-fortune-panel">
            <div className="panel-header"><div><h2>{crop} Fortune breakdown</h2><small>Enter only bonuses that apply to this setup</small></div><a href="https://wiki.hypixel.net/Farming_Fortune" rel="noreferrer" target="_blank">Official mechanics ↗</a></div>
            <div className="garden-source-grid">
              <label><span>Uncategorized base Fortune</span><input min="0" onChange={(event) => setBaseFortune(numeric(event.target.value))} step="0.1" type="number" value={baseFortune} /><small>Use zero if every source is listed below.</small></label>
              <label><span>{crop}-specific Fortune</span><input min="0" onChange={(event) => setCropFortune(numeric(event.target.value))} step="0.1" type="number" value={cropFortune} /><small>Added only while harvesting the selected crop.</small></label>
              {sourceDefinitions.map(([id, label]) => <label key={id}><span>{label}</span><input min="0" onChange={(event) => setSources((current) => ({ ...current, [id]: numeric(event.target.value) }))} step="0.1" type="number" value={sources[id]} /><small>Applicable Farming Fortune</small></label>)}
            </div>
          </div>

          <div className="panel garden-upgrade-panel">
            <div className="panel-header"><div><h2>Upgrade assumptions</h2><small>Edit current costs and marginal Fortune</small></div><span>{compact.format(budget)} budget</span></div>
            <label className="garden-budget"><span>Available upgrade budget</span><input min="0" onChange={(event) => setBudget(numeric(event.target.value))} step="1" type="number" value={budget} /></label>
            <div className="garden-upgrade-table">
              <div className="garden-upgrade-head"><span>Candidate</span><span>Fortune</span><span>Cost</span></div>
              {upgrades.map((upgrade) => <div className="garden-upgrade-row" key={upgrade.id}><strong>{upgrade.name}</strong><label><span className="sr-only">Fortune gain for {upgrade.name}</span><input min="0" onChange={(event) => updateUpgrade(upgrade.id, "fortuneGain", event.target.value)} step="0.1" type="number" value={upgrade.fortuneGain} /></label><label><span className="sr-only">Cost for {upgrade.name}</span><input min="0" onChange={(event) => updateUpgrade(upgrade.id, "cost", event.target.value)} step="1" type="number" value={upgrade.cost} /></label></div>)}
            </div>
          </div>
        </div>

        <aside className="garden-output-stack">
          <div className="panel garden-yield-panel" aria-live="polite">
            <div className="panel-header"><div><h2>Expected {crop} output</h2><small>Deterministic · no AI</small></div><span className="lab-symbol" aria-hidden="true">☘</span></div>
            {result ? <>
              <div className="garden-yield-hero"><small>TOTAL APPLICABLE FORTUNE</small><strong>{number.format(result.totalFortune)}</strong><p>{number.format(result.expectedDropMultiplier)}× expected crop drops</p></div>
              <div className="garden-rate-inputs">
                <label><span>Blocks broken/hour</span><input min="0" onChange={(event) => setBlocksPerHour(numeric(event.target.value))} step="1" type="number" value={blocksPerHour} /></label>
                <label><span>Base items/block</span><input min="0" onChange={(event) => setBaseDropsPerBlock(numeric(event.target.value))} step="0.01" type="number" value={baseDropsPerBlock} /></label>
                <label><span>Coin value/item</span><input min="0" onChange={(event) => setCoinValuePerItem(numeric(event.target.value))} step="0.01" type="number" value={coinValuePerItem} /></label>
              </div>
              <dl className="garden-yield-metrics"><div><dt>Expected items/hour</dt><dd>{compact.format(result.expectedItemsPerHour)}</dd></div><div><dt>Gross coins/hour</dt><dd>{compact.format(result.expectedGrossCoinsPerHour)}</dd></div><div><dt>Guaranteed drops</dt><dd>{result.guaranteedDropMultiplier}×</dd></div><div><dt>Next-drop chance</dt><dd>{number.format(result.extraDropChancePercent)}%</dd></div></dl>
            </> : <div className="calculator-invalid" role="alert"><strong>Input needs attention</strong><p>{calculation.error}</p></div>}
          </div>

          {result ? <div className="panel garden-ranking-panel"><div className="panel-header"><div><h2>Coins per Fortune</h2><small>Cheapest marginal gains first</small></div></div><div className="garden-ranking-list">{result.rankedUpgrades.map((upgrade, index) => <article className={upgrade.affordable ? "affordable" : ""} key={upgrade.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{upgrade.name}</strong><small>+{number.format(upgrade.fortuneGain)} Fortune · +{compact.format(upgrade.incrementalItemsPerHour)} items/hour</small></div><div><strong>{compact.format(upgrade.coinsPerFortune)}/☘</strong><small>{upgrade.affordable ? "Within budget" : "Over budget"}</small></div></article>)}</div><p className="lab-disclaimer">Gross value excludes downtime, storage, compacting, taxes, and changing market prices. Verify that each upgrade applies to the selected crop and setup.</p></div> : null}
        </aside>
      </section>

      <section className="three-column guidance-grid">
        <article className="guidance-card panel"><span>01</span><h2>Fortune attribution</h2><p>Skill, equipment, tool, pet, Garden, crop-specific, and other sources stay separate so double-counting is visible.</p></article>
        <article className="guidance-card panel"><span>02</span><h2>Measured rates</h2><p>Use a real blocks-per-hour sample from your farm. Layout, speed, lag, pests, and downtime can materially change output.</p></article>
        <article className="guidance-card panel"><span>03</span><h2>Marginal upgrades</h2><p>Rank current prices against the Fortune each change actually adds to this crop, not its rarity or headline price.</p></article>
      </section>
    </div>
  );
}
