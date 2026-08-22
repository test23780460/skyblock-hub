"use client";

import { useMemo, useState } from "react";
import {
  dungeonFloorCatalog,
  evaluateDungeonReadiness,
  type DungeonFloorId,
  type DungeonReadinessMetricInput,
} from "@/lib/engines/calculators/dungeon-readiness";

const initialMetrics: DungeonReadinessMetricInput[] = [
  { id: "class-level", label: "Selected class level", current: 20, target: 20, unit: "level", weight: 2 },
  { id: "effective-health", label: "Dungeon effective health", current: 80_000, target: 100_000, unit: "EHP", weight: 3 },
  { id: "boss-damage", label: "Repeatable boss damage", current: 400_000, target: 500_000, unit: "damage", weight: 3 },
  { id: "secrets", label: "Secrets per completed run", current: 5, target: 8, unit: "secrets", weight: 1 },
  { id: "completion-rate", label: "Measured completion rate", current: 0.8, target: 0.9, unit: "ratio", weight: 2 },
];

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

function metricDisplay(metric: DungeonReadinessMetricInput, value: number): string {
  if (metric.id === "completion-rate") return number.format(value * 100) + "%";
  return compact.format(value) + " " + metric.unit;
}

export function DungeonReadinessEvaluator() {
  const catalog = dungeonFloorCatalog();
  const [floor, setFloor] = useState<DungeonFloorId>("f5");
  const [combatLevel, setCombatLevel] = useState(30);
  const [catacombsLevel, setCatacombsLevel] = useState(20);
  const [floorUnlocked, setFloorUnlocked] = useState(true);
  const [metrics, setMetrics] = useState<DungeonReadinessMetricInput[]>(initialMetrics);

  const result = useMemo(() => evaluateDungeonReadiness({
    floor,
    combatLevel,
    catacombsLevel,
    floorUnlocked,
    metrics,
  }), [catacombsLevel, combatLevel, floor, floorUnlocked, metrics]);

  function updateMetric(id: DungeonReadinessMetricInput["id"], key: "current" | "target", raw: string) {
    const input = Math.max(0, Number(raw) || 0);
    const value = id === "completion-rate" ? Math.min(1, input / 100) : input;
    setMetrics((current) => current.map((metric) => metric.id === id ? { ...metric, [key]: value } : metric));
  }

  return (
    <section className="dungeon-readiness-section" aria-labelledby="dungeon-readiness-title">
      <div className="dungeon-readiness-heading">
        <div><small>ENTRY GATES · SETUP EVIDENCE · DEFICIENCIES</small><h2 id="dungeon-readiness-title">Floor readiness check</h2><p>Separate official access levels from your own measurable setup checkpoints, then see exactly what remains below target.</p></div>
        <a className="button-secondary" href="https://wiki.hypixel.net/Catacombs" rel="noreferrer" target="_blank">Official floor requirements</a>
      </div>

      <div className="notice module-note"><strong>UNOFFICIAL SCORE</strong><span>Only Combat/Catacombs access levels come from the official floor table. Every setup checkpoint below is an editable SkyPilot planning input, not an official readiness requirement.</span></div>

      <div className="two-column dungeon-readiness-workspace">
        <div className="panel dungeon-readiness-inputs">
          <div className="panel-header"><div><h2>Current setup</h2><small>Use repeatable in-dungeon measurements</small></div><button className="calculator-reset" onClick={() => setMetrics(initialMetrics)} type="button">Reset checkpoints</button></div>
          <div className="dungeon-entry-grid">
            <label><span>Target floor</span><select value={floor} onChange={(event) => setFloor(event.target.value as DungeonFloorId)}>{catalog.map((entry) => <option key={entry.id} value={entry.id}>{entry.label} · Cata {entry.minimumCatacombsLevel}</option>)}</select></label>
            <label><span>Combat level</span><input min="0" onChange={(event) => setCombatLevel(Math.max(0, Number(event.target.value) || 0))} step="any" type="number" value={combatLevel} /></label>
            <label><span>Catacombs level</span><input min="0" onChange={(event) => setCatacombsLevel(Math.max(0, Number(event.target.value) || 0))} step="any" type="number" value={catacombsLevel} /></label>
            <button aria-pressed={floorUnlocked} className={floorUnlocked ? "unlocked" : ""} onClick={() => setFloorUnlocked((current) => !current)} type="button">{floorUnlocked ? "Prior floor / mode confirmed" : "Prior floor / mode not confirmed"}</button>
          </div>
          <div className="dungeon-metric-table">
            <div className="dungeon-metric-head"><span>Checkpoint</span><span>Current</span><span>Your target</span></div>
            {metrics.map((metric) => (
              <div className="dungeon-metric-row" key={metric.id}>
                <div><strong>{metric.label}</strong><small>{metricDisplay(metric, metric.current)} / {metricDisplay(metric, metric.target)}</small></div>
                <label><span className="sr-only">Current {metric.label}</span><input max={metric.id === "completion-rate" ? 100 : undefined} min="0" onChange={(event) => updateMetric(metric.id, "current", event.target.value)} step="any" type="number" value={metric.id === "completion-rate" ? metric.current * 100 : metric.current} /></label>
                <label><span className="sr-only">Target {metric.label}</span><input max={metric.id === "completion-rate" ? 100 : undefined} min="0" onChange={(event) => updateMetric(metric.id, "target", event.target.value)} step="any" type="number" value={metric.id === "completion-rate" ? metric.target * 100 : metric.target} /></label>
              </div>
            ))}
          </div>
        </div>

        <aside className="dungeon-readiness-side">
          <div className={`panel dungeon-readiness-result status-${result.status}`} aria-live="polite">
            <div className="panel-header"><div><h2>{result.floorLabel}</h2><small>{result.entryEligible ? "Official entry gates met" : "Entry gate incomplete"}</small></div><span className="lab-symbol" aria-hidden="true">{result.entryEligible ? "✓" : "!"}</span></div>
            <div className="dungeon-readiness-score"><small>SKYPILOT READINESS</small><strong>{result.readinessScore === null ? "—" : number.format(result.readinessScore)}</strong><span>{result.readinessScore === null ? "No active checkpoints" : "out of 100"}</span><em>{result.status.replace("-", " ")}</em></div>
            <p>{result.explanation}</p>
            <dl><div><dt>Combat gate</dt><dd>{result.officialMinimumCombatLevel}</dd></div><div><dt>Catacombs gate</dt><dd>{result.officialMinimumCatacombsLevel}</dd></div><div><dt>Checkpoint coverage</dt><dd>{number.format(result.coveragePercent)}%</dd></div></dl>
          </div>

          <div className="panel dungeon-deficiency-panel">
            <div className="panel-header"><div><h2>Largest deficiencies</h2><small>Lowest completion percentage first</small></div></div>
            {result.entryBlockers.length ? <div className="dungeon-entry-blockers"><strong>ENTRY</strong><span>{result.entryBlockers.join(" · ")}</span></div> : null}
            {result.deficiencies.length ? <div className="dungeon-deficiency-list">{result.deficiencies.map((item) => <article key={item.id}><div><strong>{item.label}</strong><small>{number.format(item.completionPercent)}% of your checkpoint · gap {compact.format(item.gap)} {item.unit}</small></div><p>{item.recommendation}</p></article>)}</div> : <div className="empty-inline">Every active setup checkpoint is met. Verify the setup in real runs.</div>}
          </div>
        </aside>
      </div>

      <p className="dungeon-readiness-disclaimer">{result.disclaimer}</p>
    </section>
  );
}
