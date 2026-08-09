import {
  assertNonNegative,
  assertPositive,
  assertRate,
  clamp,
  lexicalCompare,
  round,
} from "./internal.js";

export interface BazaarFeeModel {
  buyRate?: number;
  sellRate?: number;
  flatPerUnit?: number;
}

export interface BazaarFlipInput {
  productId: string;
  displayName: string;
  /** Price paid per item through a filled buy order. */
  buyOrderPrice: number;
  /** Gross price received per item through a filled sell offer. */
  sellOfferPrice: number;
  buyVolume: number;
  sellVolume: number;
  buyOrders?: number;
  sellOrders?: number;
  /** Realized or modeled volatility from zero (stable) to one (extreme). */
  volatility?: number;
  volumeWindowHours?: number;
  participationRate?: number;
  fees?: BazaarFeeModel;
}

export type BazaarFlipQuality = "excellent" | "good" | "speculative" | "avoid";

export interface BazaarFlipScore extends BazaarFlipInput {
  grossMarginPerUnit: number;
  feesPerUnit: number;
  netMarginPerUnit: number;
  returnOnInvestment: number;
  liquidityScore: number;
  riskScore: number;
  opportunityScore: number;
  quality: BazaarFlipQuality;
  estimatedHourlyUnits: number;
  estimatedHourlyProfit: number;
  disclaimer: string;
}

export const BAZAAR_ESTIMATE_DISCLAIMER =
  "Bazaar results are estimates, not guaranteed profit. Prices, queue position, fees, and fill speed can change.";

export function scoreBazaarFlip(input: BazaarFlipInput): BazaarFlipScore {
  validateInput(input);
  const buyRate = input.fees?.buyRate ?? 0;
  const sellRate = input.fees?.sellRate ?? 0.0125;
  const flatPerUnit = input.fees?.flatPerUnit ?? 0;
  assertRate(buyRate, "fees.buyRate");
  assertRate(sellRate, "fees.sellRate");
  assertNonNegative(flatPerUnit, "fees.flatPerUnit");
  const volumeWindowHours = input.volumeWindowHours ?? 168;
  const participationRate = input.participationRate ?? 0.05;
  assertPositive(volumeWindowHours, "volumeWindowHours");
  assertRate(participationRate, "participationRate");

  const acquisitionCost = input.buyOrderPrice * (1 + buyRate);
  const proceeds = input.sellOfferPrice * (1 - sellRate);
  const grossMarginPerUnit = input.sellOfferPrice - input.buyOrderPrice;
  const feesPerUnit = input.buyOrderPrice * buyRate + input.sellOfferPrice * sellRate + flatPerUnit;
  const netMarginPerUnit = proceeds - acquisitionCost - flatPerUnit;
  const returnOnInvestment =
    acquisitionCost > 0 ? netMarginPerUnit / acquisitionCost : 0;

  const minimumVolume = Math.min(input.buyVolume, input.sellVolume);
  const maximumVolume = Math.max(input.buyVolume, input.sellVolume);
  const volumeScore = clamp(Math.log10(1 + minimumVolume) / 6 * 100, 0, 100);
  const balanceScore = maximumVolume > 0 ? minimumVolume / maximumVolume * 100 : 0;
  const hasOrderDepth = input.buyOrders !== undefined || input.sellOrders !== undefined;
  const minimumOrders = Math.min(input.buyOrders ?? 0, input.sellOrders ?? 0);
  const orderScore = hasOrderDepth
    ? clamp(Math.log1p(minimumOrders) / Math.log(101) * 100, 0, 100)
    : 50;
  const liquidityScore = clamp(
    volumeScore * 0.65 + balanceScore * 0.25 + orderScore * 0.1,
    0,
    100,
  );

  const volatility = input.volatility ?? 0.25;
  const riskScore = clamp(volatility * 65 + (100 - liquidityScore) * 0.35, 0, 100);
  const estimatedHourlyUnits = minimumVolume / volumeWindowHours * participationRate;
  const estimatedHourlyProfit = Math.max(0, netMarginPerUnit) * estimatedHourlyUnits;
  const roiScore = netMarginPerUnit > 0
    ? clamp(returnOnInvestment / 0.05 * 100, 0, 100)
    : 0;
  const unitProfitScore = netMarginPerUnit > 0
    ? clamp(Math.log10(1 + netMarginPerUnit) / 4 * 100, 0, 100)
    : 0;
  const hourlyProfitScore = estimatedHourlyProfit > 0
    ? clamp(Math.log10(1 + estimatedHourlyProfit) / 7 * 100, 0, 100)
    : 0;
  const rawScore =
    roiScore * 0.3 +
    unitProfitScore * 0.15 +
    liquidityScore * 0.35 +
    hourlyProfitScore * 0.2;
  const opportunityScore = netMarginPerUnit > 0
    ? clamp(rawScore * (1 - riskScore / 200), 0, 100)
    : 0;

  return {
    ...input,
    grossMarginPerUnit: round(grossMarginPerUnit, 2),
    feesPerUnit: round(feesPerUnit, 2),
    netMarginPerUnit: round(netMarginPerUnit, 2),
    returnOnInvestment: round(returnOnInvestment, 5),
    liquidityScore: round(liquidityScore, 1),
    riskScore: round(riskScore, 1),
    opportunityScore: round(opportunityScore, 1),
    quality: qualityFor(opportunityScore, riskScore),
    estimatedHourlyUnits: round(estimatedHourlyUnits, 2),
    estimatedHourlyProfit: round(estimatedHourlyProfit, 2),
    disclaimer: BAZAAR_ESTIMATE_DISCLAIMER,
  };
}

export function rankBazaarFlips(
  inputs: readonly BazaarFlipInput[],
): BazaarFlipScore[] {
  return inputs
    .map(scoreBazaarFlip)
    .sort(
      (left, right) =>
        right.opportunityScore - left.opportunityScore ||
        right.estimatedHourlyProfit - left.estimatedHourlyProfit ||
        lexicalCompare(left.productId, right.productId),
    );
}

function qualityFor(score: number, risk: number): BazaarFlipQuality {
  if (score >= 72 && risk < 40) return "excellent";
  if (score >= 52 && risk < 62) return "good";
  if (score >= 30) return "speculative";
  return "avoid";
}

function validateInput(input: BazaarFlipInput): void {
  if (!input.productId.trim() || !input.displayName.trim()) {
    throw new TypeError("productId and displayName are required");
  }
  assertPositive(input.buyOrderPrice, "buyOrderPrice");
  assertPositive(input.sellOfferPrice, "sellOfferPrice");
  assertNonNegative(input.buyVolume, "buyVolume");
  assertNonNegative(input.sellVolume, "sellVolume");
  if (input.buyOrders !== undefined) assertNonNegative(input.buyOrders, "buyOrders");
  if (input.sellOrders !== undefined) assertNonNegative(input.sellOrders, "sellOrders");
  if (input.volatility !== undefined) assertRate(input.volatility, "volatility");
}

