"use client";

import Link from "@/components/AppLink";
import type {
  AiCalculatorSelection,
  AiGoalCategory,
  AiGroundedFact,
  AssistantMode as Mode,
} from "@/lib/ai/types";
import { useState } from "react";

type ScenarioKind = AiCalculatorSelection["kind"] | "none";

type AssistantPayload = {
  answer: string;
  evidence: AiGroundedFact[];
  assumptions: string[];
  missingData: string[];
  context: {
    source: "none" | "demo" | "player";
    sourceLabel: string;
    profile: { profileName: string; cacheStatus: string } | null;
    limitations: string[];
  };
};

const suggestions = [
  "What should this profile do next with the selected budget?",
  "Explain the best Magical Power upgrades in simple terms.",
  "Which legitimate money-making methods fit the available context?",
  "What is holding back dungeon readiness?",
];

const initialScenarioInputs: Record<string, string> = {
  current: "",
  target: "",
  rate: "",
  secondary: "",
};

export function AiExperience({
  demo,
  enabled,
  playerContextEnabled,
  economyContextEnabled,
}: {
  demo: boolean;
  enabled: boolean;
  playerContextEnabled: boolean;
  economyContextEnabled: boolean;
}) {
  const [mode, setMode] = useState<Mode>("normal");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AssistantPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [profileId, setProfileId] = useState("");
  const [budget, setBudget] = useState("");
  const [goal, setGoal] = useState<AiGoalCategory | "none">("none");
  const [products, setProducts] = useState("");
  const [scenario, setScenario] = useState<ScenarioKind>("none");
  const [scenarioInputs, setScenarioInputs] = useState(initialScenarioInputs);

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    if (!enabled || question.trim().length < 3) return;
    setLoading(true);
    setAnswer(null);
    setError("");
    try {
      const planningBudget = finiteInput(budget);
      const calculator = calculatorSelection(scenario, scenarioInputs);
      const context = {
        source: demo ? "demo" : username.trim() ? "player" : "none",
        ...(username.trim() && !demo ? { username: username.trim() } : {}),
        ...(profileId.trim() && !demo ? { profileId: profileId.trim() } : {}),
        ...(planningBudget !== undefined ? { budget: planningBudget } : {}),
        goals: goal === "none" ? [] : [goal],
        economyProductIds: economyContextEnabled ? productIds(products) : [],
        ...(calculator ? { calculator } : {}),
      };
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, mode, context }),
      });
      const payload = await response.json() as { data?: AssistantPayload; error?: { message?: string; action?: string } };
      if (!response.ok || !payload.data?.answer) {
        throw new Error([payload.error?.message, payload.error?.action].filter(Boolean).join(" ") || "The assistant could not answer.");
      }
      setAnswer(payload.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The assistant is unavailable.");
    } finally {
      setLoading(false);
    }
  }

  function updateScenarioInput(key: string, value: string) {
    setScenarioInputs((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="page-shell ai-page">
      <header className="page-header"><div className="page-title"><small>STRUCTURED · GROUNDED · OPTIONAL</small><h1>SkyPilot assistant</h1><p>Ask for explanations and planning help grounded in server-resolved profile data and SkyPilot&apos;s deterministic calculations. The rest of the product never depends on AI.</p></div><div className="toolbar"><Link className="button-secondary" href="/dashboard">Analyze a real profile</Link><Link className="button-primary" href="/ai?demo=1">Use labeled demo context</Link></div></header>
      {!enabled ? <div className="notice"><strong>OFF</strong><span>The optional assistant is disabled in this environment. Deterministic planning tools remain available.</span></div> : demo ? <div className="demo-banner"><strong>DEMO CONTEXT</strong><span>The server will resolve the labeled PilotExample fixture. The browser does not send its facts.</span><Link href="/ai">Clear context</Link></div> : <div className="notice"><strong>i</strong><span>{playerContextEnabled ? "Add a Minecraft username below for a fresh or shared-cached, user-triggered profile lookup. Leave it blank for a general answer." : "Live player context is disabled. Use labeled demo context or ask a general question."}</span></div>}
      <section className="ai-layout">
        <div className="panel ai-chat">
          <div className="panel-header"><div><h2>Ask SkyPilot</h2><small>Deterministic facts remain authoritative</small></div><div className="mode-switch" role="group" aria-label="Answer detail">{(["beginner", "normal", "advanced"] as Mode[]).map((value) => <button aria-pressed={mode === value} className={mode === value ? "active" : ""} type="button" key={value} onClick={() => setMode(value)}>{value}</button>)}</div></div>
          <div className="ai-output" aria-live="polite">
            {loading ? <div className="ai-thinking" role="status"><span /><span /><span /> Resolving trusted data and checking the answer…</div> : answer ? <div className="assistant-answer"><span className="assistant-mark">✣</span><div><small>SKYPILOT ASSISTANT · {answer.context.sourceLabel}</small><p>{answer.answer}</p>{answer.evidence.length > 0 ? <dl className="admin-health-list" aria-label="Authoritative evidence">{answer.evidence.map((fact) => <div key={fact.id}><dt>{fact.label}</dt><dd>{fact.display}</dd></div>)}</dl> : null}{answer.context.limitations.length > 0 ? <details><summary>Known limitations</summary><ul>{answer.context.limitations.map((item) => <li key={item}>{item}</li>)}</ul></details> : null}</div></div> : error ? <div className="ai-error" role="alert"><strong>Assistant unavailable</strong><p>{error}</p><span>Profile tools, calculators, and market modules still work without AI.</span></div> : <div className="ai-welcome"><span>✣</span><h2>Ask for a decision, not just a definition.</h2><p>Add selectors and scenario inputs below. SkyPilot resolves facts on the server and rejects model output that conflicts with them.</p></div>}
          </div>
          <form className="assistant-form" onSubmit={ask}>
            <details className="panel assistant-context" open={demo}>
              <summary>Grounding context</summary>
              <div className="calculator-fields">
                {!demo ? <>
                  <label htmlFor="assistant-username">
                    <span>Minecraft username</span>
                    <input className="control" id="assistant-username" value={username} onChange={(event) => setUsername(event.target.value)} maxLength={16} pattern="[A-Za-z0-9_]{1,16}" placeholder={playerContextEnabled ? "Optional" : "Live context disabled"} disabled={!enabled || !playerContextEnabled} />
                  </label>
                  <label htmlFor="assistant-profile-id">
                    <span>Profile ID</span>
                    <input className="control" id="assistant-profile-id" value={profileId} onChange={(event) => setProfileId(event.target.value)} maxLength={36} pattern="[0-9A-Fa-f-]{32,36}" placeholder="Optional 32-character ID" disabled={!enabled || !playerContextEnabled || !username.trim()} />
                  </label>
                </> : null}
                <label htmlFor="assistant-budget">
                  <span>Planning budget (coins)</span>
                  <input className="control" id="assistant-budget" type="number" min="0" step="1" inputMode="numeric" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="Optional scenario input" disabled={!enabled} />
                </label>
                <label htmlFor="assistant-goal">
                  <span>Planning focus</span>
                  <select className="control" id="assistant-goal" value={goal} onChange={(event) => setGoal(event.target.value as AiGoalCategory | "none")} disabled={!enabled}><option value="none">No fixed focus</option><option value="progression">Progression</option><option value="accessories">Accessories</option><option value="farming">Farming</option><option value="dungeons">Dungeons</option><option value="slayers">Slayers</option><option value="minions">Minions</option><option value="economy">Economy</option></select>
                </label>
                <label htmlFor="assistant-products">
                  <span>Bazaar product IDs</span>
                  <input className="control" id="assistant-products" value={products} onChange={(event) => setProducts(event.target.value)} maxLength={320} placeholder={economyContextEnabled ? "ENCHANTED_CARROT, BOOSTER_COOKIE" : "Current economy context disabled"} disabled={!enabled || !economyContextEnabled} />
                  <small>Up to eight IDs. Prices are resolved from the durable current snapshot; typed prices are never accepted.</small>
                </label>
                <label htmlFor="assistant-scenario">
                  <span>Deterministic scenario</span>
                  <select className="control" id="assistant-scenario" value={scenario} onChange={(event) => { setScenario(event.target.value as ScenarioKind); setScenarioInputs(initialScenarioInputs); }} disabled={!enabled}><option value="none">None</option><option value="farming">Farming XP</option><option value="garden">Garden yield</option><option value="dungeon">Dungeon runs</option><option value="slayer">Slayer progress</option><option value="minion">Minion profit</option><option value="pet">Pet XP</option></select>
                </label>
                {scenario !== "none" ? <ScenarioFields kind={scenario} values={scenarioInputs} hasProfileContext={demo || Boolean(username.trim())} onChange={updateScenarioInput} /> : null}
              </div>
            </details>
            <label className="sr-only" htmlFor="assistant-question">Question</label><textarea id="assistant-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1200} placeholder="What should I upgrade next with the selected context?" disabled={!enabled} /><div><span>{question.length}/1200</span><button type="submit" disabled={!enabled || loading || question.trim().length < 3}>{loading ? "Grounding…" : enabled ? "Ask assistant →" : "Assistant disabled"}</button></div>
          </form>
        </div>
        <aside className="ai-side">
          <div className="panel"><div className="panel-header"><h2>Try asking</h2></div><div className="suggestion-list">{suggestions.map((suggestion) => <button type="button" onClick={() => setQuestion(suggestion)} key={suggestion}>{suggestion}<span>→</span></button>)}</div></div>
          <div className="panel grounding-card"><div className="panel-header"><h2>Grounding rules</h2></div><ul><li><span>1</span>Accepts selectors, never client-supplied player facts or prices.</li><li><span>2</span>Runs selected calculations on the server and rejects numeric conflicts.</li><li><span>3</span>Names missing or stale data instead of guessing.</li><li><span>4</span>Stores aggregate usage metrics, never prompts or answers.</li></ul></div>
        </aside>
      </section>
    </div>
  );
}

function ScenarioFields({ kind, values, hasProfileContext, onChange }: { kind: Exclude<ScenarioKind, "none">; values: Record<string, string>; hasProfileContext: boolean; onChange: (key: string, value: string) => void }) {
  const labels: Record<Exclude<ScenarioKind, "none">, [string, string, string, string]> = {
    farming: ["Current Farming XP (optional with profile)", "Target Farming XP", "Base XP per hour", "XP boost percent (optional)"],
    pet: ["Current pet XP", "Target pet XP", "Skill XP per hour", "Skill-to-pet XP ratio"],
    minion: ["Minion count", "Base action seconds", "Items per output", "Sell price per item"],
    dungeon: ["Current Catacombs XP (optional with profile)", "Target Catacombs XP", "XP per completion", "Minutes per attempt"],
    slayer: ["Current Slayer XP (optional with profile)", "Target Slayer XP", "XP per boss", "Seconds per attempt"],
    garden: ["Base Farming Fortune", "Crop-specific Fortune (optional)", "Blocks per hour", "Coin value per item (optional)"],
  };
  return <>{(["current", "target", "rate", "secondary"] as const).map((key, index) => <label key={key}><span>{labels[kind][index]}</span><input className="control" type="number" min="0" step={kind === "minion" && key === "current" ? "1" : "any"} inputMode="decimal" value={values[key]} onChange={(event) => onChange(key, event.target.value)} required={requiredScenarioField(kind, key, hasProfileContext)} /></label>)}</>;
}

function requiredScenarioField(kind: Exclude<ScenarioKind, "none">, key: string, hasProfileContext: boolean): boolean {
  if ((kind === "farming" || kind === "dungeon" || kind === "slayer") && key === "current") return !hasProfileContext;
  if (kind === "farming" && key === "secondary") return false;
  if (kind === "garden" && (key === "target" || key === "secondary")) return false;
  return true;
}

function calculatorSelection(kind: ScenarioKind, values: Record<string, string>): AiCalculatorSelection | undefined {
  if (kind === "none") return undefined;
  const current = finiteInput(values.current);
  const target = finiteInput(values.target);
  const rate = finiteInput(values.rate);
  const secondary = finiteInput(values.secondary);
  if (kind === "farming" && target !== undefined && rate !== undefined) return { kind, inputs: { ...(current !== undefined ? { currentXp: current } : {}), targetXp: target, baseXpPerHour: rate, ...(secondary !== undefined ? { xpBoostPercent: secondary } : {}) } };
  if (kind === "pet" && current !== undefined && target !== undefined && rate !== undefined && secondary !== undefined) return { kind, inputs: { currentPetXp: current, targetPetXp: target, skillXpPerHour: rate, skillToPetXpRatio: secondary } };
  if (kind === "minion" && current !== undefined && target !== undefined && rate !== undefined && secondary !== undefined) return { kind, inputs: { minionCount: current, baseActionTimeSeconds: target, itemsPerOutput: rate, sellPricePerItem: secondary } };
  if (kind === "dungeon" && target !== undefined && rate !== undefined && secondary !== undefined) return { kind, inputs: { ...(current !== undefined ? { currentCatacombsXp: current } : {}), targetCatacombsXp: target, catacombsXpPerCompletion: rate, minutesPerAttempt: secondary } };
  if (kind === "slayer" && target !== undefined && rate !== undefined && secondary !== undefined) return { kind, inputs: { ...(current !== undefined ? { currentSlayerXp: current } : {}), targetSlayerXp: target, xpPerBoss: rate, secondsPerAttempt: secondary } };
  if (kind === "garden" && current !== undefined && rate !== undefined) return { kind, inputs: { baseFortune: current, ...(target !== undefined ? { cropSpecificFortune: target } : {}), blocksPerHour: rate, ...(secondary !== undefined ? { coinValuePerItem: secondary } : {}) } };
  return undefined;
}

function finiteInput(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function productIds(value: string): string[] {
  return [...new Set(value.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean))].slice(0, 8);
}
