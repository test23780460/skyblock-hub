import type { Metadata } from "next";
import { DashboardExperience } from "@/components/DashboardExperience";
import { accountSignInPath, getCurrentUser } from "@/lib/auth/current-user";
import { featureFlags } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Player Dashboard",
  description: "Request-driven SkyBlock profile analysis and prioritized next moves.",
  robots: { index: false, follow: false },
};

type DashboardPageProps = {
  searchParams: Promise<{ player?: string; profile?: string; demo?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const username = (params.player || "").trim();
  const requestedProfileId = (params.profile || "").trim();
  const demo = params.demo === "1";
  const user = await getCurrentUser();
  const returnTo = demo
    ? "/dashboard?demo=1"
    : username
      ? `/dashboard?player=${encodeURIComponent(username)}${requestedProfileId ? `&profile=${encodeURIComponent(requestedProfileId)}` : ""}`
      : "/dashboard";
  return <DashboardExperience
    key={demo ? "demo" : username || "empty"}
    username={username}
    requestedProfileId={requestedProfileId}
    demo={demo}
    accountSavingEnabled={featureFlags.accountAuth}
    signedIn={Boolean(user)}
    signInHref={accountSignInPath(returnTo)}
    browserCapability={featureFlags.browserPlayerGateway}
  />;
}
