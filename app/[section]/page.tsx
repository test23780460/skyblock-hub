import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccessoryOptimizerExperience } from "@/components/AccessoryOptimizerExperience";
import { CalculatorHubExperience } from "@/components/CalculatorHubExperience";
import { GardenOptimizerExperience } from "@/components/GardenOptimizerExperience";
import { EconomyCommandExperience } from "@/components/EconomyCommandExperience";
import { MoneyMakingExperience } from "@/components/MoneyMakingExperience";
import { SkillsPlannerExperience } from "@/components/SkillsPlannerExperience";
import { ModuleExperience } from "@/components/ModuleExperience";
import { getModuleDefinition } from "@/lib/module-catalog";

type ModulePageProps = {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ player?: string; demo?: string }>;
};

export async function generateMetadata({ params }: ModulePageProps): Promise<Metadata> {
  const { section } = await params;
  const definition = getModuleDefinition(section);
  if (!definition) return { title: "Not found" };
  return { title: definition.title, description: definition.description };
}

export default async function ModulePage({ params, searchParams }: ModulePageProps) {
  const { section } = await params;
  const definition = getModuleDefinition(section);
  if (!definition) notFound();
  if (section === "accessories") return <AccessoryOptimizerExperience />;
  if (section === "calculators") return <CalculatorHubExperience />;
  if (section === "dungeons") return <CalculatorHubExperience focus="dungeon" />;
  if (section === "economy") return <EconomyCommandExperience />;
  if (section === "garden") return <GardenOptimizerExperience />;
  if (section === "minions") return <CalculatorHubExperience focus="minion" />;
  if (section === "money-making") {
    const query = await searchParams;
    return <MoneyMakingExperience demo={query.demo === "1"} username={(query.player || "").trim()} />;
  }
  if (section === "slayers") return <CalculatorHubExperience focus="slayer" />;
  if (section === "skills") return <SkillsPlannerExperience />;
  return <ModuleExperience definition={definition} />;
}
