"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/AppLink";
import { normalizeApiFailure } from "@/lib/api-failure";
import { demoPlayerAnalysis } from "@/lib/demo";
import {
  rankMoneyMakingMethods,
  type MoneyMakingAttention,
  type MoneyMakingRisk,
} from "@/lib/engines/money-making";
import type { ApiFailure, PlayerAnalysis } from "@/lib/models";
import {
  availableCoinsFromProfile,
  buildReferenceMoneyMakingMethods,
  moneyMakingFactsFromProfile,
  referenceMoneyMakingDefaults,
  type MoneyMakingMethodOverrides,
  type MoneyMakingProfileFacts,
} from "@/lib/services/money-making";

type LoadState = "idle" | "loading" | "ready" | "error";

const emptyFacts: MoneyMakingProfileFacts = {
  skyBlockLevel: null,
  farmingLevel: null,
  miningLevel: null,
  fishingLevel: null,
  combatLevel: null,
  catacombsLevel: null,
  totalSlayerXp: null,
  marketAccess: null,
};

const factFields: readonly {
  key: Exclude<keyof MoneyMakingProfileFacts, "marketAccess">;
  label: string;
  suffix: string;
}[] = [
  { key: "skyBlockLevel", label: "SkyBlock level", suffix: "level" },
  { key: "farmingLevel", label: "Farming", suffix: "level" },
  { key: "miningLevel", label: "Mining", suffix: "level" },
  { key: "fishingLevel", label: "Fishing", suffix: "level" },
  { key: "combatLevel", label: "Combat", suffix: "level" },
  { key: "catacombsLevel", label: "Catacombs", suffix: "level" },
  { key: "totalSlayerXp", label: "Total Slayer XP", suffix: "XP" },
] as const;

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

