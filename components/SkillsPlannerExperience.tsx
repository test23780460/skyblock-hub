"use client";

import { useMemo, useState } from "react";
import Link from "@/components/AppLink";
import {
  estimateSkillLevelTarget,
  type CoreSkillId,
} from "@/lib/engines/calculators/skill";

type SkillInputs = {
  currentLevel: number;
  targetLevel: number;
  baseXpPerHour: number;
  xpBoostPercent: number;
  hoursPerSession: number;
};

const skills: readonly { id: CoreSkillId; label: string; area: string; defaults: SkillInputs }[] = [
  { id: "farming", label: "Farming", area: "Garden and crops", defaults: { currentLevel: 25, targetLevel: 40, baseXpPerHour: 800_000, xpBoostPercent: 0, hoursPerSession: 2 } },
  { id: "mining", label: "Mining", area: "HOTM and commissions", defaults: { currentLevel: 25, targetLevel: 40, baseXpPerHour: 500_000, xpBoostPercent: 0, hoursPerSession: 2 } },
  { id: "foraging", label: "Foraging", area: "Routes and milestones", defaults: { currentLevel: 20, targetLevel: 30, baseXpPerHour: 400_000, xpBoostPercent: 0, hoursPerSession: 2 } },
  { id: "fishing", label: "Fishing", area: "Catch progression", defaults: { currentLevel: 20, targetLevel: 30, baseXpPerHour: 300_000, xpBoostPercent: 0, hoursPerSession: 2 } },
  { id: "combat", label: "Combat", area: "Combat progression", defaults: { currentLevel: 25, targetLevel: 40, baseXpPerHour: 700_000, xpBoostPercent: 0, hoursPerSession: 2 } },
  { id: "enchanting", label: "Enchanting", area: "Experimentation", defaults: { currentLevel: 30, targetLevel: 50, baseXpPerHour: 1_500_000, xpBoostPercent: 0, hoursPerSession: 1 } },
  { id: "alchemy", label: "Alchemy", area: "Brewing progression", defaults: { currentLevel: 25, targetLevel: 40, baseXpPerHour: 1_000_000, xpBoostPercent: 0, hoursPerSession: 1 } },
] as const;

const initialInputs = Object.fromEntries(skills.map((skill) => [skill.id, skill.defaults])) as Record<CoreSkillId, SkillInputs>;
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function hours(value: number): string {
  return Number.isFinite(value) ? `${number.format(value)} hours` : "Rate required";
}

