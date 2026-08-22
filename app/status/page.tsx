import type { Metadata } from "next";
import { featureFlags } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "System Status", description: "SkyPilot service and data-source status." };

export default function StatusPage() {
  const playerConfigured = featureFlags.playerLookup && Boolean(process.env.HYPIXEL_API_KEY);
  const aiConfigured = featureFlags.aiAssistant && Boolean(process.env.OPENAI_API_KEY);
  const services = [
    { name: "Web application", status: "Operational", detail: "This page rendered successfully.", active: true },
    { name: "Player analysis", status: playerConfigured ? "Configured" : featureFlags.playerLookup ? "Credential required" : "Disabled by default", detail: playerConfigured ? "The Worker uses shared KV caching and Cloudflare admission limits; this page does not spend provider quota to probe them." : featureFlags.playerLookup ? "Install the Worker-only Hypixel credential before enabling live lookup." : "Enable only after credentials and deployment-level abuse controls are ready.", active: playerConfigured },
    { name: "Public economy feeds", status: featureFlags.publicEconomy ? "Scheduled snapshot enabled" : "Disabled by default", detail: featureFlags.publicEconomy ? "The elected Worker writes normalized D1 snapshots; each module reports its own freshness." : "Worker scheduling and persisted history are deployment responsibilities.", active: featureFlags.publicEconomy },
    { name: "AI assistant", status: aiConfigured ? "Configured" : featureFlags.aiAssistant ? "Credential required" : "Optional · disabled", detail: aiConfigured ? "Responses integration is configured." : "Every deterministic SkyPilot tool remains available.", active: aiConfigured },
    { name: "Account persistence", status: featureFlags.accountAuth ? "Authentication enabled" : "Disabled by default", detail: featureFlags.accountAuth ? "Storage availability is verified when account data is read or saved." : "The schema is included, but this page does not claim a live database connection.", active: featureFlags.accountAuth },
  ];
  return <div className="page-shell status-page"><header className="page-header"><div className="page-title"><small>TRANSPARENT OPERATIONS</small><h1>SkyPilot status</h1><p>Configuration and health are reported separately so an optional integration cannot make the whole product appear offline.</p></div><span className="account-chip"><i /> WEB OPERATIONAL</span></header><section className="panel status-list"><div className="panel-header"><h2>Services</h2><small>Server-rendered status</small></div>{services.map((service) => <article key={service.name}><span className={service.active ? "service-light active" : "service-light"} /><div><strong>{service.name}</strong><small>{service.detail}</small></div><span className={service.active ? "service-state active" : "service-state"}>{service.status}</span></article>)}</section><div className="notice status-note"><strong>DATA AGE</strong><span>Profile, Bazaar, auction, and valuation surfaces show their own source timestamps. Operational does not mean a market snapshot is current.</span></div></div>;
}
