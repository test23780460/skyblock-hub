import type { Metadata } from "next";
import { accountSignInPath, getCurrentUser } from "@/lib/auth/current-user";
import { BuildsExperience } from "@/components/BuildsExperience";
import { featureFlags } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Build planner",
  description: "Compose SkyBlock loadouts locally, then optionally save and share them with explicit privacy controls.",
};

export default async function BuildsPage() {
  const user = await getCurrentUser();
  return <BuildsExperience
    authEnabled={featureFlags.accountAuth}
    signedIn={Boolean(user)}
    signInHref={accountSignInPath("/builds")}
  />;
}
