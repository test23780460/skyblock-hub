import {
  assertNonNegative,
  assertPositive,
  assertRate,
  clamp,
  median,
  round,
  weightedMedian,
} from "./internal.js";

export type ValuationConfidence = "high" | "medium" | "low";

export interface HistoricalSale {
  price: number;
  timestamp?: number;
  /** Similarity of the sold variant to the valued item, from zero to one. */
  similarity?: number;
}

export interface ValuationComponent {
  id: string;
  label: string;
  estimatedValue: number;
  /** Expected fraction recoverable on resale. Defaults to 0.8. */
  realizableRate?: number;
}

export interface ItemValuationInput {
  itemId: string;
  baseItemEstimate?: number;
  components?: readonly ValuationComponent[];
  historicalSales?: readonly HistoricalSale[];
  activeLowestBin?: number;
  /** Fixed evaluation time in Unix milliseconds. Defaults to newest sale time. */
  asOf?: number;
  recencyHalfLifeDays?: number;
}

export interface ItemValuationResult {
  itemId: string;
  estimatedValue: number;
  lowEstimate: number;
  highEstimate: number;
  confidence: ValuationConfidence;
  confidenceScore: number;
  modeledValue: number | null;
  comparableMedian: number | null;
  activeLowestBin: number | null;
  salesUsed: number;
  salesRejectedAsOutliers: number;
  componentValue: number;
  reasons: string[];
  disclaimer: string;
}

export const VALUATION_DISCLAIMER =
  "Estimated value is not an exact sale price. Item variants, demand, fees, and market conditions can materially change realized value.";

