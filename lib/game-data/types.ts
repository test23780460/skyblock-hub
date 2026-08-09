export interface CatalogMetadata {
  schemaVersion: 1;
  catalogVersion: string;
  note: string;
}

export interface RarityDefinition {
  id:
    | "common"
    | "uncommon"
    | "rare"
    | "epic"
    | "legendary"
    | "mythic"
    | "divine"
    | "special"
    | "very_special";
  label: string;
  rank: number;
  color: string;
  aliases: readonly string[];
}

export type SkillKind = "core" | "support" | "social" | "cosmetic";

export interface SkillDefinition {
  id: string;
  label: string;
  profileKey: string;
  kind: SkillKind;
  route: string;
  aliases: readonly string[];
}

export interface CropDefinition {
  id: string;
  label: string;
  collectionKey: string;
  itemIds: readonly string[];
  aliases: readonly string[];
}

export interface SlayerDefinition {
  id: string;
  label: string;
  bossName: string;
  profileKey: string;
  area: "overworld" | "end" | "crimson-isle" | "rift";
  route: string;
  aliases: readonly string[];
}

export type FeatureDataSource =
  | "profile"
  | "economy"
  | "manual"
  | "profile-and-economy"
  | "profile-or-manual";

export type FeatureMaturity = "core" | "conditional" | "experimental";

export interface FeatureDefinition {
  id: string;
  label: string;
  route: string;
  category: "profile" | "progression" | "economy" | "skill" | "completion" | "tool";
  dataSource: FeatureDataSource;
  maturity: FeatureMaturity;
  requiredProfileKeys: readonly string[];
  engine: string | null;
}

