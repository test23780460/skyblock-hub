import type { Metadata } from "next";
import { BazaarExperience } from "@/components/BazaarExperience";

export const metadata: Metadata = { title: "Bazaar Explorer", description: "Search current Hypixel Bazaar summary prices and model liquidity-aware opportunities." };
export default function BazaarPage() { return <BazaarExperience />; }
