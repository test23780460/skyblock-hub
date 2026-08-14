import type { Metadata } from "next";
import { chatGPTSignInPath, getChatGPTUser } from "@/app/chatgpt-auth";
import { DashboardExperience } from "@/components/DashboardExperience";
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
  const user = await getChatGPTUser();
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
    accountSavingEnabled={featureFlags.chatGptAuth}
    signedIn={Boolean(user)}
    signInHref={chatGPTSignInPath(returnTo)}
    browserCapability={featureFlags.browserPlayerGateway}
  />;
}
