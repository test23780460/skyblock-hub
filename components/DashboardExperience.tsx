"use client";

import Link from "@/components/AppLink";
import { useEffect, useMemo, useState } from "react";
import { normalizeApiFailure } from "@/lib/api-failure";
import { demoPlayerAnalysis } from "@/lib/demo";
import type { ApiFailure, PlayerAnalysis, ProfileStat, Recommendation } from "@/lib/models";
import { analyzeProfileRecommendations } from "@/lib/services";

const analysisSteps = [
  "Resolving Minecraft identity",
  "Fetching available profiles",
  "Analyzing progression and gear",
  "Checking value opportunities",
  "Preparing your next moves",
];

const budgets = [1_000_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000, 500_000_000, 1_000_000_000];

type RecommendationState = "complete" | "ignored" | "later";

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: value >= 1_000_000_000 ? 2 : 1 }).format(value);
}

function formatStat(stat: ProfileStat): string {
  if (stat.value === null) return "Unavailable";
  if (stat.unit === "coins") return formatCompact(stat.value);
  if (stat.unit === "percent") return stat.value.toLocaleString("en-US", { maximumFractionDigits: 1 }) + "%";
  if (stat.unit === "xp") return formatCompact(stat.value);
  return stat.value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function formatCoins(value: number | null): string {
  return value === null ? "Market dependent" : "~" + formatCompact(value) + " coins";
}

function priorityLabel(priority: Recommendation["priority"]): string {
  return priority.replace("-", " ").toUpperCase();
}

export function DashboardExperience({ username, demo }: { username: string; demo: boolean }) {
  const [analysis, setAnalysis] = useState<PlayerAnalysis | null>(null);
  const [failure, setFailure] = useState<ApiFailure["error"] | null>(null);
  const [step, setStep] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [budget, setBudget] = useState(50_000_000);
  const [actions, setActions] = useState<Record<string, RecommendationState>>({});

  useEffect(() => {
    let active = true;
    const timers: ReturnType<typeof setTimeout>[] = [];

    analysisSteps.slice(1).forEach((_, index) => {
      timers.push(setTimeout(() => active && setStep(index + 1), 430 * (index + 1)));
    });

    async function load() {
      if (demo) {
        await new Promise((resolve) => setTimeout(resolve, 1750));
        if (active) {
          setAnalysis(demoPlayerAnalysis);
          setSelectedId(demoPlayerAnalysis.selectedProfileId);
        }
        return;
      }

      if (!username) return;
      try {
        const response = await fetch("/api/player?username=" + encodeURIComponent(username), { headers: { accept: "application/json" } });
        const payload = (await response.json()) as { data?: PlayerAnalysis } & Partial<ApiFailure>;
        if (!response.ok || !payload.data) {
          throw payload.error || { code: "lookup_failed", message: "SkyPilot could not analyze this profile right now.", action: "Try again shortly or explore the labeled demo." };
        }
        const delay = new Promise((resolve) => setTimeout(resolve, 1750));
        await delay;
        if (active) {
          setAnalysis(payload.data);
          setSelectedId(payload.data.selectedProfileId);
        }
      } catch (error) {
        if (!active) return;
        setFailure(normalizeApiFailure(error));
      }
    }

    void load();
    return () => {
      active = false;
      timers.forEach(clearTimeout);
    };
  }, [username, demo]);

  const profile = useMemo(() => analysis?.profiles.find((item) => item.id === selectedId) || analysis?.profiles[0], [analysis, selectedId]);
  const recommendationAnalysis = useMemo(
    () => profile ? analyzeProfileRecommendations({
      ...profile,
      recommendations: profile.recommendations.filter((item) => !actions[item.id]),
    }, { budget }) : null,
    [profile, budget, actions],
  );
  const visibleRecommendations = useMemo(() => {
    if (!profile || !recommendationAnalysis?.budgetPlan) return [];
    const sourceById = new Map(profile.recommendations.map((item) => [item.id, item]));
    return recommendationAnalysis.budgetPlan.recommendations
      .map((item) => sourceById.get(item.id))
      .filter((item): item is Recommendation => item !== undefined)
      .filter((item) => !actions[item.id]);
  }, [profile, recommendationAnalysis, actions]);
  const unpricedRecommendationCount = recommendationAnalysis?.deferredRecommendations.filter(
    (item) => item.reason === "missing-cost" && !actions[item.recommendation.id],
  ).length || 0;

  if (!username && !demo) {
    return (
      <div className="page-shell dashboard-empty">
        <div className="empty-state panel">
          <span className="empty-icon" aria-hidden="true">⌕</span>
          <h1>Analyze a SkyBlock profile</h1>
          <p>Enter a Minecraft username to fetch available profiles on demand. No account is required, and SkyPilot will not monitor the player in the background.</p>
          <form className="inline-player-form" action="/dashboard" method="get">
            <label className="sr-only" htmlFor="dashboard-player">Minecraft username</label>
            <input className="control" id="dashboard-player" name="player" placeholder="Minecraft username" maxLength={16} pattern="[A-Za-z0-9_]{1,16}" required />
            <button className="button-primary" type="submit">Analyze profile</button>
          </form>
          <Link className="subtle-link" href="/dashboard?demo=1">Or explore a labeled demo</Link>
        </div>
      </div>
    );
  }

  if (failure) {
    return (
      <div className="page-shell">
        <div className="error-state panel" role="alert">
          <span className="error-code">{failure.code.replaceAll("_", " ")}</span>
          <h1>{failure.message}</h1>
          <p>{failure.action || "Try again shortly."}</p>
          <div className="toolbar"><Link className="button-primary" href="/">Search another player</Link><Link className="button-secondary" href="/dashboard?demo=1">Explore the demo</Link></div>
        </div>
      </div>
    );
  }

  if (!analysis || !profile) {
    return (
      <div className="analysis-reveal" aria-live="polite" aria-busy="true">
        <div className="scan-orbit" aria-hidden="true"><i /><i /><span>⌁</span></div>
        <small>SKYPILOT PROFILE ENGINE</small>
        <h1>Building your flight plan</h1>
        <p>{demo ? "Loading a clearly labeled example profile" : "Analyzing " + username}</p>
        <ol>
          {analysisSteps.map((label, index) => <li className={index < step ? "done" : index === step ? "active" : ""} key={label}><span>{index < step ? "✓" : index + 1}</span>{label}</li>)}
        </ol>
      </div>
    );
  }

  const headlineStats = profile.stats.slice(0, 8);
  const avatarStyle = analysis.player.avatarUrl ? { backgroundImage: "url(" + analysis.player.avatarUrl + ")" } : undefined;

  return (
    <div className="page-shell dashboard-page">
      {analysis.source === "demo" ? <div className="demo-banner"><strong>DEMO PROFILE</strong><span>Every value on this page is illustrative, not live Hypixel data.</span><Link href="/">Search a real player</Link></div> : null}

      <header className="dashboard-head">
        <div className="player-identity">
          <span className="dashboard-avatar" style={avatarStyle} aria-hidden="true">{analysis.player.avatarUrl ? null : analysis.player.username.slice(0, 1).toUpperCase()}</span>
          <div><small>PLAYER ANALYSIS</small><h1>{analysis.player.username}</h1><span>Fetched {new Date(analysis.fetchedAt).toLocaleString()} · {analysis.cacheStatus}</span></div>
        </div>
        <div className="dashboard-controls">
          <label htmlFor="profile-select">SkyBlock profile</label>
          <select id="profile-select" value={profile.id} onChange={(event) => setSelectedId(event.target.value)}>
            {analysis.profiles.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.gameMode}</option>)}
          </select>
          <Link className="button-secondary" href={"/dashboard?player=" + encodeURIComponent(analysis.player.username)}>Recalculate</Link>
        </div>
      </header>

      <section className="stat-grid" aria-label="Profile summary">
        {headlineStats.map((stat) => <article className="stat-card" key={stat.key}><small>{stat.label}</small><strong>{formatStat(stat)}</strong><span>{stat.note || (stat.value === null ? "Data not exposed" : "Current snapshot")}</span></article>)}
      </section>

      <section className="two-column dashboard-main-grid">
        <div className="panel recommendation-panel">
          <div className="panel-header recommendation-header">
            <div><small>WHAT SHOULD I DO NEXT?</small><h2>Best moves within {formatCompact(budget)}</h2></div>
            <span>{visibleRecommendations.length} reachable</span>
          </div>
          <div className="budget-control">
            <div className="budget-pills" role="group" aria-label="Upgrade budget">
              {budgets.map((value) => <button aria-pressed={budget === value} className={budget === value ? "active" : ""} type="button" key={value} onClick={() => setBudget(value)}>{formatCompact(value)}</button>)}
            </div>
            {unpricedRecommendationCount ? <small>{unpricedRecommendationCount} market-dependent recommendation{unpricedRecommendationCount === 1 ? "" : "s"} excluded until a current price is available.</small> : null}
          </div>
          <div className="recommendation-list">
            {visibleRecommendations.length ? visibleRecommendations.map((item, index) => (
              <article className="recommendation" key={item.id}>
                <div className="recommendation-rank">{String(index + 1).padStart(2, "0")}</div>
                <div className="recommendation-copy">
                  <div className="recommendation-labels"><span className={"priority " + item.priority}>{priorityLabel(item.priority)}</span><span className="smart-badge">{item.badge}</span><span>{item.category}</span></div>
                  <h3>{item.title}</h3>
                  <p>{item.reason}</p>
                  <dl><div><dt>Cost</dt><dd>{formatCoins(item.estimatedCost)}</dd></div><div><dt>Benefit</dt><dd>{item.estimatedBenefit}</dd></div><div><dt>Prerequisite</dt><dd>{item.prerequisites.join(", ") || "None"}</dd></div></dl>
                  <div className="recommendation-actions">
                    <Link href={item.href}>Open tool →</Link>
                    <button type="button" onClick={() => setActions((current) => ({ ...current, [item.id]: "complete" }))}>Mark complete</button>
                    <button type="button" onClick={() => setActions((current) => ({ ...current, [item.id]: "later" }))}>Remind later</button>
                    <button type="button" onClick={() => setActions((current) => ({ ...current, [item.id]: "ignored" }))}>Ignore</button>
                  </div>
                </div>
              </article>
            )) : <div className="empty-state compact-empty"><span className="empty-icon" aria-hidden="true">✓</span><h2>No remaining upgrades fit this budget</h2><p>{recommendationAnalysis?.planningStage ? "Increase the budget or recalculate after completing your current moves." : "A progression metric is required before SkyPilot can rank a budget plan."}</p></div>}
          </div>
        </div>

        <aside className="dashboard-side-stack">
          <div className="panel"><div className="panel-header"><h2>Profile signal</h2><span className="unofficial-label">SKYPILOT ANALYSIS</span></div><div className="signal-card"><div className="signal-gauge"><strong>{recommendationAnalysis?.progression?.score ?? "—"}</strong><small>{recommendationAnalysis?.progression ? "out of 100" : "unavailable"}</small></div><p>{recommendationAnalysis?.progression?.disclaimer || "No normalized progression metrics were available, so SkyPilot did not invent a score."}</p>{recommendationAnalysis?.progression && !recommendationAnalysis.progression.complete ? <small>{recommendationAnalysis.progression.coverage}% weighted metric coverage · {recommendationAnalysis.progression.stage} estimate</small> : null}</div></div>
          <div className="panel"><div className="panel-header"><h2>Strengths</h2></div><ul className="insight-list positive">{profile.strengths.map((value) => <li key={value}><span>↗</span>{value}</li>)}</ul></div>
          <div className="panel"><div className="panel-header"><h2>Watch list</h2></div><ul className="insight-list caution">{profile.weaknesses.map((value) => <li key={value}><span>!</span>{value}</li>)}</ul></div>
        </aside>
      </section>

      <section className="two-column">
        <div className="panel">
          <div className="panel-header"><div><h2>Skill progression</h2><small>Available profile values</small></div><Link href="/skills">Full skill analysis →</Link></div>
          <div className="skill-list">
            {profile.skills.length ? profile.skills.map((skill) => { const progress = skill.progress === null ? null : Math.max(0, Math.min(100, skill.progress)); return <div className="skill-row" key={skill.key}><span>{skill.label}</span><strong>{skill.level?.toFixed(1) || "—"}</strong><div className="progress-track" role={progress === null ? undefined : "progressbar"} aria-label={progress === null ? undefined : skill.label + " level progress"} aria-valuemin={progress === null ? undefined : 0} aria-valuemax={progress === null ? undefined : 100} aria-valuenow={progress === null ? undefined : progress}><i style={{ width: (progress || 0) + "%" }} /></div><small>{progress === null ? "Unavailable" : Math.round(progress) + "%"}</small></div>; }) : <div className="empty-inline">Skill values were not exposed for this profile.</div>}
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><div><h2>Gear diagnostics</h2><small>Existing setup</small></div><Link href="/gear">Inspect gear →</Link></div>
          <div className="gear-list">
            {profile.gear.length ? profile.gear.map((gear) => <div className="gear-row" key={gear.slot}><span className={"gear-gem " + gear.status} aria-hidden="true">◇</span><div><small>{gear.slot} · {gear.rarity}</small><strong>{gear.name}</strong><p>{gear.note}</p></div><span className={"gear-status " + gear.status}>{gear.status}</span></div>) : <div className="empty-inline">Inventory API data is unavailable or disabled.</div>}
          </div>
        </div>
      </section>

      <section className="profile-notices">
        {analysis.notices.map((notice) => <div className="notice" key={notice}><strong>i</strong><span>{notice}</span></div>)}
        {profile.unavailable.map((notice) => <div className="notice subdued" key={notice}><strong>—</strong><span>{notice}</span></div>)}
      </section>
    </div>
  );
}
