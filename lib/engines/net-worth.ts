import { assertNonNegative, lexicalCompare, round } from "./internal.js";
import type { ValuationConfidence } from "./valuation.js";

export interface NetWorthAsset {
  /** Stable identity for de-duplicating an item across containers. */
  id: string;
  category: string;
  unitValue: number;
  quantity?: number;
  confidence?: ValuationConfidence;
  liquid?: boolean;
  include?: boolean;
}

export interface NetWorthInput {
  balances?: Readonly<Record<string, number>>;
  assets?: readonly NetWorthAsset[];
}

export interface NetWorthCategory {
  category: string;
  value: number;
  liquidValue: number;
  entries: number;
}

export interface NetWorthResult {
  label: "Estimated Net Worth";
  total: number;
  liquidTotal: number;
  illiquidTotal: number;
  confidence: ValuationConfidence;
  confidenceScore: number;
  categories: NetWorthCategory[];
  duplicateAssetIds: string[];
  excludedAssets: number;
  countedEntries: number;
}

interface NormalizedEntry {
  id: string;
  category: string;
  value: number;
  confidence: ValuationConfidence;
  liquid: boolean;
}

const CONFIDENCE_WEIGHT: Readonly<Record<ValuationConfidence, number>> = {
  high: 0.95,
  medium: 0.65,
  low: 0.35,
};

export function aggregateNetWorth(input: NetWorthInput): NetWorthResult {
  const entries: NormalizedEntry[] = [];
  for (const [name, value] of Object.entries(input.balances ?? {}).sort(([left], [right]) => lexicalCompare(left, right))) {
    if (!name.trim()) throw new TypeError("balance names cannot be empty");
    assertNonNegative(value, `balances.${name}`);
    entries.push({
      id: `balance:${name}`,
      category: name,
      value,
      confidence: "high",
      liquid: true,
    });
  }

  let excludedAssets = 0;
  const assetsById = new Map<string, NormalizedEntry>();
  const duplicateAssetIds = new Set<string>();
  for (const asset of input.assets ?? []) {
    validateAsset(asset);
    if (asset.include === false) {
      excludedAssets += 1;
      continue;
    }
    const normalized: NormalizedEntry = {
      id: asset.id,
      category: asset.category,
      value: asset.unitValue * (asset.quantity ?? 1),
      confidence: asset.confidence ?? "low",
      liquid: asset.liquid ?? false,
    };
    const existing = assetsById.get(asset.id);
    if (existing) {
      duplicateAssetIds.add(asset.id);
      if (preferEntry(normalized, existing)) assetsById.set(asset.id, normalized);
    } else {
      assetsById.set(asset.id, normalized);
    }
  }
  entries.push(...assetsById.values());

  const categoryMap = new Map<string, NetWorthCategory>();
  let total = 0;
  let liquidTotal = 0;
  let confidenceValue = 0;
  for (const entry of entries) {
    total += entry.value;
    if (entry.liquid) liquidTotal += entry.value;
    confidenceValue += entry.value * CONFIDENCE_WEIGHT[entry.confidence];
    const category = categoryMap.get(entry.category) ?? {
      category: entry.category,
      value: 0,
      liquidValue: 0,
      entries: 0,
    };
    category.value += entry.value;
    if (entry.liquid) category.liquidValue += entry.value;
    category.entries += 1;
    categoryMap.set(entry.category, category);
  }
  const confidenceScore = total > 0 ? confidenceValue / total * 100 : 0;

  return {
    label: "Estimated Net Worth",
    total: round(total),
    liquidTotal: round(liquidTotal),
    illiquidTotal: round(total - liquidTotal),
    confidence: confidenceScore >= 80 ? "high" : confidenceScore >= 50 ? "medium" : "low",
    confidenceScore: round(confidenceScore, 1),
    categories: [...categoryMap.values()]
      .map((category) => ({
        ...category,
        value: round(category.value),
        liquidValue: round(category.liquidValue),
      }))
      .sort(
        (left, right) =>
          right.value - left.value || lexicalCompare(left.category, right.category),
      ),
    duplicateAssetIds: [...duplicateAssetIds].sort(lexicalCompare),
    excludedAssets,
    countedEntries: entries.length,
  };
}

function preferEntry(candidate: NormalizedEntry, existing: NormalizedEntry): boolean {
  const confidenceDifference =
    CONFIDENCE_WEIGHT[candidate.confidence] - CONFIDENCE_WEIGHT[existing.confidence];
  if (confidenceDifference !== 0) return confidenceDifference > 0;
  if (candidate.value !== existing.value) return candidate.value > existing.value;
  return lexicalCompare(candidate.category, existing.category) < 0;
}

function validateAsset(asset: NetWorthAsset): void {
  if (!asset.id.trim() || !asset.category.trim()) {
    throw new TypeError("asset id and category are required");
  }
  assertNonNegative(asset.unitValue, `${asset.id}.unitValue`);
  const quantity = asset.quantity ?? 1;
  assertNonNegative(quantity, `${asset.id}.quantity`);
}

