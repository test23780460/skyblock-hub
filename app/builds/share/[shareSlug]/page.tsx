import type { Metadata } from "next";
import { SharedBuildExperience } from "@/components/SharedBuildExperience";
import { featureFlags } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Shared build",
  robots: { index: false, follow: false },
};

type SharedBuildPageProps = { params: Promise<{ shareSlug: string }> };

export default async function SharedBuildPage({ params }: SharedBuildPageProps) {
  const { shareSlug } = await params;
  return <SharedBuildExperience shareSlug={shareSlug} enabled={featureFlags.accountAuth} />;
}
