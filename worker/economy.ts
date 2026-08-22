/** Private Cloudflare Worker entry point for public-resource economy ingestion. */
import { runCloudflarePublicEconomyCycle } from "./economy-runtime";

const INTERNAL_REFRESH_PATH = "/internal/economy/refresh";

const worker = {
  async fetch(request: Request, env: EconomyEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== INTERNAL_REFRESH_PATH) {
      return json({ error: { code: "not_found", message: "Not found." } }, 404);
    }
    if (request.method !== "POST") {
      return json(
        { error: { code: "method_not_allowed", message: "Method not allowed." } },
        405,
        { Allow: "POST" },
      );
    }
    if (env.ENABLE_PUBLIC_ECONOMY !== "true") {
      return json({ error: {
        code: "economy_disabled",
        message: "Public economy ingestion is disabled for this deployment.",
      } }, 503);
    }
    return runEconomyCycleResponse(env.DB);
  },

  scheduled(
    _controller: ScheduledController,
    env: EconomyEnv,
    ctx: ExecutionContext,
  ): void {
    if (env.ENABLE_PUBLIC_ECONOMY !== "true") return;
    ctx.waitUntil(runScheduledEconomyCycle(env.DB));
  },
} satisfies ExportedHandler<EconomyEnv>;

export default worker;

async function runEconomyCycleResponse(binding: D1Database): Promise<Response> {
  try {
    const result = await runCloudflarePublicEconomyCycle(binding);
    const records = result.jobs.reduce((sum, job) => sum + job.records, 0);
    if (result.status === "failed" || result.status === "backing-off") {
      const retryAfter = result.retryAfterSeconds;
      return json({ error: {
        code: boundedErrorCode(result.errorCode) || "economy_cycle_unavailable",
        message: result.status === "backing-off"
          ? "The durable economy circuit is backing off."
          : "The elected economy cycle failed safely.",
        action: "Keep serving the last complete snapshot and retry after the recorded backoff.",
        ...(retryAfter ? { retryAfterSeconds: retryAfter } : {}),
      } }, result.status === "backing-off" ? 429 : 503, retryAfter
        ? { "Retry-After": String(retryAfter) }
        : undefined);
    }
    return json({ data: {
      message: result.status === "skipped"
        ? "Another elected economy cycle is already running. No duplicate upstream work was started."
        : `Economy cycle completed across ${result.jobs.length} feeds with ${records} normalized records.`,
      status: result.status,
      feeds: result.jobs.map((job) => ({
        feed: job.job,
        status: job.status,
        records: job.records,
      })),
    } }, result.status === "skipped" ? 202 : 200);
  } catch {
    console.error(JSON.stringify({
      event: "skypilot.economy_cycle",
      status: "failed",
      errorCode: "economy_cycle_unhandled",
    }));
    return json({ error: {
      code: "economy_cycle_unhandled",
      message: "The elected economy cycle failed safely.",
      action: "Keep serving the last complete snapshot and try again later.",
    } }, 503);
  }
}

async function runScheduledEconomyCycle(binding: D1Database): Promise<void> {
  const startedAt = Date.now();
  try {
    const result = await runCloudflarePublicEconomyCycle(binding);
    console.log(JSON.stringify({
      event: "skypilot.economy_cycle",
      status: result.status,
      jobCount: result.jobs.length,
      completedJobCount: result.jobs.filter((job) => job.status === "completed").length,
      skippedJobCount: result.jobs.filter((job) => job.status === "skipped").length,
      durationMs: Date.now() - startedAt,
      errorCode: boundedErrorCode(result.errorCode),
    }));
  } catch (error) {
    console.error(JSON.stringify({
      event: "skypilot.economy_cycle",
      status: "failed",
      jobCount: 0,
      completedJobCount: 0,
      skippedJobCount: 0,
      durationMs: Date.now() - startedAt,
      errorCode: "economy_cycle_unhandled",
    }));
    throw error;
  }
}

function json(
  data: unknown,
  status: number,
  extraHeaders?: HeadersInit,
): Response {
  return Response.json(data, {
    status,
    headers: new Headers({
      "Cache-Control": "private, no-store",
      ...Object.fromEntries(new Headers(extraHeaders).entries()),
    }),
  });
}

function boundedErrorCode(value: string | undefined): string | null {
  if (!value) return null;
  return value.replace(/[^a-z0-9_-]/gi, "_").slice(0, 64);
}
