"use client";

import { useState } from "react";

type AdminSnapshot = {
  cache: { entries: number; hits: number; staleHits: number; misses: number; writes: number; evictions: number };
  hypixelConfigured: boolean;
  aiConfigured: boolean;
  rateLimit: { authenticatedRemaining: number | null; publicRemaining: number | null };
  checkedAt: string;
};

const actions = [
  { key: "refresh-bazaar", title: "Refresh Bazaar", copy: "Run the bounded public Bazaar job now. It still honors shared cache and upstream backoff.", confirm: false },
  { key: "refresh-ended-auctions", title: "Refresh ended auctions", copy: "Run the deduplicated public ended-auction job. Player data is never touched.", confirm: false },
  { key: "clear-economy-cache", title: "Clear economy cache", copy: "Invalidate only economy entries in this runtime. The next permitted request may refill them.", confirm: true },
];

export function AdminExperience({ snapshot }: { snapshot: AdminSnapshot }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  async function runAction(action: typeof actions[number]) {
    if (action.confirm && !window.confirm("Confirm targeted economy-cache invalidation?")) return;
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
    { label: "Hypixel auth", value: snapshot.hypixelConfigured ? "Configured" : "Disabled", note: "Server secret only", tone: snapshot.hypixelConfigured ? "mint" : "amber" },
    { label: "AI assistant", value: snapshot.aiConfigured ? "Configured" : "Optional offline", note: "Responses API", tone: snapshot.aiConfigured ? "violet" : "amber" },
    { label: "Cache entries", value: String(snapshot.cache.entries), note: snapshot.cache.hits + " hits · " + snapshot.cache.misses + " misses", tone: "cyan" },
  ];

  return <>
    <section className="stat-grid admin-stats">{serviceCards.map((card) => <article className="stat-card" key={card.label}><small>{card.label}</small><strong className={card.tone}>{card.value}</strong><span>{card.note}</span></article>)}</section>
    <section className="two-column admin-grid">
      <div className="panel"><div className="panel-header"><div><h2>Provider health</h2><small>No raw payloads or keys</small></div><span className="account-chip"><i /> LIVE RUNTIME</span></div><div className="admin-health-list"><div><span>Authenticated limit remaining</span><strong>{snapshot.rateLimit.authenticatedRemaining ?? "Not reported"}</strong></div><div><span>Public feed limit remaining</span><strong>{snapshot.rateLimit.publicRemaining ?? "Not reported"}</strong></div><div><span>Cache stale hits</span><strong>{snapshot.cache.staleHits}</strong></div><div><span>Cache evictions</span><strong>{snapshot.cache.evictions}</strong></div><div><span>Worker scheduler</span><strong>Externally deployable</strong></div><div><span>Database</span><strong>D1 binding declared</strong></div></div></div>
      <div className="panel"><div className="panel-header"><div><h2>Safe controls</h2><small>Allowlisted administrators only</small></div><span className="lab-symbol">⚙</span></div><div className="admin-action-list">{actions.map((action) => <div key={action.key}><div><strong>{action.title}</strong><small>{action.copy}</small></div><button type="button" disabled={Boolean(busy)} onClick={() => runAction(action)}>{busy === action.key ? "Running…" : "Run"}</button></div>)}</div><div className="admin-message" aria-live="polite">{message}</div></div>
    </section>
  </>;
}
