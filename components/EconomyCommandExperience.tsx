"use client";

import { useMemo, useState } from "react";
import Link from "@/components/AppLink";
import {
  calculateCraftFlip,
  compareNpcAndBazaar,
  type CraftIngredientInput,
} from "@/lib/engines/economy-methods";

const initialIngredients: CraftIngredientInput[] = [
  { id: "ingredient-1", name: "Ingredient A", quantity: 160, unitPrice: 1_200 },
  { id: "ingredient-2", name: "Ingredient B", quantity: 32, unitPrice: 4_800 },
  { id: "ingredient-3", name: "Ingredient C", quantity: 1, unitPrice: 75_000 },
];

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 2 });

function coins(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}${compact.format(Math.abs(value))} coins`;
}

export function EconomyCommandExperience() {
  const [ingredients, setIngredients] = useState(initialIngredients);
  const [outputQuantity, setOutputQuantity] = useState(1);
  const [salePrice, setSalePrice] = useState(500_000);
  const [craftFeePercent, setCraftFeePercent] = useState(1.25);
  const [fixedCosts, setFixedCosts] = useState(0);
  const [recipeUnlocked, setRecipeUnlocked] = useState<boolean | null>(null);
  const [npcInputs, setNpcInputs] = useState({
    quantity: 640,
    npcBuyPrice: 100,
    npcSellPrice: 80,
    bazaarInstantBuyPrice: 95,
    bazaarInstantSellPrice: 110,
    bazaarSellFeePercent: 1.25,
    npcBuyLimitRemaining: 640,
    npcSellLimitRemaining: 640,
  });

  const craft = useMemo(() => {
    try {
      return { result: calculateCraftFlip({
        recipeId: "manual-recipe",
        recipeName: "Manual recipe",
        ingredients,
        outputQuantity,
        salePricePerOutput: salePrice,
        sellFeeRate: craftFeePercent / 100,
        fixedCosts,
        recipeUnlocked,
      }), error: null };
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : "Check the craft inputs." };
    }
  }, [craftFeePercent, fixedCosts, ingredients, outputQuantity, recipeUnlocked, salePrice]);

  const npc = useMemo(() => {
    try {
      return { result: compareNpcAndBazaar({
        productId: "manual-product",
        productName: "Manual product",
        quantity: npcInputs.quantity,
        npcBuyPrice: npcInputs.npcBuyPrice,
        npcSellPrice: npcInputs.npcSellPrice,
        bazaarInstantBuyPrice: npcInputs.bazaarInstantBuyPrice,
        bazaarInstantSellPrice: npcInputs.bazaarInstantSellPrice,
        bazaarSellFeeRate: npcInputs.bazaarSellFeePercent / 100,
        npcBuyLimitRemaining: npcInputs.npcBuyLimitRemaining,
        npcSellLimitRemaining: npcInputs.npcSellLimitRemaining,
      }), error: null };
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : "Check the comparison inputs." };
    }
  }, [npcInputs]);

  function updateIngredient(id: string, key: "name" | "quantity" | "unitPrice", raw: string) {
    setIngredients((current) => current.map((ingredient) => ingredient.id === id
      ? { ...ingredient, [key]: key === "name" ? raw : Math.max(0, Number(raw) || 0) }
      : ingredient));
  }

  function updateNpc(key: keyof typeof npcInputs, raw: string) {
    setNpcInputs((current) => ({ ...current, [key]: Math.max(0, Number(raw) || 0) }));
  }

  return (
    <div className="page-shell module-page economy-command-page">
      <header className="page-header module-header">
        <div className="page-title"><small>PUBLIC MARKETS · MANUAL SCENARIOS</small><h1>Economy command center</h1><p>Move from market evidence to transparent craft and NPC comparisons without mistaking an ask, spread, or sample input for guaranteed profit.</p></div>
        <div className="toolbar"><Link className="button-secondary" href="/auctions">Auction intelligence</Link><Link className="button-primary" href="/bazaar">Open live Bazaar</Link></div>
      </header>

      <div className="notice module-note"><strong>MANUAL LABS</strong><span>Every value in the two calculators below is an editable example assumption. Live Bazaar history remains on the dedicated Bazaar page.</span></div>

      <section className="stat-grid economy-command-links" aria-label="Economy tools">
        <Link className="stat-card" href="/bazaar"><small>BAZAAR</small><strong>Snapshots + history</strong><span>Spread, volume, fee-aware flip score, and durable trends</span></Link>
        <Link className="stat-card" href="/auctions"><small>AUCTIONS</small><strong>Complete snapshot</strong><span>Active listings, pagination, search, and ending times</span></Link>
        <a className="stat-card" href="#craft-flip"><small>CRAFTING</small><strong>Recipe economics</strong><span>Ingredients, output, fees, unlock, and break-even</span></a>
        <a className="stat-card" href="#npc-comparison"><small>NPC / BAZAAR</small><strong>Two-way comparison</strong><span>Prices, entered limits, eligibility, and return</span></a>
      </section>

      <section className="two-column economy-lab-grid">
        <div className="panel economy-lab" id="craft-flip">
          <div className="panel-header"><div><h2>Craft flip evaluator</h2><small>Complete recipe cost before expected sale value</small></div><span className="lab-symbol" aria-hidden="true">C</span></div>
          <div className="craft-ingredient-table">
            <div className="craft-ingredient-head"><span>Ingredient</span><span>Quantity</span><span>Unit price</span><span>Total</span></div>
            {ingredients.map((ingredient) => <div className="craft-ingredient-row" key={ingredient.id}>
              <label><span className="sr-only">Ingredient name</span><input onChange={(event) => updateIngredient(ingredient.id, "name", event.target.value)} value={ingredient.name} /></label>
              <label><span className="sr-only">{ingredient.name} quantity</span><input min="0.01" onChange={(event) => updateIngredient(ingredient.id, "quantity", event.target.value)} step="any" type="number" value={ingredient.quantity} /></label>
              <label><span className="sr-only">{ingredient.name} unit price</span><input min="0" onChange={(event) => updateIngredient(ingredient.id, "unitPrice", event.target.value)} step="any" type="number" value={ingredient.unitPrice} /></label>
              <strong>{compact.format(ingredient.quantity * ingredient.unitPrice)}</strong>
            </div>)}
          </div>
          <div className="economy-field-grid">
            <label><span>Output quantity</span><input min="0.01" onChange={(event) => setOutputQuantity(Math.max(.01, Number(event.target.value) || .01))} step="any" type="number" value={outputQuantity} /></label>
            <label><span>Sale price / output</span><input min="0" onChange={(event) => setSalePrice(Math.max(0, Number(event.target.value) || 0))} step="any" type="number" value={salePrice} /></label>
            <label><span>Sell fee</span><input max="100" min="0" onChange={(event) => setCraftFeePercent(Math.min(100, Math.max(0, Number(event.target.value) || 0)))} step="0.01" type="number" value={craftFeePercent} /></label>
            <label><span>Other fixed costs</span><input min="0" onChange={(event) => setFixedCosts(Math.max(0, Number(event.target.value) || 0))} step="any" type="number" value={fixedCosts} /></label>
            <label><span>Recipe unlock</span><select value={recipeUnlocked === null ? "unknown" : recipeUnlocked ? "yes" : "no"} onChange={(event) => setRecipeUnlocked(event.target.value === "unknown" ? null : event.target.value === "yes")}><option value="unknown">Unverified</option><option value="yes">Unlocked</option><option value="no">Not unlocked</option></select></label>
          </div>
          {craft.result ? <div className={`economy-lab-result ${craft.result.profitable ? "positive" : "negative"}`} aria-live="polite"><small>{craft.result.executable ? "EXECUTABLE INPUTS" : "UNLOCK CHECK REQUIRED"}</small><strong>{coins(craft.result.netProfit)} modeled net</strong><p>{coins(craft.result.totalCost)} total cost · {coins(craft.result.saleFees)} fees · {craft.result.returnOnCost === null ? "No cost basis" : percent.format(craft.result.returnOnCost) + " return"}</p><dl><div><dt>Break-even sale</dt><dd>{craft.result.breakEvenSalePricePerOutput === null ? "Unavailable" : coins(craft.result.breakEvenSalePricePerOutput)}</dd></div><div><dt>Gross revenue</dt><dd>{coins(craft.result.grossRevenue)}</dd></div></dl>{craft.result.blockers.length ? <span>{craft.result.blockers.join(" · ")}</span> : null}</div> : <div className="calculator-invalid" role="alert"><strong>Craft input needs attention</strong><p>{craft.error}</p></div>}
        </div>

        <div className="panel economy-lab" id="npc-comparison">
          <div className="panel-header"><div><h2>NPC ↔ Bazaar comparison</h2><small>Both directions, explicit limits, instant prices</small></div><span className="lab-symbol" aria-hidden="true">N</span></div>
          <div className="economy-field-grid npc-fields">
            <label><span>Quantity</span><input min="0.01" onChange={(event) => updateNpc("quantity", event.target.value)} step="any" type="number" value={npcInputs.quantity} /></label>
            <label><span>Bazaar sell fee %</span><input max="100" min="0" onChange={(event) => updateNpc("bazaarSellFeePercent", event.target.value)} step="0.01" type="number" value={npcInputs.bazaarSellFeePercent} /></label>
            <label><span>NPC buy price</span><input min="0" onChange={(event) => updateNpc("npcBuyPrice", event.target.value)} step="any" type="number" value={npcInputs.npcBuyPrice} /></label>
            <label><span>NPC sell price</span><input min="0" onChange={(event) => updateNpc("npcSellPrice", event.target.value)} step="any" type="number" value={npcInputs.npcSellPrice} /></label>
            <label><span>Bazaar instant-buy</span><input min="0" onChange={(event) => updateNpc("bazaarInstantBuyPrice", event.target.value)} step="any" type="number" value={npcInputs.bazaarInstantBuyPrice} /></label>
            <label><span>Bazaar instant-sell</span><input min="0" onChange={(event) => updateNpc("bazaarInstantSellPrice", event.target.value)} step="any" type="number" value={npcInputs.bazaarInstantSellPrice} /></label>
            <label><span>NPC buy limit left</span><input min="0" onChange={(event) => updateNpc("npcBuyLimitRemaining", event.target.value)} step="any" type="number" value={npcInputs.npcBuyLimitRemaining} /></label>
            <label><span>NPC sell limit left</span><input min="0" onChange={(event) => updateNpc("npcSellLimitRemaining", event.target.value)} step="any" type="number" value={npcInputs.npcSellLimitRemaining} /></label>
          </div>
          {npc.result ? <div className="npc-route-list" aria-live="polite">{npc.result.routes.map((route) => <article className={route.eligible ? route.netProfit > 0 ? "positive" : "eligible" : "blocked"} key={route.id}><div><small>{route.eligible ? "ELIGIBLE INPUTS" : "INPUT BLOCKED"}</small><strong>{route.label}</strong></div><span>{coins(route.netProfit)}</span><dl><div><dt>Cost</dt><dd>{coins(route.cost)}</dd></div><div><dt>Revenue</dt><dd>{coins(route.grossRevenue)}</dd></div><div><dt>Return</dt><dd>{route.returnOnCost === null ? "—" : percent.format(route.returnOnCost)}</dd></div></dl>{route.blockers.length ? <p>{route.blockers.join(" · ")}</p> : null}</article>)}</div> : <div className="calculator-invalid" role="alert"><strong>Comparison input needs attention</strong><p>{npc.error}</p></div>}
        </div>
      </section>

      <section className="three-column guidance-grid">
        <article className="guidance-card panel"><span>01</span><h2>Unlock before margin</h2><p>A profitable craft scenario remains blocked until the recipe is explicitly verified.</p></article>
        <article className="guidance-card panel"><span>02</span><h2>Limits are evidence</h2><p>An NPC route cannot be eligible when the relevant remaining limit is unknown or too small.</p></article>
        <article className="guidance-card panel"><span>03</span><h2>No guaranteed profit</h2><p>Prices, fills, competition, fees, and game mechanics can change after any calculation.</p></article>
      </section>
    </div>
  );
}