function coins(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}${compact.format(Math.abs(value))} coins`;
}

function numericInput(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function MoneyMakingExperience({ username, demo }: { username: string; demo: boolean }) {
  const [loadState, setLoadState] = useState<LoadState>(username || demo ? "loading" : "idle");
  const [analysis, setAnalysis] = useState<PlayerAnalysis | null>(null);
  const [failure, setFailure] = useState<ApiFailure["error"] | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [facts, setFacts] = useState<MoneyMakingProfileFacts>(emptyFacts);
  const [capital, setCapital] = useState(0);
  const [sessionHours, setSessionHours] = useState(2);
  const [riskTolerance, setRiskTolerance] = useState<MoneyMakingRisk>("medium");
  const [maximumDifficulty, setMaximumDifficulty] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [attention, setAttention] = useState<MoneyMakingAttention | "any">("any");
  const [verifiedMethodIds, setVerifiedMethodIds] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<MoneyMakingMethodOverrides>(() => referenceMoneyMakingDefaults());
  const [readyOnly, setReadyOnly] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (demo) {
        if (!active) return;
        const profile = demoPlayerAnalysis.profiles.find((entry) => entry.id === demoPlayerAnalysis.selectedProfileId) ?? demoPlayerAnalysis.profiles[0];
        setAnalysis(demoPlayerAnalysis);
        setSelectedProfileId(demoPlayerAnalysis.selectedProfileId);
        if (profile) {
          setFacts(moneyMakingFactsFromProfile(profile));
          setCapital(availableCoinsFromProfile(profile) ?? 0);
        }
        setLoadState("ready");
        return;
      }
      if (!username) return;
      setLoadState("loading");
      try {
        const response = await fetch(`/api/player?username=${encodeURIComponent(username)}`, {
          headers: { accept: "application/json" },
        });
        const payload = (await response.json()) as { data?: PlayerAnalysis } & Partial<ApiFailure>;
        if (!response.ok || !payload.data) {
          throw payload.error ?? {
            code: "lookup_failed",
            message: "SkyPilot could not load this profile.",
            action: "Check the username or continue with manual inputs.",
          };
        }
        if (!active) return;
        const profile = payload.data.profiles.find((entry) => entry.id === payload.data?.selectedProfileId) ?? payload.data.profiles[0];
        setAnalysis(payload.data);
        setSelectedProfileId(payload.data.selectedProfileId);
        if (profile) {
          setFacts(moneyMakingFactsFromProfile(profile));
          setCapital(availableCoinsFromProfile(profile) ?? 0);
        }
        setLoadState("ready");
      } catch (error) {
        if (!active) return;
        setFailure(normalizeApiFailure(error));
        setLoadState("error");
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [demo, username]);

  const selectedProfile = useMemo(
    () => analysis?.profiles.find((profile) => profile.id === selectedProfileId) ?? analysis?.profiles[0] ?? null,
    [analysis, selectedProfileId],
  );

  const methods = useMemo(
    () => buildReferenceMoneyMakingMethods(facts, new Set(verifiedMethodIds), overrides),
    [facts, overrides, verifiedMethodIds],
  );
  const plan = useMemo(
    () => rankMoneyMakingMethods(methods, {
      availableCapital: capital,
      sessionHours,
      riskTolerance,
      maximumDifficulty,
      preferredAttention: attention === "any" ? undefined : [attention],
    }),
    [attention, capital, maximumDifficulty, methods, riskTolerance, sessionHours],
  );
  const visibleMethods = readyOnly ? plan.readyMethods : plan.rankedMethods;

  function updateFact(key: Exclude<keyof MoneyMakingProfileFacts, "marketAccess">, raw: string) {
    setFacts((current) => ({ ...current, [key]: numericInput(raw) }));
  }

  function updateMethod(id: string, key: "expectedCoinsPerHour" | "setupCost" | "recurringCostPerHour", raw: string) {
    const value = numericInput(raw) ?? 0;
    setOverrides((current) => ({
      ...current,
      [id]: { ...current[id], [key]: value },
    }));
  }

  function toggleVerified(id: string) {
    setVerifiedMethodIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function chooseProfile(profileId: string) {
    setSelectedProfileId(profileId);
    const profile = analysis?.profiles.find((entry) => entry.id === profileId);
    if (!profile) return;
    setFacts(moneyMakingFactsFromProfile(profile));
    setCapital(availableCoinsFromProfile(profile) ?? 0);
    setVerifiedMethodIds([]);
  }

  return (
    <div className="page-shell module-page money-page">
      {analysis?.source === "demo" ? (
        <div className="demo-banner">
          <strong>DEMO PROFILE</strong>
          <span>Profile values and starting method assumptions are illustrative, not live market data.</span>
          <Link href="/money-making">Use manual inputs</Link>
        </div>
      ) : null}

      <header className="page-header module-header">
        <div className="page-title">
          <small>READINESS · RISK · RETURN</small>
          <h1>Money-making flight plan</h1>
          <p>Compare legitimate method scenarios by capital, setup readiness, difficulty, attention, and cautious-to-optimistic output.</p>
        </div>
        <form className="money-player-search" action="/money-making" method="get">
          <label htmlFor="money-player">Minecraft username</label>
          <div>
            <input id="money-player" maxLength={16} name="player" pattern="[A-Za-z0-9_]{1,16}" placeholder="Username" defaultValue={username} />
            <button className="button-primary" type="submit">Load profile</button>
          </div>
          <Link href="/money-making?demo=1">Explore labeled demo</Link>
        </form>
      </header>

      <div className="notice module-note">
        <strong>ASSUMPTIONS</strong>
        <span>Starting rates and costs are editable reference scenarios—not live quotes or guarantees. Confirm a setup before SkyPilot calls it ready.</span>
      </div>

      {loadState === "loading" ? (
        <div className="panel money-load" aria-busy="true" aria-live="polite">Loading the requested profile snapshot…</div>
      ) : null}
      {loadState === "error" && failure ? (
        <div className="notice money-error" role="alert">
          <strong>{failure.code.replaceAll("_", " ")}</strong>
          <span>{failure.message} {failure.action}</span>
        </div>
      ) : null}

      <section className="two-column money-context-grid">
        <div className="panel money-profile-panel">
          <div className="panel-header">
            <div><h2>Readiness inputs</h2><small>{selectedProfile ? `${analysis?.player.username} · ${selectedProfile.name}` : "Manual values · no account required"}</small></div>
            {analysis && selectedProfile ? (
              <label className="money-profile-select"><span className="sr-only">SkyBlock profile</span><select value={selectedProfile.id} onChange={(event) => chooseProfile(event.target.value)}>{analysis.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {profile.gameMode}</option>)}</select></label>
            ) : null}
          </div>
          <div className="money-fact-grid">
            {factFields.map((field) => (
              <label key={field.key}>
                <span>{field.label}<small>{field.suffix}</small></span>
                <input min="0" onChange={(event) => updateFact(field.key, event.target.value)} placeholder="Unknown" step="any" type="number" value={facts[field.key] ?? ""} />
              </label>
            ))}
            <label>
              <span>Market access<small>profile rule</small></span>
              <select value={facts.marketAccess === null ? "unknown" : facts.marketAccess ? "yes" : "no"} onChange={(event) => setFacts((current) => ({ ...current, marketAccess: event.target.value === "unknown" ? null : event.target.value === "yes" }))}>
                <option value="unknown">Unknown</option>
                <option value="yes">Ordinary market access</option>
                <option value="no">Restricted profile</option>
              </select>
            </label>
          </div>
        </div>

        <aside className="panel money-preference-panel">
          <div className="panel-header"><div><h2>Your constraints</h2><small>Used by the deterministic ranker</small></div><span className="lab-symbol" aria-hidden="true">#</span></div>
          <div className="money-preference-fields">
            <label><span>Available capital</span><input min="0" onChange={(event) => setCapital(numericInput(event.target.value) ?? 0)} step="any" type="number" value={capital} /><small>Coins available for setup, not total net worth.</small></label>
            <label><span>Session length</span><input min="0.1" onChange={(event) => setSessionHours(Math.max(0.1, numericInput(event.target.value) ?? 0.1))} step="0.1" type="number" value={sessionHours} /><small>Hours used for the session estimate.</small></label>
            <label><span>Risk tolerance</span><select value={riskTolerance} onChange={(event) => setRiskTolerance(event.target.value as MoneyMakingRisk)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
            <label><span>Maximum difficulty</span><select value={maximumDifficulty} onChange={(event) => setMaximumDifficulty(Number(event.target.value) as 1 | 2 | 3 | 4 | 5)}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label>
            <label><span>Attention preference</span><select value={attention} onChange={(event) => setAttention(event.target.value as MoneyMakingAttention | "any")}><option value="any">Any</option><option value="active">Active</option><option value="semi-active">Semi-active</option><option value="passive">Passive</option></select></label>
          </div>
        </aside>
      </section>

      <section className="panel money-scenario-panel">
        <div className="panel-header">
          <div><h2>Editable method scenarios</h2><small>Verify only setups you can actually perform now</small></div>
          <button className="calculator-reset" onClick={() => { setOverrides(referenceMoneyMakingDefaults()); setVerifiedMethodIds([]); }} type="button">Reset scenarios</button>
        </div>
        <div className="money-scenario-table">
          <div className="money-scenario-head"><span>Method</span><span>Gross / hour</span><span>Setup cost</span><span>Recurring / hour</span><span>Setup evidence</span></div>
          {methods.map((method) => (
            <article className="money-scenario-row" key={method.id}>
              <div><strong>{method.name}</strong><small>{method.category} · risk {method.risk} · difficulty {method.difficulty}/5</small><p>{method.note}</p></div>
              <label><span className="sr-only">{method.name} expected gross coins per hour</span><input min="0" onChange={(event) => updateMethod(method.id, "expectedCoinsPerHour", event.target.value)} step="any" type="number" value={method.expectedCoinsPerHour} /></label>
              <label><span className="sr-only">{method.name} setup cost</span><input min="0" onChange={(event) => updateMethod(method.id, "setupCost", event.target.value)} step="any" type="number" value={method.setupCost} /></label>
              <label><span className="sr-only">{method.name} recurring cost per hour</span><input min="0" onChange={(event) => updateMethod(method.id, "recurringCostPerHour", event.target.value)} step="any" type="number" value={method.recurringCostPerHour ?? 0} /></label>
              <button aria-pressed={verifiedMethodIds.includes(method.id)} className={verifiedMethodIds.includes(method.id) ? "verified" : ""} onClick={() => toggleVerified(method.id)} type="button">{verifiedMethodIds.includes(method.id) ? "Verified" : "Verify setup"}</button>
            </article>
          ))}
        </div>
      </section>

      <section className="money-results-section" aria-live="polite">
        <div className="money-result-heading">
          <div><small>DETERMINISTIC RANKING</small><h2>{plan.bestReadyMethod ? `${plan.bestReadyMethod.name} is the best ready scenario` : "Verify a qualifying setup to get a ready-now pick"}</h2><p>{plan.bestReadyMethod ? `${coins(plan.bestReadyMethod.expectedNetCoinsPerHour)}/hour expected under your edited assumptions.` : "Unknown, missing, unaffordable, or over-difficulty inputs never count as ready."}</p></div>
          <button aria-pressed={readyOnly} className={readyOnly ? "button-primary" : "button-secondary"} onClick={() => setReadyOnly((current) => !current)} type="button">{readyOnly ? "Showing ready only" : "Show ready only"}</button>
        </div>

        {visibleMethods.length ? (
          <div className="money-result-list">
            {visibleMethods.map((method, index) => (
              <article className={`panel money-result-card ${method.eligible ? "ready" : "blocked"}`} key={method.id}>
                <span className="money-rank">{String(index + 1).padStart(2, "0")}</span>
                <div className="money-result-copy">
                  <div className="money-result-labels"><span>{method.category}</span><span>{method.attention}</span><span>risk {method.risk}</span><strong>{method.eligible ? "READY" : "CHECK SETUP"}</strong></div>
                  <h3>{method.name}</h3>
                  <p>{method.explanation}</p>
                  <dl>
                    <div><dt>Cautious net</dt><dd>{coins(method.cautiousNetCoinsPerHour)}/h</dd></div>
                    <div><dt>Expected net</dt><dd>{coins(method.expectedNetCoinsPerHour)}/h</dd></div>
                    <div><dt>Optimistic net</dt><dd>{coins(method.optimisticNetCoinsPerHour)}/h</dd></div>
                    <div><dt>Session estimate</dt><dd>{coins(method.expectedSessionProfit)}</dd></div>
                    <div><dt>Setup readiness</dt><dd>{number.format(method.setupReadinessPercent)}%</dd></div>
                    <div><dt>Rank score</dt><dd>{number.format(method.score)}/100</dd></div>
                  </dl>
                  {method.missingRequirements.length ? <small>Missing: {method.missingRequirements.join(" · ")}</small> : null}
                  {method.unknownRequirements.length ? <small>Unknown: {method.unknownRequirements.join(" · ")}</small> : null}
                  {method.capitalShortfall > 0 ? <small>Capital shortfall: {coins(method.capitalShortfall)}</small> : null}
                </div>
              </article>
            ))}
          </div>
        ) : <div className="empty-state panel"><h2>No verified methods meet these constraints</h2><p>Show all methods, then adjust capital, difficulty, requirements, or setup verification.</p></div>}
      </section>

      <section className="three-column guidance-grid">
        {plan.assumptions.slice(0, 3).map((assumption, index) => <article className="guidance-card panel" key={assumption}><span>{String(index + 1).padStart(2, "0")}</span><h2>{index === 0 ? "Time scope" : index === 1 ? "No live-rate claim" : "Evidence first"}</h2><p>{assumption}</p></article>)}
      </section>
    </div>
  );
}
