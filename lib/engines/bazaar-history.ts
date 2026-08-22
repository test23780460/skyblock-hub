import { round } from "./internal.js";

export type BazaarHistoryObservation = {
  at: number;
  buyHigh: number;
  buyLow: number;
  buyClose: number;
  sellHigh: number;
  sellLow: number;
  sellClose: number;
  sampleCount: number;
};

export type BazaarHistorySummary = {
  firstReference: number;
  latestReference: number;
  periodLow: number;
  periodHigh: number;
  absoluteChange: number;
  percentChange: number | null;
  meanAbsoluteMovementPercent: number | null;
  direction: "up" | "down" | "flat";
  bucketCount: number;
  sampleCount: number;
};

/**
 * Summarizes durable Hypixel Bazaar summary-price buckets. This is not trade
 * history or an item appraisal: the reference is simply the midpoint between
 * the normalized buy and sell summary prices in each bucket.
 */
export function summarizeBazaarHistory(
  observations: readonly BazaarHistoryObservation[],
): BazaarHistorySummary | null {
  if (observations.length === 0) return null;

  const ordered = observations.map(validateObservation).sort((left, right) => left.at - right.at);
  const references = ordered.map((point) => midpoint(point.buyClose, point.sellClose));
  const firstReference = references[0]!;
  const latestReference = references.at(-1)!;
  const periodLow = Math.min(...ordered.map((point) => midpoint(point.buyLow, point.sellLow)));
  const periodHigh = Math.max(...ordered.map((point) => midpoint(point.buyHigh, point.sellHigh)));
  const absoluteChange = latestReference - firstReference;
  const percentChange = firstReference > 0
    ? absoluteChange / firstReference * 100
    : null;
  const movements: number[] = [];
  for (let index = 1; index < references.length; index += 1) {
    const previous = references[index - 1]!;
    if (previous > 0) {
      movements.push(Math.abs(references[index]! - previous) / previous * 100);
    }
  }
  const meanAbsoluteMovementPercent = movements.length
    ? movements.reduce((sum, value) => sum + value, 0) / movements.length
    : null;
  const direction = percentChange === null || Math.abs(percentChange) < 0.1
    ? "flat"
    : percentChange > 0
      ? "up"
      : "down";

  return {
    firstReference: round(firstReference, 2),
    latestReference: round(latestReference, 2),
    periodLow: round(periodLow, 2),
    periodHigh: round(periodHigh, 2),
    absoluteChange: round(absoluteChange, 2),
    percentChange: percentChange === null ? null : round(percentChange, 2),
    meanAbsoluteMovementPercent:
      meanAbsoluteMovementPercent === null
        ? null
        : round(meanAbsoluteMovementPercent, 2),
    direction,
    bucketCount: ordered.length,
    sampleCount: ordered.reduce((sum, point) => sum + point.sampleCount, 0),
  };
}

function validateObservation(
  observation: BazaarHistoryObservation,
  index: number,
): BazaarHistoryObservation {
  const numericValues = [
    observation.at,
    observation.buyHigh,
    observation.buyLow,
    observation.buyClose,
    observation.sellHigh,
    observation.sellLow,
    observation.sellClose,
    observation.sampleCount,
  ];
  if (numericValues.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError(`observations[${index}] contains an invalid value`);
  }
  if (!Number.isSafeInteger(observation.at)) {
    throw new RangeError(`observations[${index}].at must be a Unix millisecond timestamp`);
  }
  if (!Number.isSafeInteger(observation.sampleCount) || observation.sampleCount < 1) {
    throw new RangeError(`observations[${index}].sampleCount must be positive`);
  }
  if (
    observation.buyLow > observation.buyClose ||
    observation.buyHigh < observation.buyClose ||
    observation.sellLow > observation.sellClose ||
    observation.sellHigh < observation.sellClose
  ) {
    throw new RangeError(`observations[${index}] violates OHLC bounds`);
  }
  return observation;
}

function midpoint(left: number, right: number): number {
  return (left + right) / 2;
}
