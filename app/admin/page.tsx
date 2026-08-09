import type { Metadata } from "next";
import Link from "@/components/AppLink";
import { getChatGPTUser, chatGPTSignInPath } from "@/app/chatgpt-auth";
import { AdminExperience } from "@/components/AdminExperience";
import { isAdminUser } from "@/lib/auth/admin";
import { sharedProviderCache } from "@/lib/cache/ttl-cache";
import { featureFlags } from "@/lib/config";
import { hypixelProvider } from "@/lib/providers/hypixel";
import { hypixelRateLimits } from "@/lib/providers/rate-limit";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminPage() {
  if (!featureFlags.chatGptAuth) return <AdminGate title="Admin authentication is disabled" copy="Enable and verify the platform authentication boundary before exposing operations." href="/status" action="View status" />;
  const user = await getChatGPTUser();
  if (!user) return <AdminGate title="Sign in to open operations" copy="The SkyPilot admin surface is protected by server-side identity and an explicit user allowlist." href={chatGPTSignInPath("/admin")} action="Sign in with ChatGPT" />;
  if (!isAdminUser(user)) return <AdminGate title="Admin access is not enabled" copy="Your identity is valid, but it is not present in the server-side administrator allowlist." href="/" action="Return home" />;

  const limits = hypixelRateLimits.snapshot();
  return <div className="page-shell admin-page"><header className="page-header"><div className="page-title"><small>ALLOWLISTED OPERATIONS</small><h1>SkyPilot control room</h1><p>System, provider, cache, worker, database, and AI visibility with targeted, confirmed controls.</p></div><span className="account-chip"><i /> ADMIN VERIFIED</span></header><AdminExperience snapshot={{ cache: sharedProviderCache.stats(), hypixelConfigured: hypixelProvider.isConfigured(), aiConfigured: Boolean(process.env.OPENAI_API_KEY), rateLimit: { authenticatedRemaining: limits.authenticated.remaining, publicRemaining: limits.public.remaining }, checkedAt: new Date().toISOString() }} /></div>;
}

function AdminGate({ title, copy, href, action }: { title: string; copy: string; href: string; action: string }) {
  return <div className="page-shell"><div className="empty-state panel admin-gate"><span className="empty-icon">⚙</span><h1>{title}</h1><p>{copy}</p><Link className="button-primary" href={href}>{action}</Link></div></div>;
}