export function valueItem(input: ItemValuationInput): ItemValuationResult {
  if (!input.itemId.trim()) throw new TypeError("itemId is required");
  if (input.baseItemEstimate !== undefined) {
    assertNonNegative(input.baseItemEstimate, "baseItemEstimate");
  }
  if (input.activeLowestBin !== undefined) {
    assertPositive(input.activeLowestBin, "activeLowestBin");
  }
  const halfLife = input.recencyHalfLifeDays ?? 45;
  assertPositive(halfLife, "recencyHalfLifeDays");
  const components = input.components ?? [];
  const componentValue = components.reduce((sum, component) => {
    if (!component.id.trim() || !component.label.trim()) {
      throw new TypeError("valuation component id and label are required");
    }
    assertNonNegative(component.estimatedValue, `${component.id}.estimatedValue`);
    const realizableRate = component.realizableRate ?? 0.8;
    assertRate(realizableRate, `${component.id}.realizableRate`);
    return sum + component.estimatedValue * realizableRate;
  }, 0);
  const hasModel = input.baseItemEstimate !== undefined || components.length > 0;
  const modeledValue = hasModel ? (input.baseItemEstimate ?? 0) + componentValue : null;

  const sales = (input.historicalSales ?? []).map((sale, index) => {
    assertPositive(sale.price, `historicalSales[${index}].price`);
    if (sale.timestamp !== undefined) assertNonNegative(sale.timestamp, `historicalSales[${index}].timestamp`);
    const similarity = sale.similarity ?? 1;
    assertRate(similarity, `historicalSales[${index}].similarity`);
    return { ...sale, similarity };
  });
  const newestTimestamp = Math.max(0, ...sales.map((sale) => sale.timestamp ?? 0));
  const asOf = input.asOf ?? newestTimestamp;
  assertNonNegative(asOf, "asOf");
  const saleMedian = sales.length > 0 ? median(sales.map((sale) => sale.price)) : null;
  const absoluteDeviations = saleMedian === null
    ? []
    : sales.map((sale) => Math.abs(sale.price - saleMedian));
  const medianAbsoluteDeviation = absoluteDeviations.length > 0
    ? median(absoluteDeviations)
    : 0;
  const outlierThreshold = saleMedian === null
    ? 0
    : Math.max(medianAbsoluteDeviation * 3, saleMedian * 0.25, 1);
  const retainedSales = saleMedian === null
    ? []
    : sales.filter((sale) => Math.abs(sale.price - saleMedian) <= outlierThreshold);
  const weightedSales = retainedSales.map((sale) => {
    const ageDays = sale.timestamp === undefined
      ? halfLife
      : Math.max(0, asOf - sale.timestamp) / 86_400_000;
    return {
      value: sale.price,
      weight: sale.similarity * 0.5 ** (ageDays / halfLife),
    };
  });
  const comparableMedian = weightedSales.length > 0 ? weightedMedian(weightedSales) : null;

  if (modeledValue === null && comparableMedian === null && input.activeLowestBin === undefined) {
    throw new RangeError("valuation requires a model, historical sale, or active lowest BIN");
  }

  let estimate: number;
  if (modeledValue !== null && comparableMedian !== null) {
    const marketWeight = clamp(0.25 + retainedSales.length * 0.08, 0.25, 0.8);
    estimate = comparableMedian * marketWeight + modeledValue * (1 - marketWeight);
  } else {
    estimate = comparableMedian ?? modeledValue ?? input.activeLowestBin!;
  }
  if (input.activeLowestBin !== undefined && (modeledValue !== null || comparableMedian !== null)) {
    const listingWeight = comparableMedian === null ? 0.2 : 0.1;
    estimate = estimate * (1 - listingWeight) + input.activeLowestBin * listingWeight;
  }

  const sampleScore = clamp(retainedSales.length / 8 * 100, 0, 100);
  const dispersion =
    comparableMedian && comparableMedian > 0
      ? medianAbsoluteDeviation / comparableMedian
      : 0.5;
  const stabilityScore = clamp(100 - dispersion / 0.35 * 100, 0, 100);
  const timestampedAges = retainedSales
    .filter((sale) => sale.timestamp !== undefined)
    .map((sale) => Math.max(0, asOf - sale.timestamp!) / 86_400_000);
  const recencyScore = timestampedAges.length > 0
    ? clamp(100 * 0.5 ** (median(timestampedAges) / 90), 0, 100)
    : 50;
  const agreementScore = modeledValue !== null && comparableMedian !== null
    ? clamp(100 - Math.abs(modeledValue - comparableMedian) / Math.max(modeledValue, comparableMedian) * 150, 0, 100)
    : 55;
  const sourceBonus = input.activeLowestBin === undefined ? 0 : 100;
  const confidenceScore = clamp(
    sampleScore * 0.35 +
      stabilityScore * 0.25 +
      recencyScore * 0.2 +
      agreementScore * 0.15 +
      sourceBonus * 0.05,
    0,
    100,
  );
  const confidence = confidenceFor(confidenceScore, retainedSales.length, hasModel);
  const uncertainty = clamp(0.08 + (100 - confidenceScore) / 250 + dispersion * 0.5, 0.1, 0.65);
  const reasons = buildReasons(
    confidence,
    retainedSales.length,
    sales.length - retainedSales.length,
    dispersion,
    hasModel,
    input.activeLowestBin !== undefined,
  );

  return {
    itemId: input.itemId,
    estimatedValue: round(estimate),
    lowEstimate: round(Math.max(0, estimate * (1 - uncertainty))),
    highEstimate: round(estimate * (1 + uncertainty)),
    confidence,
    confidenceScore: round(confidenceScore, 1),
    modeledValue: modeledValue === null ? null : round(modeledValue),
    comparableMedian: comparableMedian === null ? null : round(comparableMedian),
    activeLowestBin: input.activeLowestBin ?? null,
    salesUsed: retainedSales.length,
    salesRejectedAsOutliers: sales.length - retainedSales.length,
    componentValue: round(componentValue),
    reasons,
    disclaimer: VALUATION_DISCLAIMER,
  };
}

function confidenceFor(
  score: number,
  sampleCount: number,
  hasModel: boolean,
): ValuationConfidence {
  if (score >= 72 && sampleCount >= 5) return "high";
  if (score >= 44 && (sampleCount >= 2 || hasModel)) return "medium";
  return "low";
}

function buildReasons(
  confidence: ValuationConfidence,
  salesUsed: number,
  outliers: number,
  dispersion: number,
  hasModel: boolean,
  hasListing: boolean,
): string[] {
  const reasons = [`${salesUsed} comparable historical sale${salesUsed === 1 ? "" : "s"} used.`];
  if (outliers > 0) reasons.push(`${outliers} statistical outlier${outliers === 1 ? " was" : "s were"} excluded.`);
  if (dispersion > 0.25) reasons.push("Comparable prices vary substantially, widening the estimate range.");
  if (hasModel) reasons.push("Base item and recoverable upgrade values contribute to the model.");
  if (hasListing) reasons.push("The current lowest BIN is used as a secondary market signal, not a confirmed sale.");
  if (confidence === "low") reasons.push("Insufficient reliable sale data is available; treat this estimate cautiously.");
  return reasons;
}

