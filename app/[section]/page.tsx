import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModuleExperience } from "@/components/ModuleExperience";
import { getModuleDefinition } from "@/lib/module-catalog";

type ModulePageProps = { params: Promise<{ section: string }> };

export async function generateMetadata({ params }: ModulePageProps): Promise<Metadata> {
  const { section } = await params;
  const definition = getModuleDefinition(section);
  if (!definition) return { title: "Not found" };
  return { title: definition.title, description: definition.description };
}

export default async function ModulePage({ params }: ModulePageProps) {
  const { section } = await params;
  const definition = getModuleDefinition(section);
  if (!definition) notFound();
  return <ModuleExperience definition={definition} />;
}
