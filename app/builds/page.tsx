import type { Metadata } from "next";
import { chatGPTSignInPath, getChatGPTUser } from "@/app/chatgpt-auth";
import { BuildsExperience } from "@/components/BuildsExperience";
import { featureFlags } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Build planner",
  description: "Compose SkyBlock loadouts locally, then optionally save and share them with explicit privacy controls.",
};

export default async function BuildsPage() {
  const user = await getChatGPTUser();
  return <BuildsExperience
    authEnabled={featureFlags.chatGptAuth}
    signedIn={Boolean(user)}
    signInHref={chatGPTSignInPath("/builds")}
  />;
}
