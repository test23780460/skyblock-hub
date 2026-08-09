export type ModuleKind = "planning" | "market" | "xp" | "profit" | "valuation" | "completion" | "gear";

export type ModuleRow = {
  name: string;
  category: string;
  outcome: string;
  note: string;
  badge?: string;
};

export type ModuleDefinition = {
  slug: string;
  eyebrow: string;
  title: string;
  description: string;
  kind: ModuleKind;
  accent: string;
  metrics: { label: string; value: string; note: string }[];
  rows: ModuleRow[];
  guidance: { title: string; copy: string }[];
  dataNote: string;
};

const sharedMetrics = [
  { label: "Player context", value: "Lookup available", note: "Manual labs do not silently inherit dashboard data" },
  { label: "Method", value: "Deterministic", note: "Calculations stay separate from AI" },
  { label: "Freshness", value: "On request", note: "No background player monitoring" },
  { label: "Confidence", value: "Explained", note: "Missing data is never invented" },
];

function define(definition: Omit<ModuleDefinition, "metrics"> & { metrics?: ModuleDefinition["metrics"] }): ModuleDefinition {
  return { ...definition, metrics: definition.metrics || sharedMetrics };
}

export const moduleCatalog: Record<string, ModuleDefinition> = Object.fromEntries([
  define({
    slug: "progression", eyebrow: "WHAT SHOULD I DO NEXT?", title: "Progression flight plan", accent: "cyan", kind: "planning",
    description: "Rank upgrades by stage, budget, prerequisites, and account-wide impact instead of chasing the loudest item.",
    dataNote: "Search a player for profile-specific recommendations. The planning sandbox below demonstrates the same budget logic with a labeled reference catalog.",
    rows: [
      { name: "Accessory family upgrades", category: "Magical Power", outcome: "Durable account-wide combat value", note: "Rank by coins per MP", badge: "BEST VALUE" },
      { name: "Next minion slot crafts", category: "Minions", outcome: "Permanent passive slot", note: "Checks unique craft tiers", badge: "CHEAP UPGRADE" },
      { name: "Missing gear modifiers", category: "Gear", outcome: "Improve equipment already owned", note: "Reforge, stars, gems, enchants", badge: "HIGH IMPACT" },
      { name: "Skill milestone path", category: "Skills", outcome: "Unlocks and balanced progression", note: "Includes estimated time", badge: "REQUIRES GRIND" },
      { name: "Museum donation band", category: "Completion", outcome: "Milestones and SkyBlock XP", note: "Uses eligible missing items", badge: "LONG TERM" },
    ],
    guidance: [
      { title: "Value before vanity", copy: "Affordable permanent gains outrank expensive sidegrades unless a stated goal changes the weighting." },
      { title: "Prerequisites matter", copy: "An upgrade is withheld when its unlock, collection, Slayer, Catacombs, Garden, or mining requirement is not met." },
      { title: "Recalculate intentionally", copy: "Player data refreshes only on a user request and still respects the shared server cache." },
    ],
  }),
  define({
    slug: "gear", eyebrow: "OWNED SETUP FIRST", title: "Gear diagnostics", accent: "rose", kind: "gear",
    description: "Inspect armor, weapons, equipment, tools, and pets for efficient improvements to items you already own.",
    dataNote: "Inventory sections hidden by a player's API settings stay unavailable. SkyPilot never manufactures missing item data.",
    rows: [
      { name: "Armor", category: "Reforges · stars · gemstones", outcome: "Compare missing modifiers by use case", note: "NBT is parsed as untrusted input" },
      { name: "Weapons", category: "Enchantments · upgrades", outcome: "Meaningful combat deltas", note: "No raw lore-only comparison" },
      { name: "Equipment", category: "Attributes · reforges", outcome: "Activity-specific loadout checks", note: "Attribute support is item-aware" },
      { name: "Tools", category: "Farming · mining · fishing", outcome: "Fortune, speed, and progression gains", note: "Models applicable upgrades only" },
      { name: "Pets", category: "Level · item · rarity", outcome: "Compare activity and combat roles", note: "Does not assume one universal best pet" },
    ],
    guidance: [
      { title: "Fix what you own", copy: "Missing low-cost enhancements are surfaced before a wholesale gear replacement." },
      { title: "Compare by purpose", copy: "Weapon and pet comparisons use the selected activity instead of one misleading raw score." },
      { title: "Safe item parsing", copy: "Malformed or oversized NBT is bounded so a bad payload cannot crash analysis." },
    ],
  }),
  define({
    slug: "accessories", eyebrow: "MAGICAL POWER OPTIMIZER", title: "Build MP efficiently", accent: "violet", kind: "planning",
    description: "Resolve accessory families, missing upgrades, powers, tuning, and the cheapest path to your next Magical Power target.",
    dataNote: "Current Bazaar and auction prices can move. Coins-per-MP values are estimates with source timestamps, never guarantees.",
    rows: [
      { name: "Missing accessories", category: "Family-aware", outcome: "Avoid duplicate-family mistakes", note: "Cheapest eligible option first", badge: "BEST VALUE" },
      { name: "Rarity upgrades", category: "Upgrade path", outcome: "Net MP gain over owned version", note: "Costs only the upgrade delta" },
      { name: "Accessory powers", category: "Combat tuning", outcome: "Match stats to activity", note: "Explains unlock requirements" },
      { name: "Tuning points", category: "Stat allocation", outcome: "Transparent point distribution", note: "Profile-specific when available" },
      { name: "Enrichments", category: "Late game", outcome: "Small targeted gains", note: "Shown only where applicable", badge: "LONG TERM" },
    ],
    guidance: [
      { title: "Family resolution", copy: "Only the highest active accessory in a family contributes, so upgrades are evaluated as net MP." },
      { title: "Target mode", copy: "Enter a budget or desired MP gain and the optimizer selects a reachable set." },
      { title: "Market confidence", copy: "Auction-derived costs carry confidence and freshness instead of pretending one listing is fair value." },
    ],
  }),
  define({
    slug: "economy", eyebrow: "PUBLIC MARKET INTELLIGENCE", title: "Economy command center", accent: "amber", kind: "market",
    description: "Connect Bazaar movement, auction sales, liquidity, valuations, and legitimate money-making opportunities.",
    dataNote: "Economy feeds are public-resource data handled by a separate global worker. Player searches never trigger an auction crawl.",
    rows: [
      { name: "Bazaar movers", category: "Price and volume", outcome: "Surface meaningful movement", note: "Liquidity-weighted" },
      { name: "Auction trends", category: "Ended sales", outcome: "Variant-aware price bands", note: "Buyer and seller tracking excluded" },
      { name: "Flip quality", category: "Spread and depth", outcome: "Risk-adjusted opportunity score", note: "Fees and fill risk included" },
      { name: "Craft versus buy", category: "Recipes", outcome: "Ingredient and fee breakdown", note: "Unlocks checked when known" },
      { name: "Market health", category: "Freshness", outcome: "Delayed feed warnings", note: "Never hides stale timestamps" },
    ],
    guidance: [
      { title: "No guaranteed profit", copy: "Every opportunity is an estimate; prices, competition, taxes, and fill time can change." },
      { title: "One ingestion pipeline", copy: "Web traffic reads normalized SkyPilot data instead of fanning out requests to Hypixel." },
      { title: "Useful history", copy: "Short raw retention feeds compact hourly and daily aggregates rather than a public API mirror." },
    ],
  }),
  define({
    slug: "bazaar", eyebrow: "SEARCH · SPREAD · LIQUIDITY", title: "Bazaar explorer", accent: "mint", kind: "market",
    description: "Search products, inspect order-book summaries, model fees, and rank opportunities by realistic liquidity.",
    dataNote: "Hypixel's quick-status prices are weighted summaries, not guaranteed executable transaction prices. Freshness is always shown.",
    rows: [
      { name: "Product browser", category: "Search and filters", outcome: "Buy, sell, spread, volume", note: "Bounded, paginated payloads" },
      { name: "Flip scorer", category: "Margin · fees · volume", outcome: "Estimated net profit and return", note: "Penalizes thin markets" },
      { name: "Price history", category: "Hourly and daily", outcome: "Trend and volatility context", note: "Interactive date ranges" },
      { name: "Craft comparison", category: "Recipes", outcome: "Craft cost versus market value", note: "Shows every assumption" },
      { name: "NPC comparison", category: "Conditional", outcome: "Legitimate caps where supported", note: "Hidden when mechanics are unknown" },
    ],
    guidance: [
      { title: "Spread is not profit", copy: "Taxes, order placement, competition, and incomplete fills reduce theoretical margins." },
      { title: "Depth before margin", copy: "A smaller spread in a deep market can outrank a giant spread with no usable volume." },
      { title: "Fresh data only", copy: "The interface explains delayed or unavailable market updates instead of silently reusing old values." },
    ],
  }),
  define({
    slug: "auctions", eyebrow: "LISTINGS · SALES · VALUE", title: "Auction intelligence", accent: "amber", kind: "valuation",
    description: "Search active BINs, compare variants, inspect ended sales, and estimate item value with an explicit confidence band.",
    dataNote: "Active listings are not completed sales. SkyPilot separates listing floors, real ended sales, and modeled value.",
    rows: [
      { name: "Active BIN search", category: "Listings", outcome: "Lowest comparable offers", note: "Variant filters applied" },
      { name: "Ending soon", category: "Auction timing", outcome: "Relevant active auctions", note: "Pagination prevents giant payloads" },
      { name: "Ended sales", category: "Observed prices", outcome: "Distribution and median", note: "Deduplicated by auction ID" },
      { name: "Modifier model", category: "Stars · enchants · gems", outcome: "Incremental component value", note: "Confidence-aware" },
      { name: "Fair-value range", category: "Valuation", outcome: "Low · expected · high", note: "Insufficient data is explicit" },
    ],
    guidance: [
      { title: "Compare like with like", copy: "Recombobulation, stars, gemstones, attributes, and item-specific upgrades define the comparable set." },
      { title: "Sales beat asks", copy: "Completed sales receive more weight than ambitious listings when enough observations exist." },
      { title: "Privacy by design", copy: "Valuation records do not retain buyer or seller identities when they are unnecessary." },
    ],
  }),
  define({
    slug: "money-making", eyebrow: "READINESS · RISK · RETURN", title: "Money-making methods", accent: "mint", kind: "profit",
    description: "Compare legitimate methods by setup, readiness, attention, capital, risk, and transparent coins-per-hour assumptions.",
    dataNote: "Outputs are planning estimates. SkyPilot does not automate gameplay, trades, or the Minecraft client.",
    rows: [
      { name: "Farming", category: "Consistent", outcome: "Crop-specific modeled output", note: "Garden and Fortune aware" },
      { name: "Mining", category: "Setup intensive", outcome: "Powder and route-aware estimate", note: "Readiness checked" },
      { name: "Fishing", category: "Progression gated", outcome: "Catch and drop model", note: "Uses supported current data" },
      { name: "Dungeons", category: "Variable", outcome: "Run-cost and drop scenarios", note: "Never assumes rare-drop luck" },
      { name: "Markets", category: "Capital at risk", outcome: "Liquidity-adjusted opportunities", note: "No guaranteed returns" },
    ],
    guidance: [
      { title: "Personalized readiness", copy: "Methods are lowered when the profile lacks required gear, skill, area, or capital." },
      { title: "Attention is a cost", copy: "Active, semi-active, and passive methods are separated instead of compared on coins alone." },
      { title: "Scenario ranges", copy: "Expected, cautious, and optimistic cases expose how assumptions affect output." },
    ],
  }),
  define({
    slug: "items", eyebrow: "GLOBAL ITEM KNOWLEDGE", title: "Item intelligence", accent: "blue", kind: "valuation",
    description: "Find items, inspect classifications and lore, connect recipes and markets, and understand progression relevance.",
    dataNote: "Official resource metadata is cached separately from price observations. Missing relations remain unavailable rather than fabricated.",
    rows: [
      { name: "Item search", category: "Metadata", outcome: "Fast names and categories", note: "Autocomplete uses bounded results" },
      { name: "Market value", category: "Bazaar or auction", outcome: "Source-specific price model", note: "Confidence and age shown" },
      { name: "Recipes", category: "Craft relations", outcome: "Ingredients and craft value", note: "Unlocks when known" },
      { name: "Progression relevance", category: "Unlocks and upgrades", outcome: "Where an item matters", note: "Data-driven relationships" },
      { name: "Modifier inspection", category: "NBT", outcome: "Safe, normalized attributes", note: "Untrusted input is bounded" },
    ],
    guidance: [
      { title: "One canonical catalog", copy: "Item names, rarities, categories, recipes, and relationships are centralized for update tolerance." },
      { title: "Price source matters", copy: "Bazaar summaries, active listings, ended sales, NPC prices, and estimates are labeled separately." },
      { title: "Update friendly", copy: "Unknown game attributes survive normalization without forcing a full schema rewrite." },
    ],
  }),
  define({
    slug: "skills", eyebrow: "XP · LEVELS · LOADOUTS", title: "Skills overview", accent: "cyan", kind: "xp",
    description: "Understand remaining XP, time, equipment, and the next efficient milestone across every core skill.",
    dataNote: "Time estimates depend on the rate you enter or a documented setup assumption. SkyPilot never presents one rate as universal.",
    rows: [
      { name: "Farming", category: "Garden", outcome: "Fortune, crops, milestones", note: "Full optimizer available" },
      { name: "Mining", category: "HOTM", outcome: "Powder, commissions, gemstones", note: "Current-tree aware" },
      { name: "Foraging", category: "Routes", outcome: "Gear, pets, target time", note: "Update-tolerant module" },
      { name: "Fishing", category: "Sea creatures", outcome: "Gear, pets, catch progression", note: "Available-data aware" },
      { name: "Combat", category: "Progression", outcome: "Legitimate planning guidance", note: "No gameplay automation" },
      { name: "Enchanting & Alchemy", category: "Utility", outcome: "Remaining XP and efficient setup", note: "Transparent assumptions" },
    ],
    guidance: [
      { title: "XP before percentages", copy: "Level displays derive from known XP curves where available, including progress inside the current level." },
      { title: "Rates are editable", copy: "Every ETA calculator exposes XP per hour, downtime, and session length." },
      { title: "Balanced guidance", copy: "The progression engine notices skill gaps without forcing max levels ahead of better-value upgrades." },
    ],
  }),
  define({
    slug: "garden", eyebrow: "FLAGSHIP FARMING WORKSPACE", title: "Garden optimizer", accent: "mint", kind: "xp",
    description: "Connect Garden level, crop milestones, Farming Fortune, visitors, pests, plots, equipment, and target-time planning.",
    dataNote: "Visitor and pest tools activate only where reliable current data is available. Unsupported mechanics are explicitly labeled.",
    rows: [
      { name: "Farming Fortune", category: "Attribution", outcome: "Every applicable source", note: "Gear, enchants, pets, Garden" },
      { name: "Crop optimizer", category: "10 major crops", outcome: "Setup and upgrade value", note: "Includes full Melon path" },
      { name: "Milestone planner", category: "Crop progression", outcome: "Remaining amount and sessions", note: "Rate is editable" },
      { name: "Visitors", category: "Conditional", outcome: "Offer value and rewards", note: "Only reliable data" },
      { name: "Pests", category: "Conditional", outcome: "Progress and calculator", note: "No invented rates" },
    ],
    guidance: [
      { title: "Fortune attribution", copy: "The calculator shows which pieces of gear, progression, and crop bonuses contribute." },
      { title: "Coins per Fortune", copy: "Supported upgrades are ranked by marginal Fortune and price, not by item rarity." },
      { title: "Melon complete path", copy: "Tool, armor, equipment, pet, Garden, and progression gaps form one staged checklist." },
    ],
  }),
  define({
    slug: "mining", eyebrow: "HOTM · POWDER · GEMSTONES", title: "Mining planner", accent: "blue", kind: "xp",
    description: "Evaluate Heart of the Mountain, powder, commissions, Speed, Fortune, tools, armor, gemstones, pets, and routes.",
    dataNote: "The tree and mechanic catalog is data-driven so new SkyBlock mining updates do not require rebuilding the module.",
    rows: [
      { name: "HOTM review", category: "Tree", outcome: "Unlocks and point allocation", note: "Goal-aware" },
      { name: "Powder plan", category: "Mithril · Gemstone · Glacite", outcome: "Remaining grind and allocation", note: "Editable hourly rates" },
      { name: "Gear diagnostics", category: "Armor and tools", outcome: "Gems, reforges, upgrades", note: "Owned setup first" },
      { name: "Commission path", category: "Progression", outcome: "Milestones and efficiency", note: "Current availability aware" },
      { name: "Route readiness", category: "Method", outcome: "Requirements before earnings", note: "No guaranteed yield" },
    ],
    guidance: [
      { title: "Powder is foundational", copy: "Expensive equipment is lowered when tree and powder investment would unlock more value." },
      { title: "Gemstone accounting", copy: "Open slots, quality, chamber costs, and marginal Fortune are evaluated separately." },
      { title: "Readiness over hype", copy: "Method estimates reflect current powder, gear, route access, and user-entered efficiency." },
    ],
  }),
  ...["foraging", "fishing", "dungeons", "slayers"].map((slug) => define({
    slug,
    eyebrow: slug === "dungeons" ? "FLOORS · CLASSES · READINESS" : slug === "slayers" ? "XP · UNLOCKS · COST" : "PROGRESSION WORKSPACE",
    title: slug === "dungeons" ? "Dungeon readiness" : slug === "slayers" ? "Slayer roadmap" : slug.charAt(0).toUpperCase() + slug.slice(1) + " planner",
    accent: slug === "slayers" ? "rose" : slug === "dungeons" ? "violet" : "cyan",
    kind: slug === "dungeons" || slug === "slayers" ? "profit" : "xp",
    description: slug === "dungeons" ? "Connect Catacombs, classes, completions, floors, secrets, equipment, cautious readiness ratings, and goals." : slug === "slayers" ? "Track every current Slayer category, XP, levels, unlocks, gear, costs, and supported profit assumptions." : "Plan levels, equipment, pets, progression unlocks, and transparent target-time scenarios.",
    dataNote: "Current API availability controls what appears. Unavailable details are explained and never replaced with fabricated values.",
    rows: slug === "dungeons" ? [
      { name: "Class analysis", category: "Selected role", outcome: "Level and gear fit", note: "Purpose-specific" },
      { name: "Floor readiness", category: "Cautious rating", outcome: "Factors and missing upgrades", note: "No performance guarantees" },
      { name: "Completions", category: "Normal · Master", outcome: "Progress and milestones", note: "Profile-derived" },
      { name: "Run economics", category: "Conditional", outcome: "Cost and drop scenarios", note: "Rare drops not assumed" },
    ] : slug === "slayers" ? [
      { name: "Revenant Horror", category: "Zombie", outcome: "XP, unlocks, gear", note: "Data-driven tier catalog" },
      { name: "Sven Packmaster", category: "Wolf", outcome: "XP, unlocks, gear", note: "Cost scenarios" },
      { name: "Voidgloom Seraph", category: "Enderman", outcome: "Readiness and progression", note: "No carry assumptions" },
      { name: "Current categories", category: "Extensible", outcome: "New bosses via configuration", note: "Unknown fields tolerated" },
    ] : [
      { name: "Level and XP", category: "Current progress", outcome: "Remaining target", note: "Known curves only" },
      { name: "Equipment", category: "Owned setup", outcome: "Missing efficient upgrades", note: "Activity-specific" },
      { name: "Pets", category: "Progression role", outcome: "Level and held-item checks", note: "Purpose-aware" },
      { name: "Target planner", category: "Time estimate", outcome: "Hours and sessions", note: "Editable rate" },
    ],
    guidance: [
      { title: "Transparent assumptions", copy: "Every time, cost, readiness, and profit output names the rate or scenario behind it." },
      { title: "Current data only", copy: "Schema changes and unavailable profile fields become safe unknowns, not server errors." },
      { title: "Actionable gaps", copy: "Recommendations link the missing requirement directly to its relevant planning tool." },
    ],
  })),
  ...["minions", "museum", "collections", "bestiary", "rift"].map((slug) => define({
    slug,
    eyebrow: "COMPLETION INTELLIGENCE",
    title: slug.charAt(0).toUpperCase() + slug.slice(1) + " tracker",
    accent: slug === "rift" ? "violet" : "amber",
    kind: slug === "minions" ? "profit" : "completion",
    description: slug === "minions" ? "Find the cheapest unique crafts for the next slot and model transparent upgrade, fuel, storage, and profit scenarios." : "Turn available profile progress into clear completion gaps, unlocks, and efficient next steps.",
    dataNote: (slug === "bestiary" || slug === "rift") ? "This module activates only for fields Hypixel currently exposes. Missing sections show an explicit unavailable state." : "Profile-specific results require a request-driven player lookup and respect disabled API sections.",
    rows: slug === "minions" ? [
      { name: "Unique crafts", category: "Tier completion", outcome: "Cheapest missing tiers", note: "Next-slot path" },
      { name: "Slot optimizer", category: "Permanent unlock", outcome: "Craft count and cost", note: "Family-aware" },
      { name: "Profit model", category: "Fuel · upgrades · storage", outcome: "Daily net estimate", note: "Editable prices and uptime" },
      { name: "Collection value", category: "Passive progress", outcome: "Useful unlock alignment", note: "Goal-aware" },
    ] : [
      { name: "Current completion", category: "Profile-derived", outcome: "Progress and missing entries", note: "Available data only" },
      { name: "Easy gains", category: "Value ranking", outcome: "Efficient completion path", note: "Cost and prerequisites" },
      { name: "Unlocks", category: "Milestones", outcome: "What the next tier provides", note: "Data-driven catalog" },
      { name: "Unavailable fields", category: "Trust", outcome: "Clear limitation", note: "Never fabricated" },
    ],
    guidance: [
      { title: "Completion with purpose", copy: "Recommendations connect progress to unlocks and account goals instead of chasing percentages alone." },
      { title: "Efficient ordering", copy: "Cheap, reachable contributions are separated from expensive long-term collections." },
      { title: "API-aware", copy: "A player's disabled or absent fields stay unknown, with no inference from unrelated data." },
    ],
  })),
  define({
    slug: "calculators", eyebrow: "TRANSPARENT SKYBLOCK MATH", title: "Calculator lab", accent: "cyan", kind: "xp",
    description: "Model XP, time, Bazaar margin, pet progress, minion profit, dungeon runs, Slayer cost, skill targets, and net worth assumptions.",
    dataNote: "Each calculator exposes inputs and formulas. Results are planning estimates, never hidden AI-generated numbers.",
    rows: [
      { name: "Skill XP and time", category: "Levels", outcome: "Remaining XP, hours, sessions", note: "Editable XP rate" },
      { name: "Bazaar profit", category: "Markets", outcome: "Gross, fees, net, return", note: "Fill risk separate" },
      { name: "Pet leveling", category: "XP", outcome: "Remaining time and cost", note: "Pet type modifiers supported" },
      { name: "Minion profit", category: "Passive", outcome: "Daily and monthly net", note: "Fuel and downtime" },
      { name: "Dungeons and Slayers", category: "Runs", outcome: "Target count and scenario cost", note: "Rare drops not assumed" },
    ],
    guidance: [
      { title: "Inputs stay visible", copy: "The exact rate, quantity, fee, and assumption behind every result stays on screen." },
      { title: "Profile prefill", copy: "When a player is selected, available current values prefill without blocking manual edits." },
      { title: "No invented precision", copy: "Unsupported modifiers are excluded and named instead of buried in a precise-looking total." },
    ],
  }),
].map((definition) => [definition.slug, definition]));

export function getModuleDefinition(slug: string): ModuleDefinition | undefined {
  return moduleCatalog[slug];
}
