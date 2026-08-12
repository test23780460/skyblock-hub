"use client";

import { useMemo, useState } from "react";
import {
  optimizeNextMinionSlot,
  type MinionTierCraft,
} from "@/lib/engines/calculators/minion-slots";

const initialCrafts: MinionTierCraft[] = [
  { id: "cobble-5", minionId: "cobble", minionName: "Cobblestone", tier: 5, cost: 80_000, crafted: true },
  { id: "cobble-6", minionId: "cobble", minionName: "Cobblestone", tier: 6, cost: 210_000, crafted: false },
  { id: "cobble-7", minionId: "cobble", minionName: "Cobblestone", tier: 7, cost: 520_000, crafted: false },
  { id: "wheat-5", minionId: "wheat", minionName: "Wheat", tier: 5, cost: 70_000, crafted: true },
  { id: "wheat-6", minionId: "wheat", minionName: "Wheat", tier: 6, cost: 180_000, crafted: false },
  { id: "wheat-7", minionId: "wheat", minionName: "Wheat", tier: 7, cost: 460_000, crafted: false },
  { id: "oak-4", minionId: "oak", minionName: "Oak", tier: 4, cost: 55_000, crafted: true },
  { id: "oak-5", minionId: "oak", minionName: "Oak", tier: 5, cost: 140_000, crafted: false },
  { id: "oak-6", minionId: "oak", minionName: "Oak", tier: 6, cost: 330_000, crafted: false },
  { id: "clay-3", minionId: "clay", minionName: "Clay", tier: 3, cost: 45_000, crafted: true },
  { id: "clay-4", minionId: "clay", minionName: "Clay", tier: 4, cost: 95_000, crafted: false },
  { id: "clay-5", minionId: "clay", minionName: "Clay", tier: 5, cost: 240_000, crafted: false },
];

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

function romanTier(value: number): string {
  const numerals: [number, string][] = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let remaining = value;
  let result = "";
  for (const [amount, symbol] of numerals) {
    while (remaining >= amount) {
      result += symbol;
      remaining -= amount;
    }
  }
  return result || String(value);
}