export function SkillsPlannerExperience() {
  const [active, setActive] = useState<CoreSkillId>("farming");
  const [inputs, setInputs] = useState(initialInputs);
  const definition = skills.find((skill) => skill.id === active) ?? skills[0];
  const current = inputs[active];
  const estimates = useMemo(() => Object.fromEntries(skills.map((skill) => [skill.id, estimateSkillLevelTarget({ skill: skill.id, ...inputs[skill.id] })])) as Record<CoreSkillId, ReturnType<typeof estimateSkillLevelTarget>>, [inputs]);
  const result = estimates[active];

  function update(key: keyof SkillInputs, raw: string) {
    let value = Math.max(0, Number(raw) || 0);
    if (key === "currentLevel" || key === "targetLevel") value = Math.min(result.levelCap, value);
    if (key === "hoursPerSession") value = Math.max(0.01, value);
    setInputs((state) => ({ ...state, [active]: { ...state[active], [key]: value } }));
  }

  return (
    <div className="page-shell module-page skills-planner-page">
      <header className="page-header module-header">
        <div className="page-title"><small>LEVELS · XP · TIME · SESSIONS</small><h1>Core skill flight plan</h1><p>Set current and target levels for every core skill, use a rate you can actually sustain, and see the XP, hours, and sessions still required.</p></div>
        <div className="toolbar"><Link className="button-secondary" href="/dashboard">Analyze a player</Link><Link className="button-primary" href="/calculators">All calculators</Link></div>
      </header>

      <div className="notice module-note"><strong>REFERENCE INPUTS</strong><span>Starting levels and rates are illustrative manual values, not live profile data or universal methods. Replace each rate with your measured setup.</span></div>

      <section className="skill-overview-grid" aria-label="Core skill target summaries">
        {skills.map((skill) => {
          const estimate = estimates[skill.id];
          return <button aria-pressed={active === skill.id} className={`panel ${active === skill.id ? "active" : ""}`} key={skill.id} onClick={() => setActive(skill.id)} type="button"><small>{skill.area}</small><strong>{skill.label}</strong><span>{number.format(inputs[skill.id].currentLevel)} → {number.format(inputs[skill.id].targetLevel)}</span><em>{estimate.complete ? "Target reached" : hours(estimate.hoursRemaining)}</em></button>;
        })}
      </section>

      <section className="two-column skill-planner-workspace">
        <div className="panel skill-target-inputs">
          <div className="panel-header"><div><h2>{definition.label} target</h2><small>{definition.area} · cap {result.levelCap}</small></div><button className="calculator-reset" onClick={() => setInputs((state) => ({ ...state, [active]: { ...definition.defaults } }))} type="button">Reset skill</button></div>
          <div className="skill-target-fields">
            <label><span>Current level<small>0–{result.levelCap}</small></span><input max={result.levelCap} min="0" onChange={(event) => update("currentLevel", event.target.value)} step="0.01" type="number" value={current.currentLevel} /></label>
            <label><span>Target level<small>0–{result.levelCap}</small></span><input max={result.levelCap} min="0" onChange={(event) => update("targetLevel", event.target.value)} step="0.01" type="number" value={current.targetLevel} /></label>
            <label><span>Measured base XP/hour<small>before entered boost</small></span><input min="0" onChange={(event) => update("baseXpPerHour", event.target.value)} step="any" type="number" value={current.baseXpPerHour} /></label>
            <label><span>Additional XP boost<small>percent</small></span><input min="0" onChange={(event) => update("xpBoostPercent", event.target.value)} step="0.01" type="number" value={current.xpBoostPercent} /></label>
            <label><span>Hours per session<small>used for session count</small></span><input min="0.01" onChange={(event) => update("hoursPerSession", event.target.value)} step="0.1" type="number" value={current.hoursPerSession} /></label>
          </div>
        </div>

        <aside className="panel skill-target-result" aria-live="polite">
          <div className="panel-header"><div><h2>Target result</h2><small>Centralized XP curve · deterministic</small></div><span className="lab-symbol" aria-hidden="true">=</span></div>
          <div className="skill-target-headline"><small>{definition.label.toUpperCase()}</small><strong>{result.complete ? "Target reached" : hours(result.hoursRemaining)}</strong><p>{compact.format(result.remainingXp)} XP remain at {compact.format(result.effectiveXpPerHour)} XP/hour.</p></div>
          <dl className="skill-target-metrics"><div><dt>XP to next level</dt><dd>{compact.format(result.xpToNextLevel)}</dd></div><div><dt>Next level</dt><dd>{result.nextLevel}</dd></div><div><dt>Sessions</dt><dd>{result.sessionsRemaining === null || !Number.isFinite(result.sessionsRemaining) ? "Rate required" : number.format(result.sessionsRemaining)}</dd></div><div><dt>Target total XP</dt><dd>{compact.format(result.targetXp)}</dd></div></dl>
          <div className="calculator-assumptions"><strong>Assumptions</strong><ul>{result.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></div>
        </aside>
      </section>

      <section className="three-column guidance-grid">
        <article className="guidance-card panel"><span>01</span><h2>Levels become exact XP</h2><p>Fractional current and target levels resolve through one versioned curve shared with profile analysis.</p></article>
        <article className="guidance-card panel"><span>02</span><h2>Measure your rate</h2><p>Routes, equipment, downtime, ping, and experience change output; one universal XP rate would be misleading.</p></article>
        <article className="guidance-card panel"><span>03</span><h2>Balance the profile</h2><p>Compare the seven summaries to find a reachable milestone instead of blindly chasing the highest cap.</p></article>
      </section>
    </div>
  );
}
