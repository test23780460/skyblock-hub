"use client";

import Link from "@/components/AppLink";
import { useMemo, useState } from "react";
import type { ModuleDefinition, ModuleKind } from "@/lib/module-catalog";

const calculatorCopy: Record<ModuleKind, { labels: [string, string, string]; defaults: [number, number, number] }> = {
  planning: { labels: ["Budget (coins)", "Upgrade cost", "Benefit per upgrade"], defaults: [50_000_000, 8_000_000, 12] },
  market: { labels: ["Buy price", "Sell price", "Quantity"], defaults: [950, 1100, 10_000] },
  xp: { labels: ["XP remaining", "XP per hour", "Hours per session"], defaults: [12_000_000, 850_000, 2] },
  profit: { labels: ["Gross coins/hour", "Hours", "Setup or run costs"], defaults: [8_500_000, 4, 3_000_000] },
  valuation: { labels: ["Base value", "Modifier value", "Comparable sales"], defaults: [25_000_000, 8_000_000, 12] },
  completion: { labels: ["Current progress", "Target progress", "Progress/hour"], defaults: [62, 75, 2.5] },
  gear: { labels: ["Current score", "Modeled gain", "Upgrade cost"], defaults: [420, 38, 22_000_000] },
};

function compact(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

function calculate(kind: ModuleKind, values: [number, number, number]) {
  const [a, b, c] = values.map((value) => Number.isFinite(value) ? Math.max(0, value) : 0) as [number, number, number];
  if (kind === "market") {
    const gross = (b - a) * c;
    const fees = b * c * 0.0125;
    const net = gross - fees;
    const invested = a * c;
    return { headline: compact(net) + " estimated net", detail: compact(gross) + " gross − " + compact(fees) + " assumed fees", secondary: invested ? (net / invested * 100).toFixed(2) + "% modeled return" : "Enter a buy price" };
  }
  if (kind === "xp") {
    const hours = b ? a / b : 0;
    return { headline: hours.toFixed(1) + " hours", detail: compact(a) + " XP at " + compact(b) + " XP/hour", secondary: c ? Math.ceil(hours / c) + " sessions of " + c + "h" : "Enter a session length" };
  }
  if (kind === "profit") {
    const net = a * b - c;
    return { headline: compact(net) + " estimated net", detail: compact(a * b) + " gross across " + b + " hours", secondary: compact(c) + " costs included" };
  }
  if (kind === "valuation") {
    const expected = a + b;
    const confidence = c >= 20 ? "High" : c >= 6 ? "Medium" : "Low";
    return { headline: compact(expected) + " modeled value", detail: compact(expected * .88) + "–" + compact(expected * 1.12) + " scenario range", secondary: confidence + " confidence from " + c + " comparables" };
  }
  if (kind === "completion") {
    const remaining = Math.max(0, b - a);
    return { headline: remaining.toFixed(1) + " remaining", detail: a + " current → " + b + " target", secondary: c ? (remaining / c).toFixed(1) + " estimated hours" : "Enter an hourly rate" };
  }
  if (kind === "gear") {
    const costPerGain = b ? c / b : 0;
    return { headline: "+" + b + " modeled gain", detail: a + " → " + (a + b) + " activity score", secondary: compact(costPerGain) + " coins per point" };
  }
  const count = b ? Math.floor(a / b) : 0;
  return { headline: count + " reachable upgrades", detail: compact(count * b) + " of " + compact(a) + " budget used", secondary: "+" + compact(count * c) + " modeled total benefit" };
}

export function ModuleExperience({ definition }: { definition: ModuleDefinition }) {
  const calculator = calculatorCopy[definition.kind];
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<[number, number, number]>(calculator.defaults);
  const result = calculate(definition.kind, values);
  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return definition.rows;
    return definition.rows.filter((row) => [row.name, row.category, row.outcome, row.note, row.badge || ""].some((value) => value.toLowerCase().includes(normalized)));
  }, [definition.rows, query]);

  function updateValue(index: number, raw: string) {
    const next = [...values] as [number, number, number];
    next[index] = Number(raw);
    setValues(next);
  }

  return (
    <div className={"page-shell module-page accent-" + definition.accent}>
      <header className="page-header module-header">
        <div className="page-title"><small>{definition.eyebrow}</small><h1>{definition.title}</h1><p>{definition.description}</p></div>
        <div className="toolbar"><Link className="button-secondary" href="/dashboard">Analyze a player</Link><a className="button-primary" href="#planning-lab">Open planning lab</a></div>
      </header>

      <div className="notice module-note"><strong>DATA</strong><span>{definition.dataNote}</span></div>

      <section className="stat-grid module-metrics" aria-label="Module principles">
        {definition.metrics.map((metric) => <article className="stat-card" key={metric.label}><small>{metric.label}</small><strong>{metric.value}</strong><span>{metric.note}</span></article>)}
      </section>

      <section className="two-column module-workspace">
        <div className="panel feature-browser">
          <div className="panel-header"><div><h2>Feature map</h2><small>{rows.length} visible areas</small></div><label className="table-search"><span className="sr-only">Filter features</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter this module" /></label></div>
          <div className="feature-table" role="table" aria-label={definition.title + " capabilities"}>
            <div className="feature-table-head" role="row"><span>Area</span><span>Context</span><span>Outcome</span><span>Method</span></div>
            {rows.length ? rows.map((row) => <div className="feature-table-row" role="row" key={row.name}><div><strong>{row.name}</strong>{row.badge ? <small>{row.badge}</small> : null}</div><span>{row.category}</span><span>{row.outcome}</span><span>{row.note}</span></div>) : <div className="empty-inline">No feature areas match “{query}”.</div>}
          </div>
        </div>

        <div className="panel planning-lab" id="planning-lab">
          <div className="panel-header"><div><h2>Transparent planning lab</h2><small>Editable assumptions · no AI math</small></div><span className="lab-symbol" aria-hidden="true">#</span></div>
          <form className="lab-form" onSubmit={(event) => event.preventDefault()}>
            {calculator.labels.map((label, index) => <label key={label}><span>{label}</span><input type="number" min="0" step="any" value={values[index]} onChange={(event) => updateValue(index, event.target.value)} /></label>)}
          </form>
          <div className="lab-result" aria-live="polite"><small>MODELED RESULT</small><strong>{result.headline}</strong><span>{result.detail}</span><em>{result.secondary}</em></div>
          <p className="lab-disclaimer">Planning estimate only. Verify changing market prices, rates, requirements, and in-game mechanics before acting.</p>
        </div>
      </section>

      <section className="three-column guidance-grid">
        {definition.guidance.map((item, index) => <article className="guidance-card panel" key={item.title}><span>{String(index + 1).padStart(2, "0")}</span><h2>{item.title}</h2><p>{item.copy}</p></article>)}
      </section>
    </div>
  );
}
