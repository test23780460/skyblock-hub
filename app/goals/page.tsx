import type { Metadata } from "next";
import { GoalsExperience } from "@/components/GoalsExperience";
import { accountSignInPath, getCurrentUser } from "@/lib/auth/current-user";
import { featureFlags } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Goals", description: "Break SkyBlock goals into practical milestones and sessions.", robots: { index: false, follow: false } };

export default async function GoalsPage() {
  const user = await getCurrentUser();
  return <GoalsExperience authEnabled={featureFlags.accountAuth} signedIn={Boolean(user)} signInHref={accountSignInPath("/goals")} />;
}
