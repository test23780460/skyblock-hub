"use client";

import { useMemo, useState } from "react";
import Link from "@/components/AppLink";
import { optimizeAccessories, type AccessoryOption } from "@/lib/engines/accessories";

type EditableAccessory = AccessoryOption & { rarity: string };

const referenceAccessories: EditableAccessory[] = [
  { id: "speed-talisman", name: "Speed Talisman", familyId: "speed", tier: 1, rarity: "Common", magicalPower: 3, cost: 2_000 },
  { id: "speed-ring", name: "Speed Ring", familyId: "speed", tier: 2, rarity: "Uncommon", magicalPower: 5, cost: 50_000 },
  { id: "speed-artifact", name: "Speed Artifact", familyId: "speed", tier: 3, rarity: "Rare", magicalPower: 8, cost: 900_000 },
  { id: "zombie-talisman", name: "Zombie Talisman", familyId: "zombie", tier: 1, rarity: "Common", magicalPower: 3, cost: 500 },
  { id: "zombie-ring", name: "Zombie Ring", familyId: "zombie", tier: 2, rarity: "Uncommon", magicalPower: 5, cost: 60_000 },
  { id: "zombie-artifact", name: "Zombie Artifact", familyId: "zombie", tier: 3, rarity: "Rare", magicalPower: 8, cost: 3_000_000 },
  { id: "feather-talisman", name: "Feather Talisman", familyId: "feather", tier: 1, rarity: "Common", magicalPower: 3, cost: 20_000 },
  { id: "feather-ring", name: "Feather Ring", familyId: "feather", tier: 2, rarity: "Uncommon", magicalPower: 5, cost: 250_000 },
  { id: "feather-artifact", name: "Feather Artifact", familyId: "feather", tier: 3, rarity: "Rare", magicalPower: 8, cost: 2_000_000 },
];

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function AccessoryOptimizerExperience() {
  const [accessories, setAccessories] = useState(referenceAccessories);
  const [owned, setOwned] = useState<string[]>(["speed-talisman", "zombie-talisman"]);
  const [currentMagicalPower, setCurrentMagicalPower] = useState(182);
  const [budget, setBudget] = useState(5_000_000);
  const [targetGain, setTargetGain] = useState(12);

  const calculation = useMemo(() => {
    try {
      return {
        result: optimizeAccessories({
          accessories,
          ownedAccessoryIds: owned,
          currentMagicalPower,
          budget,
          targetAdditionalMagicalPower: targetGain,
        }),
        error: null,
      };
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : "Check the optimizer inputs.",
      };
    }
  }, [accessories, budget, currentMagicalPower, owned, targetGain]);

  function updateAccessory(id: string, key: "cost" | "magicalPower", raw: string) {
    const value = Number(raw);
    setAccessories((current) => current.map((accessory) => accessory.id === id
      ? { ...accessory, [key]: Number.isFinite(value) ? Math.max(0, value) : 0 }
      : accessory));
  }

  function toggleOwned(id: string) {
    setOwned((current) => current.includes(id)
      ? current.filter((candidate) => candidate !== id)
      : [...current, id]);
  }

  function reset() {
    setAccessories(referenceAccessories);
    setOwned(["speed-talisman", "zombie-talisman"]);
    setCurrentMagicalPower(182);
    setBudget(5_000_000);
    setTargetGain(12);
  }

  const result = calculation.result;

  return (
    <div className="page-shell module-page accent-violet accessory-optimizer">
      <header className="page-header module-header">
        <div className="page-title"><small>FAMILY-AWARE MAGICAL POWER</small><h1>Accessory optimizer</h1><p>Build an exact budget plan without double-counting lower and higher tiers from the same accessory family.</p></div>
        <div className="toolbar"><Link className="button-secondary" href="/dashboard">Analyze a player</Link><a className="button-primary" href="#accessory-plan">Build MP plan</a></div>
      </header>

      <div className="notice module-note"><strong>REFERENCE</strong><span>Accessory families and base Magical Power use the current official rarity rules. Example prices are editable planning assumptions, not live quotes.</span></div>

      <section className="accessory-controls panel" aria-label="Optimizer targets">
        <label><span>Current total MP</span><input min="0" onChange={(event) => setCurrentMagicalPower(Math.max(0, Number(event.target.value) || 0))} step="1" type="number" value={currentMagicalPower} /><small>Include all accessories, even those outside this small reference set.</small></label>
        <label><span>Coin budget</span><input min="0" onChange={(event) => setBudget(Math.max(0, Number(event.target.value) || 0))} step="1" type="number" value={budget} /><small>Maximum spend across selected upgrades.</small></label>
        <label><span>Target additional MP</span><input min="0" onChange={(event) => setTargetGain(Math.max(0, Number(event.target.value) || 0))} step="1" type="number" value={targetGain} /><small>The optimizer minimizes cost when this target is reachable.</small></label>
        <button onClick={reset} type="button">Reset example</button>
      </section>

      <section className="two-column accessory-workspace" id="accessory-plan">
        <div className="panel accessory-catalog">
          <div className="panel-header"><div><h2>Editable reference catalog</h2><small>Mark owned tiers · replace sample costs with current prices</small></div><a href="https://wiki.hypixel.net/Magical_Power" rel="noreferrer" target="_blank">Official MP rules ↗</a></div>
          <div className="accessory-table" role="table" aria-label="Accessory candidates">
            <div className="accessory-table-head" role="row"><span>Owned</span><span>Accessory</span><span>MP</span><span>Assumed cost</span></div>
            {accessories.map((accessory) => (
              <div className="accessory-row" role="row" key={accessory.id}>
                <label className="owned-toggle"><input checked={owned.includes(accessory.id)} onChange={() => toggleOwned(accessory.id)} type="checkbox" /><span className="sr-only">Own {accessory.name}</span></label>
                <div><strong>{accessory.name}</strong><small>{accessory.rarity} · {accessory.familyId} family · tier {accessory.tier}</small></div>
                <label><span className="sr-only">Magical Power for {accessory.name}</span><input min="0" onChange={(event) => updateAccessory(accessory.id, "magicalPower", event.target.value)} step="1" type="number" value={accessory.magicalPower} /></label>
                <label><span className="sr-only">Assumed cost for {accessory.name}</span><input min="0" onChange={(event) => updateAccessory(accessory.id, "cost", event.target.value)} step="1" type="number" value={accessory.cost} /></label>
              </div>
            ))}
          </div>
        </div>

        <aside className="panel accessory-plan-panel" aria-live="polite">
          <div className="panel-header"><div><h2>Exact budget plan</h2><small>Pareto optimizer · one choice per family</small></div><span className="lab-symbol" aria-hidden="true">MP</span></div>
          {result ? (
            <>
              <div className="accessory-plan-summary">
                <small>{result.targetReached ? "TARGET REACHED" : "BEST WITHIN BUDGET"}</small>
                <strong>+{number.format(result.magicalPowerGain)} MP</strong>
                <p>{number.format(result.currentMagicalPower)} → {number.format(result.resultingMagicalPower)} MP for {compact.format(result.spent)} coins.</p>
                <div className="accessory-budget-track" role="progressbar" aria-label="Budget used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={budget ? Math.min(100, Math.round(result.spent / budget * 100)) : 0}><i style={{ width: (budget ? Math.min(100, result.spent / budget * 100) : 0) + "%" }} /></div>
                <span>{compact.format(result.remainingBudget ?? 0)} budget remaining</span>
              </div>
              <div className="accessory-selection-list">
                {result.selected.length ? result.selected.map((selection, index) => (
                  <article key={selection.id}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div><strong>{selection.name}</strong><small>{selection.replacesAccessoryId ? `Replaces ${selection.replacesAccessoryId.replaceAll("-", " ")}` : "New accessory family"}</small></div>
                    <div><strong>+{selection.magicalPowerGain} MP</strong><small>{compact.format(selection.cost)} · {compact.format(selection.coinsPerMagicalPower)}/MP</small></div>
                  </article>
                )) : <div className="empty-inline">No positive MP upgrade fits these inputs.</div>}
              </div>
            </>
          ) : (
            <div className="calculator-invalid" role="alert"><strong>Input needs attention</strong><p>{calculation.error}</p></div>
          )}
        </aside>
      </section>

      <section className="three-column guidance-grid">
        <article className="guidance-card panel"><span>01</span><h2>Family resolution</h2><p>Only the strongest owned tier establishes a family baseline, so an Artifact does not stack with its Ring and Talisman.</p></article>
        <article className="guidance-card panel"><span>02</span><h2>Exact budget search</h2><p>The engine compares the efficient frontier across families instead of greedily choosing one misleading coins-per-MP row at a time.</p></article>
        <article className="guidance-card panel"><span>03</span><h2>Prices stay honest</h2><p>Every cost can be replaced with a current Bazaar, auction, craft, or NPC value. Sample assumptions are never labeled live.</p></article>
      </section>
    </div>
  );
}
