import type { Metadata } from "next";
import Link from "@/components/AppLink";
import { AdminExperience } from "@/components/AdminExperience";
import { isAdminUser } from "@/lib/auth/admin";
import { accountSignInPath, getCurrentUser } from "@/lib/auth/current-user";
import { featureFlags } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminPage() {
  if (!featureFlags.accountAuth) return <AdminGate title="Admin authentication is disabled" copy="Enable and verify the platform authentication boundary before exposing operations." href="/status" action="View status" />;
  const user = await getCurrentUser();
  if (!user) return <AdminGate title="Sign in to open operations" copy="The SkyPilot admin surface is protected by verified Cloudflare Access identity and an explicit user allowlist." href={accountSignInPath("/admin")} action="Sign in" />;
  if (!isAdminUser(user)) return <AdminGate title="Admin access is not enabled" copy="Your identity is valid, but it is not present in the server-side administrator allowlist." href="/" action="Return home" />;

  const { env } = await import("cloudflare:workers");
  return <div className="page-shell admin-page"><header className="page-header"><div className="page-title"><small>ALLOWLISTED OPERATIONS</small><h1>SkyPilot control room</h1><p>System, provider, cache, worker, database, and AI visibility with targeted, confirmed controls.</p></div><span className="account-chip"><i /> ADMIN VERIFIED</span></header><AdminExperience snapshot={{ playerTransportConfigured: Boolean(env.HYPIXEL_API_KEY?.trim() && env.PLAYER_CACHE && env.PLAYER_ACTOR_LIMITER && env.PLAYER_GLOBAL_LIMITER && env.PROVIDER_BUDGET_DB), playerCacheConfigured: Boolean(env.PLAYER_CACHE), playerAdmissionConfigured: Boolean(env.PLAYER_ACTOR_LIMITER && env.PLAYER_GLOBAL_LIMITER && env.PROVIDER_BUDGET_DB), databaseConfigured: Boolean(env.DB), economyEnabled: featureFlags.publicEconomy, aiConfigured: Boolean(process.env.OPENAI_API_KEY), checkedAt: new Date().toISOString() }} /></div>;
}

function AdminGate({ title, copy, href, action }: { title: string; copy: string; href: string; action: string }) {
  return <div className="page-shell"><div className="empty-state panel admin-gate"><span className="empty-icon">⚙</span><h1>{title}</h1><p>{copy}</p><Link className="button-primary" href={href}>{action}</Link></div></div>;
}
