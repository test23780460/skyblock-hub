import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy", description: "How SkyPilot handles account, profile, and analytics data." };

const sections = [
  ["Request-driven player data", "When player lookup is enabled, SkyPilot fetches player and profile data only after an explicit user request. Goals, sign-in, and public pages do not schedule background player refreshes."],
  ["Latest snapshot, not tracking", "Shared caches keep a current or bounded stale snapshot. SkyPilot does not build automated stat timelines, session tracking, player dossiers, or mass-monitoring systems."],
  ["Optional accounts", "Enabled public tools work anonymously. When account sync is enabled, signed-in data uses a canonical SkyPilot user ID so authentication providers can be replaced without rewriting ownership records."],
  ["Economy data", "Bazaar and auction information comes from public resource feeds handled separately from player lookups. Longer-term records are transformed aggregates or minimal sale observations—not raw API dumps."],
  ["AI and logs", "AI is optional. SkyPilot avoids unnecessary prompt storage, sends only bounded structured context, and never logs API keys, raw inventory payloads, full profiles, or authentication headers."],
  ["Analytics and control", "If product analytics are activated, they should be limited to useful events such as page and tool use. Account sync is disabled unless a deployment enables it, and an in-product account-deletion workflow is not currently offered."],
];

export default function PrivacyPage() {
  return <div className="page-shell prose-page"><header className="page-header"><div className="page-title"><small>PRIVACY BY PRODUCT DESIGN</small><h1>Clear boundaries, useful data</h1><p>SkyPilot collects only what supports the feature you chose and keeps player data separate from public economy research.</p></div></header><section className="prose-grid">{sections.map(([title, copy], index) => <article className="panel" key={title}><span>{String(index + 1).padStart(2, "0")}</span><h2>{title}</h2><p>{copy}</p></article>)}</section></div>;
}
