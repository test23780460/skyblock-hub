"use client";

import Link from "@/components/AppLink";
import { useEffect, useMemo, useState } from "react";

type Goal = {
  id: string;
  title: string;
  current: number;
  target: number;
  unit: string;
  cadence: "once" | "daily" | "weekly";
  persisted: boolean;
};

const templates = [
  { title: "Farming 60", current: 48, target: 60, unit: "level" },
  { title: "1,000 Magical Power", current: 650, target: 1000, unit: "MP" },
  { title: "Catacombs 40", current: 32, target: 40, unit: "level" },
  { title: "1B Net Worth", current: 340, target: 1000, unit: "million coins" },
  { title: "Max Melon setup", current: 5, target: 9, unit: "upgrades" },
  { title: "Next minion slot", current: 11, target: 24, unit: "unique crafts" },
];

function buildSteps(goal: Goal): string[] {
  const remaining = Math.max(0, goal.target - goal.current);
  if (!remaining) return ["Target reached—verify it in game, then mark the goal complete."];
  const quarter = remaining / 4;
  return [
    "Verify the current value and required unlocks",
    "Reach " + Math.min(goal.target, goal.current + quarter).toFixed(quarter < 10 ? 1 : 0) + " " + goal.unit,
    "Review gear, rates, and budget at the halfway point",
    "Complete the final " + Math.max(1, quarter).toFixed(quarter < 10 ? 1 : 0) + " " + goal.unit,
  ];
}

