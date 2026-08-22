import {
  assertNonNegative,
  assertPositive,
  assertRate,
  lexicalCompare,
  round,
} from "./internal.js";

export interface CraftIngredientInput {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface CraftFlipInput {
  recipeId: string;
  recipeName: string;
  ingredients: readonly CraftIngredientInput[];
  outputQuantity: number;
  salePricePerOutput: number;
  sellFeeRate: number;
  fixedCosts?: number;
  recipeUnlocked: boolean | null;
}

export interface CraftFlipResult {
  ingredientCost: number;
  fixedCosts: number;
  totalCost: number;
  grossRevenue: number;
  saleFees: number;
  netRevenue: number;
  netProfit: number;
  returnOnCost: number | null;
  breakEvenSalePricePerOutput: number | null;
  profitable: boolean;
  executable: boolean;
  blockers: string[];
  ingredientBreakdown: (CraftIngredientInput & { totalCost: number })[];
  disclaimer: string;
}

export interface NpcBazaarComparisonInput {
  productId: string;
  productName: string;
  quantity: number;
  npcBuyPrice: number;
  npcSellPrice: number;
  bazaarInstantBuyPrice: number;
  bazaarInstantSellPrice: number;
  bazaarSellFeeRate: number;
  npcBuyLimitRemaining?: number | null;
  npcSellLimitRemaining?: number | null;
}

export type NpcBazaarRouteId = "npc-to-bazaar" | "bazaar-to-npc";

export interface NpcBazaarRouteResult {
  id: NpcBazaarRouteId;
  label: string;
  quantity: number;
  cost: number;
  grossRevenue: number;
  fees: number;
  netProfit: number;
  returnOnCost: number | null;
  eligible: boolean;
  blockers: string[];
}

export interface NpcBazaarComparisonResult {
  routes: NpcBazaarRouteResult[];
  bestEligibleRoute: NpcBazaarRouteResult | null;
  bestPositiveRoute: NpcBazaarRouteResult | null;
  disclaimer: string;
}

export function calculateCraftFlip(input: CraftFlipInput): CraftFlipResult {
  if (!input.recipeId.trim() || !input.recipeName.trim()) {
    throw new TypeError("recipeId and recipeName are required");
  }
  if (input.ingredients.length === 0 || input.ingredients.length > 50) {
    throw new RangeError("ingredients must contain between 1 and 50 entries");
  }
  assertPositive(input.outputQuantity, "outputQuantity");
  assertNonNegative(input.salePricePerOutput, "salePricePerOutput");
  assertRate(input.sellFeeRate, "sellFeeRate");
  const fixedCosts = input.fixedCosts ?? 0;
  assertNonNegative(fixedCosts, "fixedCosts");
  const seen = new Set<string>();
  const ingredientBreakdown = input.ingredients.map((ingredient) => {
    if (!ingredient.id.trim() || !ingredient.name.trim()) {
      throw new TypeError("ingredient id and name are required");
    }
    if (seen.has(ingredient.id)) throw new TypeError(`duplicate ingredient id: ${ingredient.id}`);
    seen.add(ingredient.id);
    assertPositive(ingredient.quantity, `${ingredient.id}.quantity`);
    assertNonNegative(ingredient.unitPrice, `${ingredient.id}.unitPrice`);
    return { ...ingredient, totalCost: round(ingredient.quantity * ingredient.unitPrice) };
  });
  const ingredientCost = ingredientBreakdown.reduce((sum, ingredient) => sum + ingredient.totalCost, 0);
  const totalCost = ingredientCost + fixedCosts;
  const grossRevenue = input.outputQuantity * input.salePricePerOutput;
  const saleFees = grossRevenue * input.sellFeeRate;
  const netRevenue = grossRevenue - saleFees;
  const netProfit = netRevenue - totalCost;
  const returnOnCost = totalCost === 0 ? null : netProfit / totalCost;
  const feeMultiplier = 1 - input.sellFeeRate;
  const breakEvenSalePricePerOutput = feeMultiplier === 0
    ? null
    : totalCost / input.outputQuantity / feeMultiplier;
  const blockers = input.recipeUnlocked === true
    ? []
    : [input.recipeUnlocked === false ? "Recipe is not unlocked" : "Recipe unlock is unverified"];

  return {
    ingredientCost: round(ingredientCost),
    fixedCosts: round(fixedCosts),
    totalCost: round(totalCost),
    grossRevenue: round(grossRevenue),
    saleFees: round(saleFees),
    netRevenue: round(netRevenue),
    netProfit: round(netProfit),
    returnOnCost: returnOnCost === null ? null : round(returnOnCost, 4),
    breakEvenSalePricePerOutput:
      breakEvenSalePricePerOutput === null ? null : round(breakEvenSalePricePerOutput, 2),
    profitable: netProfit > 0,
    executable: blockers.length === 0,
    blockers,
    ingredientBreakdown,
    disclaimer:
      "Craft results use only the entered quantities, prices, fees, and unlock state. They exclude fill time, competition, price movement, taxes not entered here, and any unlisted ingredient or opportunity cost.",
  };
}

export function compareNpcAndBazaar(
  input: NpcBazaarComparisonInput,
): NpcBazaarComparisonResult {
  if (!input.productId.trim() || !input.productName.trim()) {
    throw new TypeError("productId and productName are required");
  }
  assertPositive(input.quantity, "quantity");
  assertNonNegative(input.npcBuyPrice, "npcBuyPrice");
  assertNonNegative(input.npcSellPrice, "npcSellPrice");
  assertNonNegative(input.bazaarInstantBuyPrice, "bazaarInstantBuyPrice");
  assertNonNegative(input.bazaarInstantSellPrice, "bazaarInstantSellPrice");
  assertRate(input.bazaarSellFeeRate, "bazaarSellFeeRate");
  validateOptionalLimit(input.npcBuyLimitRemaining, "npcBuyLimitRemaining");
  validateOptionalLimit(input.npcSellLimitRemaining, "npcSellLimitRemaining");

  const routes = [
    buildRoute({
      id: "npc-to-bazaar",
      label: "Buy from NPC → instant-sell to Bazaar",
      quantity: input.quantity,
      unitCost: input.npcBuyPrice,
      unitRevenue: input.bazaarInstantSellPrice,
      feeRate: input.bazaarSellFeeRate,
      limit: input.npcBuyLimitRemaining,
      missingPrice: input.npcBuyPrice === 0 || input.bazaarInstantSellPrice === 0,
    }),
    buildRoute({
      id: "bazaar-to-npc",
      label: "Instant-buy from Bazaar → sell to NPC",
      quantity: input.quantity,
      unitCost: input.bazaarInstantBuyPrice,
      unitRevenue: input.npcSellPrice,
      feeRate: 0,
      limit: input.npcSellLimitRemaining,
      missingPrice: input.bazaarInstantBuyPrice === 0 || input.npcSellPrice === 0,
    }),
  ].sort(
    (left, right) =>
      Number(right.eligible) - Number(left.eligible) ||
      right.netProfit - left.netProfit ||
      lexicalCompare(left.id, right.id),
  );
  const eligible = routes.filter((route) => route.eligible);

  return {
    routes,
    bestEligibleRoute: eligible[0] ?? null,
    bestPositiveRoute: eligible.find((route) => route.netProfit > 0) ?? null,
    disclaimer:
      "NPC/Bazaar comparisons are planning estimates from entered prices and limits. Verify current in-game eligibility, caps, taxes, inventory space, and executable prices; no profit is guaranteed.",
  };
}

function buildRoute(input: {
  id: NpcBazaarRouteId;
  label: string;
  quantity: number;
  unitCost: number;
  unitRevenue: number;
  feeRate: number;
  limit?: number | null;
  missingPrice: boolean;
}): NpcBazaarRouteResult {
  const cost = input.quantity * input.unitCost;
  const grossRevenue = input.quantity * input.unitRevenue;
  const fees = grossRevenue * input.feeRate;
  const netProfit = grossRevenue - fees - cost;
  const blockers: string[] = [];
  if (input.missingPrice) blockers.push("Both route prices must be entered");
  if (input.limit === null || input.limit === undefined) blockers.push("NPC limit is unverified");
  else if (input.quantity > input.limit) blockers.push(`Quantity exceeds the entered remaining NPC limit of ${round(input.limit, 2)}`);
  return {
    id: input.id,
    label: input.label,
    quantity: round(input.quantity, 2),
    cost: round(cost),
    grossRevenue: round(grossRevenue),
    fees: round(fees),
    netProfit: round(netProfit),
    returnOnCost: cost === 0 ? null : round(netProfit / cost, 4),
    eligible: blockers.length === 0,
    blockers,
  };
}

function validateOptionalLimit(value: number | null | undefined, name: string): void {
  if (value !== null && value !== undefined) assertNonNegative(value, name);
}
