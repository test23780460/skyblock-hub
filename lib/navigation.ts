export type NavigationItem = {
  label: string;
  href: string;
  icon: string;
  description: string;
  badge?: string;
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

export const primaryNavigation: NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "⌁", description: "Player overview and next moves" },
  { label: "Progression", href: "/progression", icon: "↗", description: "Prioritized upgrade paths" },
  { label: "Gear", href: "/gear", icon: "◇", description: "Armor, weapons, tools, and pets" },
  { label: "Accessories", href: "/accessories", icon: "✦", description: "Magical Power optimizer" },
  { label: "Economy", href: "/economy", icon: "◫", description: "Market intelligence" },
  { label: "Goals", href: "/goals", icon: "◎", description: "Plan and track milestones" },
];

export const navigationGroups: NavigationGroup[] = [
  {
    label: "Markets",
    items: [
      { label: "Bazaar", href: "/bazaar", icon: "⇄", description: "Prices, history, and flips" },
      { label: "Auctions", href: "/auctions", icon: "⌂", description: "Auction search and valuation" },
      { label: "Money Making", href: "/money-making", icon: "◆", description: "Risk-adjusted opportunities" },
      { label: "Items", href: "/items", icon: "▦", description: "Item browser and valuation" },
    ],
  },
  {
    label: "Skills",
    items: [
      { label: "Skills", href: "/skills", icon: "△", description: "All skill progression" },
      { label: "Garden", href: "/garden", icon: "❋", description: "Garden and farming optimizer" },
      { label: "Mining", href: "/mining", icon: "◈", description: "HOTM, powder, and gear" },
      { label: "Foraging", href: "/foraging", icon: "♧", description: "Routes and upgrades" },
      { label: "Fishing", href: "/fishing", icon: "≈", description: "Sea creatures and gear" },
      { label: "Dungeons", href: "/dungeons", icon: "⬡", description: "Class and floor analysis" },
      { label: "Slayers", href: "/slayers", icon: "✕", description: "Boss progression and costs" },
    ],
  },
  {
    label: "Completion",
    items: [
      { label: "Minions", href: "/minions", icon: "▣", description: "Slots and profit planning" },
      { label: "Museum", href: "/museum", icon: "▤", description: "Donation value paths" },
      { label: "Collections", href: "/collections", icon: "▥", description: "Unlock tracking" },
      { label: "Bestiary", href: "/bestiary", icon: "☷", description: "Milestone tracking" },
      { label: "Rift", href: "/rift", icon: "◌", description: "Rift progression" },
    ],
  },
  {
    label: "Tools",
    items: [
      { label: "Calculators", href: "/calculators", icon: "#", description: "XP, profit, and upgrade math" },
      { label: "Builds", href: "/builds", icon: "+", description: "Save and share loadout plans" },
      { label: "AI Assistant", href: "/ai", icon: "✣", description: "Profile-aware explanations", badge: "AI" },
      { label: "Account", href: "/account", icon: "○", description: "Saved profiles and preferences" },
      { label: "Admin", href: "/admin", icon: "⚙", description: "Operations and health" },
    ],
  },
];

export const allNavigation = [
  ...primaryNavigation,
  ...navigationGroups.flatMap((group) => group.items),
];

export function findNavigationItem(slug: string): NavigationItem | undefined {
  const path = "/" + slug.replace(/^\/+|\/+$/g, "");
  return allNavigation.find((item) => item.href === path);
}