export function GoalsExperience({ authEnabled, signedIn, signInHref }: { authEnabled: boolean; signedIn: boolean; signInHref: string }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [title, setTitle] = useState("Farming 60");
  const [current, setCurrent] = useState(48);
  const [target, setTarget] = useState(60);
  const [unit, setUnit] = useState("level");
  const [cadence, setCadence] = useState<Goal["cadence"]>("once");
  const [message, setMessage] = useState("");
  const previewGoal = useMemo<Goal>(() => ({ id: "preview", title, current, target, unit, cadence, persisted: false }), [title, current, target, unit, cadence]);
  const activeGoal = goals[0] || previewGoal;
  const steps = useMemo(() => buildSteps(activeGoal), [activeGoal]);

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    fetch("/api/goals", { headers: { accept: "application/json" }, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { data?: { goals?: Goal[] }; error?: { message?: string } };
        if (!response.ok || !payload.data?.goals) throw new Error(payload.error?.message || "Saved goals could not be loaded.");
        if (active) setGoals(payload.data.goals);
      })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "Saved goals could not be loaded."); });
    return () => { active = false; };
  }, [signedIn]);

  function selectTemplate(template: typeof templates[number]) {
    setTitle(template.title);
    setCurrent(template.current);
    setTarget(template.target);
    setUnit(template.unit);
    setMessage("");
  }

  async function createGoal(event: React.FormEvent) {
    event.preventDefault();
    const candidate: Goal = { id: crypto.randomUUID(), title: title.trim(), current, target, unit: unit.trim(), cadence, persisted: false };
    if (!candidate.title || !candidate.unit || !Number.isFinite(current) || !Number.isFinite(target) || current < 0 || target <= current) {
      setMessage("Use a target greater than the current value and include a title and unit.");
      return;
    }
    if (!signedIn) {
      setGoals((existing) => [candidate, ...existing]);
      setMessage("Preview created for this visit. Sign in to save it across devices.");
      return;
    }
    try {
      const response = await fetch("/api/goals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(candidate) });
      const payload = await response.json() as { data?: { goal?: Goal }; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "The goal could not be saved.");
      setGoals((existing) => [{ ...(payload.data?.goal || candidate), persisted: true }, ...existing]);
      setMessage("Goal saved to your SkyPilot account.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The goal could not be saved.");
    }
  }

  const progress = Math.max(0, Math.min(100, (activeGoal.current / Math.max(activeGoal.target, 1)) * 100));

  return (
    <div className="page-shell goals-page">
      <header className="page-header"><div className="page-title"><small>GOALS INTO FLIGHT PLANS</small><h1>Progress with a destination</h1><p>Break a large SkyBlock target into milestones, rates, gear checks, and deliberate sessions—without background player monitoring.</p></div>{signedIn ? <span className="account-chip"><i /> SAVING ENABLED</span> : authEnabled ? <Link className="button-primary" href={signInHref}>Sign in to save goals</Link> : <span className="account-chip">LOCAL PREVIEW ONLY</span>}</header>
      {!signedIn ? <div className="notice"><strong>i</strong><span>{authEnabled ? "You can build and calculate a goal now. It remains an unsaved visit preview until you sign in with ChatGPT." : "Account sync is disabled in this environment. Goal previews last only for this visit."}</span></div> : null}
      <section className="goal-template-strip" aria-label="Goal templates">{templates.map((template) => <button type="button" key={template.title} onClick={() => selectTemplate(template)}><span aria-hidden="true">◎</span><strong>{template.title}</strong><small>{template.target} {template.unit}</small></button>)}</section>
      <section className="two-column goals-workspace">
        <div className="panel goal-builder"><div className="panel-header"><div><h2>Create a goal</h2><small>Custom or template-based</small></div><span className="lab-symbol">◎</span></div><form onSubmit={createGoal}>
          <label className="wide"><span>Goal title</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} /></label>
          <label><span>Current value</span><input type="number" min="0" step="any" value={current} onChange={(event) => { const value = Number(event.target.value); setCurrent(Number.isFinite(value) ? Math.max(0, value) : 0); }} /></label>
          <label><span>Target value</span><input type="number" min="0" step="any" value={target} onChange={(event) => { const value = Number(event.target.value); setTarget(Number.isFinite(value) ? Math.max(0, value) : 0); }} /></label>
          <label><span>Unit</span><input value={unit} onChange={(event) => setUnit(event.target.value)} maxLength={30} /></label>
          <label><span>Cadence</span><select value={cadence} onChange={(event) => setCadence(event.target.value as Goal["cadence"])}><option value="once">One-time target</option><option value="daily">Daily task</option><option value="weekly">Weekly task</option></select></label>
          <div className="wide goal-submit"><button className="button-primary" type="submit">{signedIn ? "Save goal" : "Preview goal"}</button><span aria-live="polite">{message}</span></div>
        </form></div>
        <div className="panel goal-preview"><div className="panel-header"><div><h2>{activeGoal.title || "Goal preview"}</h2><small>{activeGoal.persisted ? "Saved" : "Planning preview"} · {activeGoal.cadence}</small></div><strong>{progress.toFixed(0)}%</strong></div>
          <div className="goal-progress"><div><span>{activeGoal.current.toLocaleString()} {activeGoal.unit}</span><span>{activeGoal.target.toLocaleString()} {activeGoal.unit}</span></div><div className="progress-track" role="progressbar" aria-label={activeGoal.title + " progress"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ width: progress + "%" }} /></div><small>{Math.max(0, activeGoal.target - activeGoal.current).toLocaleString()} {activeGoal.unit} remaining</small></div>
          <ol className="goal-steps">{steps.map((step, index) => <li key={step}><span>{index + 1}</span><div><small>STEP {index + 1}</small><strong>{step}</strong></div></li>)}</ol>
        </div>
      </section>
      <section className="three-column guidance-grid"><article className="guidance-card panel"><span>01</span><h2>User-triggered progress</h2><p>Goals never schedule player profile refreshes. Update or recalculate from a deliberate user action.</p></article><article className="guidance-card panel"><span>02</span><h2>Recommendation state</h2><p>Dashboard complete, ignore, and defer choices currently last for the browser visit; durable synchronization is not exposed yet.</p></article><article className="guidance-card panel"><span>03</span><h2>Portable ownership</h2><p>When account sync is enabled, goals belong to SkyPilot&apos;s canonical user ID rather than a provider-specific identifier.</p></article></section>
    </div>
  );
}
