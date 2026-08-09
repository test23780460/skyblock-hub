import type { Metadata } from "next";
import { GoalsExperience } from "@/components/GoalsExperience";
import { chatGPTSignInPath, getChatGPTUser } from "@/app/chatgpt-auth";
import { featureFlags } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Goals", description: "Break SkyBlock goals into practical milestones and sessions.", robots: { index: false, follow: false } };

export default async function GoalsPage() {
  const user = await getChatGPTUser();
  return <GoalsExperience authEnabled={featureFlags.chatGptAuth} signedIn={Boolean(user)} signInHref={chatGPTSignInPath("/goals")} />;
}
