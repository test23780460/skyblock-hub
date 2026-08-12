"use client";

import Link from "@/components/AppLink";
import { useEffect, useMemo, useState } from "react";
import {
  applyGoalUpdate,
  parseGoalUpdate,
  progressPercent,
  type GoalCadence,
  type GoalLifecycleAction,
  type GoalLifecycleStatus,
} from "@/lib/goals/lifecycle";

type Goal = {
  id: string;
  title: string;
  current: number;
  target: number;
  initialCurrent: number;
  unit: string;
  cadence: GoalCadence;
  status: GoalLifecycleStatus;
  progressPercent: number;
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  persisted: boolean;
  recurrence: { manualResetRequired: true; nextCycleAction: "reset" } | null;
};

type GoalDraft = Pick<Goal, "title" | "current" | "target" | "unit" | "cadence">;
type GoalApiPayload = { data?: { goal?: Goal; goals?: Goal[]; deleted?: boolean }; error?: { message?: string; action?: string } };

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
  if (!remaining) return [goal.cadence === "once" ? "Target reached—verify it in game before closing the goal." : "Cycle complete—start the next cycle manually when you are ready."];
  const quarter = remaining / 4;
  return [
    "Verify the current value and required unlocks",
    "Reach " + Math.min(goal.target, goal.current + quarter).toFixed(quarter < 10 ? 1 : 0) + " " + goal.unit,
    "Review gear, rates, and budget at the halfway point",
    "Complete the final " + Math.max(1, quarter).toFixed(quarter < 10 ? 1 : 0) + " " + goal.unit,
  ];
}

function draftFor(goal: Goal): GoalDraft {
  return { title: goal.title, current: goal.current, target: goal.target, unit: goal.unit, cadence: goal.cadence };
}

