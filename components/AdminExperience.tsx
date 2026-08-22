"use client";

import { useEffect, useState } from "react";
import type { AiAdminMetricsSnapshot } from "@/lib/ai/admin-metrics";

type AdminSnapshot = {
  playerTransportConfigured: boolean;
  playerCacheConfigured: boolean;
  playerAdmissionConfigured: boolean;
  databaseConfigured: boolean;
  economyEnabled: boolean;
  aiConfigured: boolean;
  checkedAt: string;
};

const actions = [
  { key: "refresh-economy", title: "Request economy cycle", copy: "Ask the durable elected worker to refresh ended sales, Bazaar, and active auctions. Existing leases and global backoff remain authoritative." },
];

export function AdminExperience({ snapshot }: { snapshot: AdminSnapshot }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [aiMetrics, setAiMetrics] = useState<AiAdminMetricsSnapshot | null>(null);
  const [aiMetricsStatus, setAiMetricsStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/admin/ai-metrics", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { data?: AiAdminMetricsSnapshot };
        if (!response.ok || !payload.data) throw new Error("metrics unavailable");
        setAiMetrics(payload.data);
        setAiMetricsStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setAiMetricsStatus("unavailable");
      });
    return () => controller.abort();
  }, []);

  async function runAction(action: typeof actions[number]) {
    setBusy(action.key);
    setMessage("");
    try {
      const response = await fetch("/api/admin/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: action.key }) });
      const payload = await response.json() as { data?: { message?: string }; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "The admin action failed.");
      setMessage(payload.data?.message || "Action completed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The admin action failed.");
    } finally {
      setBusy("");
    }
  }

  const serviceCards = [
    { label: "Web runtime", value: "Operational", note: "Checked " + new Date(snapshot.checkedAt).toLocaleTimeString(), tone: "mint" },
    { label: "Player transport", value: snapshot.playerTransportConfigured ? "Configured" : "Disabled", note: "Worker-only credential boundary", tone: snapshot.playerTransportConfigured ? "mint" : "amber" },
    { label: "AI assistant", value: snapshot.aiConfigured ? "Configured" : "Optional offline", note: "Responses API", tone: snapshot.aiConfigured ? "violet" : "amber" },
    { label: "Player cache", value: snapshot.playerCacheConfigured ? "Workers KV" : "Unavailable", note: "Shared latest snapshots", tone: snapshot.playerCacheConfigured ? "cyan" : "amber" },
  ];

  return <>
    <section className="stat-grid admin-stats">{serviceCards.map((card) => <article className="stat-card" key={card.label}><small>{card.label}</small><strong className={card.tone}>{card.value}</strong><span>{card.note}</span></article>)}</section>
    <section className="two-column admin-grid">
      <div className="panel"><div className="panel-header"><div><h2>Provider health</h2><small>No raw payloads or keys</small></div><span className="account-chip"><i /> LIVE RUNTIME</span></div><div className="admin-health-list"><div><span>Player admission</span><strong>{snapshot.playerAdmissionConfigured ? "Cloudflare rate bindings" : "Unavailable"}</strong></div><div><span>Player cache</span><strong>{snapshot.playerCacheConfigured ? "Workers KV" : "Unavailable"}</strong></div><div><span>Economy scheduler</span><strong>{snapshot.economyEnabled ? "Enabled" : "Disabled"}</strong></div><div><span>Database</span><strong>{snapshot.databaseConfigured ? "D1 bound" : "Unavailable"}</strong></div></div></div>
      <div className="panel"><div className="panel-header"><div><h2>Safe controls</h2><small>Allowlisted administrators only</small></div><span className="lab-symbol">⚙</span></div><div className="admin-action-list">{actions.map((action) => <div key={action.key}><div><strong>{action.title}</strong><small>{action.copy}</small></div><button type="button" disabled={Boolean(busy)} onClick={() => runAction(action)}>{busy === action.key ? "Running…" : "Run"}</button></div>)}</div><div className="admin-message" aria-live="polite">{message}</div></div>
    </section>
    <section className="panel"><div className="panel-header"><div><h2>AI aggregate metrics</h2><small>Counts, tokens, configured cost estimate, latency, and categories only — no prompts or answers</small></div><span className="account-chip">AGGREGATE ONLY</span></div>
      {aiMetricsStatus === "loading" ? <div className="admin-message" role="status">Loading aggregate AI metrics…</div> : aiMetricsStatus === "unavailable" || !aiMetrics ? <div className="notice" role="alert"><strong>!</strong><span>Aggregate AI metrics are unavailable. No prompt content is used as a fallback.</span></div> : <>
        <div className="stat-grid admin-stats"><article className="stat-card"><small>Requests · 24 hours</small><strong>{aiMetrics.last24Hours.requestCount.toLocaleString()}</strong><span>{aiMetrics.last24Hours.failureRatePercent}% failures</span></article><article className="stat-card"><small>Tokens · 24 hours</small><strong>{(aiMetrics.last24Hours.inputTokens + aiMetrics.last24Hours.outputTokens).toLocaleString()}</strong><span>{aiMetrics.last24Hours.inputTokens.toLocaleString()} in · {aiMetrics.last24Hours.outputTokens.toLocaleString()} out</span></article><article className="stat-card"><small>Configured estimate · 30 days</small><strong>${aiMetrics.last30Days.estimatedCostUsd.toFixed(4)}</strong><span>Zero until per-model rates are configured</span></article><article className="stat-card"><small>Average latency · 24 hours</small><strong>{aiMetrics.last24Hours.averageLatencyMs.toLocaleString()} ms</strong><span>Maximum {aiMetrics.last24Hours.maximumLatencyMs.toLocaleString()} ms</span></article></div>
        <div className="admin-health-list"><div><span>Popular categories · 30 days</span><strong>{aiMetrics.last30Days.categories.length ? aiMetrics.last30Days.categories.slice(0, 5).map((category) => `${category.category} (${category.requestCount})`).join(" · ") : "No requests recorded"}</strong></div><div><span>Privacy mode</span><strong>No prompts, answers, player IDs, users, or IPs stored</strong></div></div>
      </>}
    </section>
  </>;
}
