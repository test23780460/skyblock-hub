import type { Metadata } from "next";
import { AiExperience } from "@/components/AiExperience";
import { featureFlags } from "@/lib/config";

export const metadata: Metadata = { title: "AI Assistant", description: "Profile-aware SkyBlock explanations grounded in deterministic SkyPilot data.", robots: { index: false, follow: false } };

export default async function AiPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const params = await searchParams;
  return <AiExperience demo={params.demo === "1"} enabled={featureFlags.aiAssistant} playerContextEnabled={featureFlags.playerLookup} economyContextEnabled={featureFlags.publicEconomy} />;
}