export function GoalsExperience({ authEnabled, signedIn, signInHref }: { authEnabled: boolean; signedIn: boolean; signInHref: string }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<GoalDraft | null>(null);
  const [title, setTitle] = useState("Farming 60");
  const [current, setCurrent] = useState(48);
  const [target, setTarget] = useState(60);
  const [unit, setUnit] = useState("level");
  const [cadence, setCadence] = useState<GoalCadence>("once");
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loadingGoals, setLoadingGoals] = useState(signedIn);
  const [busyAction, setBusyAction] = useState("");

  const previewGoal = useMemo<Goal>(() => ({
    id: "preview",
    title,
    current,
    target,
    initialCurrent: current,
    unit,
    cadence,
    status: "active",
    progressPercent: 0,
    completedAt: null,
    createdAt: null,
    updatedAt: null,
    persisted: false,
    recurrence: cadence === "once" ? null : { manualResetRequired: true, nextCycleAction: "reset" },
  }), [title, current, target, unit, cadence]);
  const selectedGoal = goals.find((goal) => goal.id === selectedId) || goals[0] || null;
  const activeGoal = selectedGoal || previewGoal;
  const steps = useMemo(() => buildSteps(activeGoal), [activeGoal]);

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    fetch("/api/goals", { headers: { accept: "application/json" }, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as GoalApiPayload;
        if (!response.ok || !payload.data?.goals) throw new Error(apiMessage(payload, "Saved goals could not be loaded."));
        if (!active) return;
        const loaded = payload.data.goals;
        setGoals(loaded);
        setSelectedId(loaded[0]?.id || "");
        setDraft(loaded[0] ? draftFor(loaded[0]) : null);
        setLoadingGoals(false);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Saved goals could not be loaded.");
        setLoadingGoals(false);
      });
    return () => { active = false; };
  }, [signedIn]);

  function selectTemplate(template: typeof templates[number]) {
    setTitle(template.title);
    setCurrent(template.current);
    setTarget(template.target);
    setUnit(template.unit);
    setMessage("");
  }

  function selectGoal(goal: Goal) {
    setSelectedId(goal.id);
    setDraft(draftFor(goal));
    setMessage("");
  }

  async function createGoal(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !unit.trim() || !Number.isFinite(current) || !Number.isFinite(target) || current < 0 || target <= current) {
      setMessage("Use a target greater than the current value and include a title and unit.");
      return;
    }
    setBusyAction("create");
    setMessage("");
    if (!signedIn) {
      const now = new Date().toISOString();
      const candidate: Goal = {
        id: "preview_" + crypto.randomUUID(),
        title: title.trim(),
        current,
        target,
        initialCurrent: current,
        unit: unit.trim(),
        cadence,
        status: "active",
        progressPercent: 0,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        persisted: false,
        recurrence: cadence === "once" ? null : { manualResetRequired: true, nextCycleAction: "reset" },
      };
      setGoals((existing) => [candidate, ...existing]);
      selectGoal(candidate);
      setMessage(authEnabled ? "Visit preview created. Sign in to persist it." : "Visit preview created; account sync is disabled.");
      setBusyAction("");
      return;
    }
    try {
      const response = await fetch("/api/goals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: title.trim(), current, target, unit: unit.trim(), cadence }),
      });
      const payload = await response.json() as GoalApiPayload;
      if (!response.ok || !payload.data?.goal) throw new Error(apiMessage(payload, "The goal could not be saved."));
      const saved = payload.data.goal;
      setGoals((existing) => [saved, ...existing]);
      selectGoal(saved);
      setMessage("Goal saved to your SkyPilot account.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The goal could not be saved.");
    } finally {
      setBusyAction("");
    }
  }

  async function saveChanges(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedGoal || !draft) return;
    await mutateGoal(selectedGoal, { action: "update", ...draft }, "Goal changes saved.");
  }

  async function lifecycleAction(action: Exclude<GoalLifecycleAction, "update">) {
    if (!selectedGoal) return;
    const success = action === "complete"
      ? "Goal marked complete."
      : action === "pause"
        ? "Goal paused."
        : action === "resume"
          ? "Goal resumed."
          : selectedGoal.cadence === "once"
            ? "Goal progress reset."
            : "The next recurring cycle is ready.";
    await mutateGoal(selectedGoal, { action }, success);
  }

  async function mutateGoal(goal: Goal, update: Record<string, unknown>, successMessage: string) {
    setBusyAction(String(update.action || "update"));
    setMessage("");
    if (!goal.persisted) {
      const parsed = parseGoalUpdate(update);
      if (!parsed.ok) {
        setMessage(parsed.message);
        setBusyAction("");
        return;
      }
      const transition = applyGoalUpdate({
        title: goal.title,
        status: goal.status,
        progressPercent: goal.progressPercent,
        target: { current: goal.current, target: goal.target, initialCurrent: goal.initialCurrent, unit: goal.unit, cadence: goal.cadence },
        completedAt: goal.completedAt ? new Date(goal.completedAt) : null,
      }, parsed.value);
      if (!transition.ok) {
        setMessage(transition.message);
        setBusyAction("");
        return;
      }
      const changed: Goal = {
        ...goal,
        title: transition.value.title,
        current: transition.value.target.current,
        target: transition.value.target.target,
        initialCurrent: transition.value.target.initialCurrent,
        unit: transition.value.target.unit,
        cadence: transition.value.target.cadence,
        status: transition.value.status,
        progressPercent: progressPercent(transition.value.target),
        completedAt: transition.value.completedAt?.toISOString() ?? null,
        updatedAt: new Date().toISOString(),
        recurrence: transition.value.target.cadence === "once" ? null : { manualResetRequired: true, nextCycleAction: "reset" },
      };
      replaceGoal(changed);
      setMessage(successMessage + " This remains a visit preview.");
      setBusyAction("");
      return;
    }
    try {
      const response = await fetch("/api/goals/" + encodeURIComponent(goal.id), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(update),
      });
      const payload = await response.json() as GoalApiPayload;
      if (!response.ok || !payload.data?.goal) throw new Error(apiMessage(payload, "The goal could not be updated."));
      replaceGoal(payload.data.goal);
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The goal could not be updated.");
    } finally {
      setBusyAction("");
    }
  }

  function replaceGoal(goal: Goal) {
    setGoals((existing) => existing.map((item) => item.id === goal.id ? goal : item));
    setSelectedId(goal.id);
    setDraft(draftFor(goal));
  }

  async function deleteSelectedGoal() {
    if (!selectedGoal || !window.confirm("Delete this goal permanently? This cannot be undone.")) return;
    setBusyAction("delete");
    setMessage("");
    if (!selectedGoal.persisted) {
      removeGoalFromView(selectedGoal.id);
      setMessage("Visit preview removed.");
      setBusyAction("");
      return;
    }
    try {
      const response = await fetch("/api/goals/" + encodeURIComponent(selectedGoal.id), { method: "DELETE" });
      const payload = await response.json() as GoalApiPayload;
      if (!response.ok || !payload.data?.deleted) throw new Error(apiMessage(payload, "The goal could not be deleted."));
      removeGoalFromView(selectedGoal.id);
      setMessage("Goal permanently deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The goal could not be deleted.");
    } finally {
      setBusyAction("");
    }
  }

  function removeGoalFromView(goalId: string) {
    const remaining = goals.filter((goal) => goal.id !== goalId);
    setGoals(remaining);
    setSelectedId(remaining[0]?.id || "");
    setDraft(remaining[0] ? draftFor(remaining[0]) : null);
  }

  return (
    <div className="page-shell goals-page">
      <header className="page-header"><div className="page-title"><small>GOALS INTO FLIGHT PLANS</small><h1>Progress with a destination</h1><p>Build and manage deliberate goals without background player monitoring or automatic recurring refreshes.</p></div>{signedIn ? <span className="account-chip"><i /> SAVING ENABLED</span> : authEnabled ? <Link className="button-primary" href={signInHref}>Sign in to save goals</Link> : <span className="account-chip">LOCAL PREVIEW ONLY</span>}</header>
      {!signedIn ? <div className="notice"><strong>i</strong><span>{authEnabled ? "Visit previews can be managed now but persist only after sign-in." : "Account sync is disabled in this environment. Goal previews last only for this visit."}</span></div> : null}
      {loadError ? <div className="notice" role="alert"><strong>!</strong><span>{loadError} Reload after persistence is available; no saved data was changed.</span></div> : null}

      <section className="panel" aria-label="Goal library">
        <div className="panel-header"><div><h2>{signedIn ? "Saved goals" : "Visit previews"}</h2><small>{loadingGoals ? "Loading…" : goals.length + " available"}</small></div><span className="unofficial-label">OWNER-SCOPED</span></div>
        {loadingGoals ? <div className="empty-inline" role="status">Loading saved goals…</div> : goals.length ? <div className="goal-template-strip">{goals.map((goal) => <button aria-pressed={activeGoal.id === goal.id} className={activeGoal.id === goal.id ? "active" : ""} type="button" key={goal.id} onClick={() => selectGoal(goal)}><span aria-hidden="true">◎</span><strong>{goal.title}</strong><small>{goal.status} · {goal.progressPercent.toFixed(0)}%</small></button>)}</div> : <div className="empty-inline">{signedIn ? "No saved goals yet. Create one below." : "No visit previews yet. Create one below."}</div>}
      </section>

      <section className="goal-template-strip" aria-label="Goal templates">{templates.map((template) => <button type="button" key={template.title} onClick={() => selectTemplate(template)}><span aria-hidden="true">◎</span><strong>{template.title}</strong><small>{template.target} {template.unit}</small></button>)}</section>
      <section className="two-column goals-workspace">
        <div className="panel goal-builder"><div className="panel-header"><div><h2>Create a goal</h2><small>Custom or template-based</small></div><span className="lab-symbol" aria-hidden="true">◎</span></div><form onSubmit={createGoal}>
          <label className="wide"><span>Goal title</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} required /></label>
          <NumberField label="Current value" value={current} onChange={setCurrent} />
          <NumberField label="Target value" value={target} onChange={setTarget} />
          <label><span>Unit</span><input value={unit} onChange={(event) => setUnit(event.target.value)} maxLength={30} required /></label>
          <CadenceSelect label="Cadence" value={cadence} onChange={setCadence} />
          <div className="wide goal-submit"><button className="button-primary" type="submit" disabled={Boolean(busyAction)}>{busyAction === "create" ? "Saving…" : signedIn ? "Save goal" : "Create preview"}</button></div>
        </form></div>
        <div className="panel goal-preview"><div className="panel-header"><div><h2>{activeGoal.title || "Goal preview"}</h2><small>{activeGoal.persisted ? "Saved" : "Planning preview"} · {activeGoal.status} · {activeGoal.cadence}</small></div><strong>{activeGoal.progressPercent.toFixed(0)}%</strong></div>
          <div className="goal-progress"><div><span>{activeGoal.current.toLocaleString()} {activeGoal.unit}</span><span>{activeGoal.target.toLocaleString()} {activeGoal.unit}</span></div><div className="progress-track" role="progressbar" aria-label={activeGoal.title + " progress"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={activeGoal.progressPercent}><i style={{ width: activeGoal.progressPercent + "%" }} /></div><small>{Math.max(0, activeGoal.target - activeGoal.current).toLocaleString()} {activeGoal.unit} remaining · measured from {activeGoal.initialCurrent.toLocaleString()}</small></div>
          {activeGoal.recurrence ? <div className="notice"><strong>REPEAT</strong><span>Completing this {activeGoal.cadence} goal closes the current cycle. Starting the next cycle is always a deliberate reset.</span></div> : null}
          <ol className="goal-steps">{steps.map((step, index) => <li key={step}><span>{index + 1}</span><div><small>STEP {index + 1}</small><strong>{step}</strong></div></li>)}</ol>
        </div>
      </section>

      {selectedGoal && draft ? <section className="panel goal-builder" aria-label="Manage selected goal"><div className="panel-header"><div><h2>Manage selected goal</h2><small>Changes apply only to this owner-scoped goal</small></div><span className="unofficial-label">{selectedGoal.persisted ? "PERSISTED" : "VISIT PREVIEW"}</span></div><form onSubmit={saveChanges}>
        <label className="wide"><span>Goal title</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} maxLength={80} required /></label>
        <NumberField label="Current value" value={draft.current} onChange={(value) => setDraft({ ...draft, current: value })} />
        <NumberField label="Target value" value={draft.target} onChange={(value) => setDraft({ ...draft, target: value })} />
        <label><span>Unit</span><input value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} maxLength={30} required /></label>
        <CadenceSelect label="Cadence" value={draft.cadence} onChange={(value) => setDraft({ ...draft, cadence: value })} />
        <div className="wide goal-submit"><button className="button-primary" type="submit" disabled={Boolean(busyAction)}>{busyAction === "update" ? "Saving…" : "Save changes"}</button></div>
      </form><div className="toolbar" role="group" aria-label="Goal lifecycle actions">
        {selectedGoal.status !== "completed" && selectedGoal.status !== "archived" ? <button className="button-primary" type="button" disabled={Boolean(busyAction)} onClick={() => void lifecycleAction("complete")}>Mark complete</button> : null}
        {selectedGoal.status === "active" ? <button className="button-secondary" type="button" disabled={Boolean(busyAction)} onClick={() => void lifecycleAction("pause")}>Pause</button> : null}
        {selectedGoal.status === "paused" ? <button className="button-secondary" type="button" disabled={Boolean(busyAction)} onClick={() => void lifecycleAction("resume")}>Resume</button> : null}
        {selectedGoal.progressPercent > 0 || selectedGoal.status === "completed" || selectedGoal.status === "archived" ? <button className="button-secondary" type="button" disabled={Boolean(busyAction)} onClick={() => void lifecycleAction("reset")}>{selectedGoal.cadence === "once" ? "Reset progress" : "Start next " + selectedGoal.cadence + " cycle"}</button> : null}
        <button className="button-secondary" type="button" disabled={Boolean(busyAction)} onClick={() => void deleteSelectedGoal()}>{busyAction === "delete" ? "Deleting…" : "Delete permanently"}</button>
      </div></section> : null}

      <div aria-live="polite" className="notice"><strong>STATUS</strong><span>{message || (selectedGoal?.persisted ? "Saved changes are user-triggered and never refresh player data." : "No persistent change has been made.")}</span></div>
      <section className="three-column guidance-grid"><article className="guidance-card panel"><span>01</span><h2>User-triggered progress</h2><p>Goal changes never schedule player profile refreshes.</p></article><article className="guidance-card panel"><span>02</span><h2>Explicit recurrence</h2><p>Daily and weekly cycles restart only when you choose the next-cycle action.</p></article><article className="guidance-card panel"><span>03</span><h2>Owner-scoped writes</h2><p>Saved reads, updates, and deletes are constrained by SkyPilot&apos;s canonical user ID on the server.</p></article></section>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label><span>{label}</span><input type="number" min="0" step="any" value={value} onChange={(event) => { const next = Number(event.target.value); onChange(Number.isFinite(next) ? Math.max(0, next) : 0); }} required /></label>;
}

function CadenceSelect({ label, value, onChange }: { label: string; value: GoalCadence; onChange: (value: GoalCadence) => void }) {
  return <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value as GoalCadence)}><option value="once">One-time target</option><option value="daily">Daily cycle</option><option value="weekly">Weekly cycle</option></select></label>;
}

function apiMessage(payload: GoalApiPayload, fallback: string): string {
  return [payload.error?.message, payload.error?.action].filter(Boolean).join(" ") || fallback;
}