export function MinionSlotOptimizer() {
  const [currentUniqueCrafts, setCurrentUniqueCrafts] = useState(95);
  const [nextSlotAt, setNextSlotAt] = useState(100);
  const [budget, setBudget] = useState(2_000_000);
  const [crafts, setCrafts] = useState<MinionTierCraft[]>(initialCrafts);

  const calculated = useMemo(() => {
    try {
      return {
        result: optimizeNextMinionSlot({ currentUniqueCrafts, nextSlotAt, budget, candidates: crafts }),
        error: null,
      };
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : "Check the tier path inputs." };
    }
  }, [budget, crafts, currentUniqueCrafts, nextSlotAt]);

  function updateCraft(id: string, update: Partial<MinionTierCraft>) {
    setCrafts((current) => current.map((craft) => craft.id === id ? { ...craft, ...update } : craft));
  }

  return (
    <section className="minion-slot-section" aria-labelledby="minion-slot-title">
      <div className="minion-slot-heading">
        <div><small>EXACT TIER-PATH OPTIMIZER</small><h2 id="minion-slot-title">Cheapest route to the next minion slot</h2><p>Enter a complete ordered tier path and the cost of each uncrafted tier. SkyPilot solves the cross-family combination without skipping prerequisites.</p></div>
      </div>

      <div className="notice module-note">
        <strong>REFERENCE ROWS</strong>
        <span>The starter minion names and costs below are illustrative, not live Bazaar prices or detected ownership. Replace them with your own current tiers and costs.</span>
      </div>

      <div className="two-column minion-slot-workspace">
        <div className="panel minion-craft-panel">
          <div className="panel-header"><div><h2>Tier craft paths</h2><small>Crafted tiers must remain a prefix within each family</small></div><button className="calculator-reset" onClick={() => setCrafts(initialCrafts)} type="button">Reset rows</button></div>
          <div className="minion-craft-table">
            <div className="minion-craft-head"><span>Minion tier</span><span>Entered cost</span><span>Status</span></div>
            {crafts.map((craft) => (
              <div className="minion-craft-row" key={craft.id}>
                <div><strong>{craft.minionName} {romanTier(craft.tier)}</strong><small>{craft.minionId} · tier {craft.tier}</small></div>
                <label><span className="sr-only">Cost for {craft.minionName} tier {craft.tier}</span><input disabled={craft.crafted} min="0" onChange={(event) => updateCraft(craft.id, { cost: Math.max(0, Number(event.target.value) || 0) })} step="any" type="number" value={craft.cost} /></label>
                <button aria-pressed={craft.crafted} className={craft.crafted ? "crafted" : ""} onClick={() => updateCraft(craft.id, { crafted: !craft.crafted })} type="button">{craft.crafted ? "Crafted" : "Missing"}</button>
              </div>
            ))}
          </div>
        </div>

        <aside className="minion-slot-side">
          <div className="panel minion-slot-controls">
            <div className="panel-header"><div><h2>Slot target</h2><small>Use the requirement shown in game</small></div><span className="lab-symbol" aria-hidden="true">#</span></div>
            <div>
              <label><span>Current unique crafts</span><input min="0" onChange={(event) => setCurrentUniqueCrafts(Math.max(0, Math.round(Number(event.target.value) || 0)))} step="1" type="number" value={currentUniqueCrafts} /></label>
              <label><span>Next slot unlocks at</span><input min="0" onChange={(event) => setNextSlotAt(Math.max(0, Math.round(Number(event.target.value) || 0)))} step="1" type="number" value={nextSlotAt} /></label>
              <label><span>Crafting budget</span><input min="0" onChange={(event) => setBudget(Math.max(0, Number(event.target.value) || 0))} step="any" type="number" value={budget} /></label>
            </div>
          </div>

          <div className="panel minion-slot-result" aria-live="polite">
            <div className="panel-header"><div><h2>Exact plan</h2><small>Lowest entered total cost</small></div><span className="lab-symbol" aria-hidden="true">=</span></div>
            {calculated.result ? (
              calculated.result.plan ? <>
                <div className="minion-plan-head"><small>{calculated.result.craftsNeeded} CRAFTS NEEDED</small><strong>{compact.format(calculated.result.plan.totalCost)} coins</strong><span>{calculated.result.plan.affordable ? "Within the entered budget" : `${compact.format(calculated.result.plan.budgetShortfall)} coin shortfall`}</span></div>
                {calculated.result.plan.selectedCrafts.length ? <ol className="minion-plan-list">{calculated.result.plan.selectedCrafts.map((craft) => <li key={craft.id}><span>{craft.minionName} {romanTier(craft.tier)}</span><strong>{compact.format(craft.cost)}</strong></li>)}</ol> : <div className="empty-inline">The entered craft count already reaches this slot target.</div>}
              </> : <div className="calculator-invalid" role="alert"><strong>Not enough supplied tiers</strong><p>Add at least {calculated.result.craftsNeeded} reachable uncrafted tiers across the complete family paths.</p></div>
            ) : <div className="calculator-invalid" role="alert"><strong>Tier path needs attention</strong><p>{calculated.error}</p></div>}
          </div>
        </aside>
      </div>

      {calculated.result?.rankedPaths.length ? <div className="panel minion-path-ranking"><div className="panel-header"><div><h2>Cheapest reachable tier paths</h2><small>Cumulative prerequisite costs are included</small></div></div><div>{calculated.result.rankedPaths.slice(0, 8).map((path, index) => <article key={path.target.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{path.target.minionName} {romanTier(path.target.tier)}</strong><small>{path.craftsGained} craft{path.craftsGained === 1 ? "" : "s"} in this path</small></div><div><strong>{compact.format(path.totalCost)}</strong><small>{compact.format(path.averageCostPerCraft)} / craft</small></div></article>)}</div></div> : null}
    </section>
  );
}
