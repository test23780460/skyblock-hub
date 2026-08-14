import { getChatGPTUser } from "@/app/chatgpt-auth";
import { featureFlags } from "@/lib/config";
import {
  type AiEconomyContextResult,
  resolveAiContext,
} from "@/lib/ai/context";
import { AiRequestLimiter, createAiPostHandler } from "@/lib/ai/http";
import {
  parseCostRate,
  recordAiMetricAggregates,
} from "@/lib/ai/metrics";
import { OpenAiResponsesProvider } from "@/lib/providers/openai";
import { getPlayerAnalysisWithNegativeCache } from "@/lib/providers/player-request-policy";

const limiter = new AiRequestLimiter();

export const POST = createAiPostHandler({
  enabled: () => featureFlags.aiAssistant,
  authRequired: () => featureFlags.chatGptAuth,
  authenticate: async () => {
    const user = await getChatGPTUser();
    return user ? { id: user.userId } : null;
  },
  apiKey: () => process.env.OPENAI_API_KEY || "",
  model: () => process.env.OPENAI_MODEL || "gpt-5.6-luna",
  costRates: () => ({
    inputUsdPerMillion: parseCostRate(process.env.OPENAI_INPUT_COST_USD_PER_MILLION),
    outputUsdPerMillion: parseCostRate(process.env.OPENAI_OUTPUT_COST_USD_PER_MILLION),
  }),
  allowRequest: (key) => limiter.check(key),
  resolveContext: (selection) => resolveAiContext(selection, {
    playerLookupEnabled: featureFlags.playerLookup,
    economyEnabled: featureFlags.publicEconomy,
    getPlayerAnalysis: getPlayerAnalysisWithNegativeCache,
    getEconomyProducts: loadEconomyProducts,
  }),
  complete: async ({ apiKey, model, ...input }) => {
    const provider = new OpenAiResponsesProvider({ apiKey, model });
    return provider.complete(input);
  },
  recordMetric: async (event) => {
    const [{ getDb }, { DrizzleTelemetryRepository }] = await Promise.all([
      import("@/db"),
      import("@/lib/repositories/drizzle/telemetry.repository"),
    ]);
    await recordAiMetricAggregates(new DrizzleTelemetryRepository(getDb()), event);
  },
});

async function loadEconomyProducts(productIds: readonly string[]): Promise<AiEconomyContextResult> {
  const [{ getDb }, { DrizzlePublicEconomySnapshotStore }] = await Promise.all([
    import("@/db"),
    import("@/lib/repositories/drizzle/public-economy-snapshot.repository"),
  ]);
  const store = new DrizzlePublicEconomySnapshotStore(getDb());
  const results = await Promise.all(productIds.map((productId) =>
    store.readBazaarSnapshot({ query: productId, limit: 12 })
  ));
  const first = results.find((result) => result !== null);
  if (!first) return { status: "missing", message: "The Bazaar snapshot is not ready yet." };
  if (first.state.expiresAt.getTime() <= Date.now()) {
    return { status: "stale", message: "The Bazaar snapshot is stale; its prices were excluded from AI context." };
  }
  const products = results.flatMap((result, index) => {
    if (!result) return [];
    const requested = productIds[index];
    return result.products.filter((product) => product.productId === requested).slice(0, 1);
  });
  return {
    status: "available",
    sourceUpdatedAt: first.state.sourceUpdatedAt.toISOString(),
    publishedAt: first.state.publishedAt.toISOString(),
    products,
  };
}
