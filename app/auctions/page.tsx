import type { Metadata } from "next";
import { AuctionExperience } from "@/components/AuctionExperience";

export const metadata: Metadata = { title: "Auction Intelligence", description: "Browse normalized active Hypixel SkyBlock auctions with safe, bounded payloads." };
export default function AuctionsPage() { return <AuctionExperience />; }
