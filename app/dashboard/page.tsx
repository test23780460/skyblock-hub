import type { Metadata } from "next";
import { DashboardExperience } from "@/components/DashboardExperience";

export const metadata: Metadata = {
  title: "Player Dashboard",
  description: "Request-driven SkyBlock profile analysis and prioritized next moves.",
  robots: { index: false, follow: false },
};

type DashboardPageProps = {
  searchParams: Promise<{ player?: string; demo?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const username = (params.player || "").trim();
  const demo = params.demo === "1";
  return <DashboardExperience key={demo ? "demo" : username || "empty"} username={username} demo={demo} />;
}
