"use client";

import Link from "@/components/AppLink";
import { useState } from "react";

type Mode = "beginner" | "normal" | "advanced";

const suggestions = [
  "What should this profile do next with 50 million coins?",
  "Explain the best Magical Power upgrades in simple terms.",
  "Which money-making methods fit this profile's current setup?",
  "What is holding back dungeon readiness?",
];

export function AiExperience({ demo, enabled }: { demo: boolean; enabled: boolean }) {
  const [mode, setMode] = useState<Mode>("normal");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    if (!enabled || question.trim().length < 3) return;
    setLoading(true);
    setAnswer("");
    setError("");
    try {
      const response = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, mode, contextMode: demo ? "demo" : "none" }) });
      const payload = await response.json() as { data?: { answer?: string }; error?: { message?: string; action?: string } };
      if (!response.ok || !payload.data?.answer) throw new Error([payload.error?.message, payload.error?.action].filter(Boolean).join(" ") || "The assistant could not answer.");
      setAnswer(payload.data.answer);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The assistant is unavailable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell ai-page">
      <header className="page-header"><div className="page-title"><small>STRUCTURED · GROUNDED · OPTIONAL</small><h1>SkyPilot assistant</h1><p>Ask for explanations and planning help grounded in SkyPilot&apos;s deterministic calculations. The rest of the product never depends on AI.</p></div><div className="toolbar"><Link className="button-secondary" href="/dashboard">Analyze a real profile</Link><Link className="button-primary" href="/ai?demo=1">Use labeled demo context</Link></div></header>
      {!enabled ? <div className="notice"><strong>OFF</strong><span>The optional assistant is disabled in this environment. Deterministic planning tools remain available.</span></div> : demo ? <div className="demo-banner"><strong>DEMO CONTEXT</strong><span>The assistant will receive the labeled PilotExample fixture, not live data.</span><Link href="/ai">Clear context</Link></div> : <div className="notice"><strong>i</strong><span>No player context is attached. The assistant will explain concepts but will not invent profile-specific numbers.</span></div>}
      <section className="ai-layout">
        <div className="panel ai-chat">
          <div className="panel-header"><div><h2>Ask SkyPilot</h2><small>Deterministic facts remain authoritative</small></div><div className="mode-switch" role="group" aria-label="Answer detail">{(["beginner", "normal", "advanced"] as Mode[]).map((value) => <button aria-pressed={mode === value} className={mode === value ? "active" : ""} type="button" key={value} onClick={() => setMode(value)}>{value}</button>)}</div></div>
          <div className="ai-output" aria-live="polite">
            {loading ? <div className="ai-thinking"><span /><span /><span /> Grounding the answer in available data…</div> : answer ? <div className="assistant-answer"><span className="assistant-mark">✣</span><div><small>SKYPILOT ASSISTANT</small><p>{answer}</p></div></div> : error ? <div className="ai-error" role="alert"><strong>Assistant unavailable</strong><p>{error}</p><span>Profile tools, calculators, and market modules still work without AI.</span></div> : <div className="ai-welcome"><span>✣</span><h2>Ask for a decision, not just a definition.</h2><p>Good questions include your goal, budget, preferred activity, and appetite for grind or market risk.</p></div>}
          </div>
          <form className="assistant-form" onSubmit={ask}><label className="sr-only" htmlFor="assistant-question">Question</label><textarea id="assistant-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1200} placeholder="What should I upgrade next with 50M coins?" disabled={!enabled} /><div><span>{question.length}/1200</span><button type="submit" disabled={!enabled || loading || question.trim().length < 3}>{loading ? "Thinking…" : enabled ? "Ask assistant →" : "Assistant disabled"}</button></div></form>
        </div>
        <aside className="ai-side">
          <div className="panel"><div className="panel-header"><h2>Try asking</h2></div><div className="suggestion-list">{suggestions.map((suggestion) => <button type="button" onClick={() => setQuestion(suggestion)} key={suggestion}>{suggestion}<span>→</span></button>)}</div></div>
          <div className="panel grounding-card"><div className="panel-header"><h2>Grounding rules</h2></div><ul><li><span>1</span>Uses only server-resolved structured context for player facts.</li><li><span>2</span>Never overrides calculator or market outputs.</li><li><span>3</span>Names missing or stale data instead of guessing.</li><li><span>4</span>Refuses automation, exploits, and guaranteed profit claims.</li></ul></div>
        </aside>
      </section>
    </div>
  );
}
