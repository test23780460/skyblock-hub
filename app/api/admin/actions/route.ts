import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isAdminUser } from "@/lib/auth/admin";
import { sameOriginMutationFailure } from "@/lib/auth/same-origin";
import { sharedProviderCache } from "@/lib/cache/ttl-cache";
import { featureFlags } from "@/lib/config";
import { featureUnavailableResponse } from "@/lib/feature-access";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { runPublicEconomyCycle } from "@/worker/jobs";

const allowedActions = new Set(["refresh-economy", "clear-economy-cache"]);

export async function POST(request: Request) {
  const unavailable = featureUnavailableResponse("chatGptAuth");
  if (unavailable) return unavailable;
  const crossOrigin = sameOriginMutationFailure(request);
  if (crossOrigin) return crossOrigin;
  const user = await getChatGPTUser();
  if (!user) return adminJson({ error: { code: "authentication_required", message: "Sign in to use admin controls." } }, 401);
  if (!isAdminUser(user)) return adminJson({ error: { code: "forbidden", message: "This identity is not authorized for admin controls." } }, 403);
  const parsed = await readBoundedJson<{ action?: unknown }>(request, 2_048);
  if (!parsed.ok) return parsed.response;
  const action = typeof parsed.value.action === "string" ? parsed.value.action : "";
  if (!allowedActions.has(action)) return adminJson({ error: { code: "invalid_action", message: "That admin action is not available." } }, 400);
  try {
    if (action === "refresh-economy") {
      if (!featureFlags.publicEconomy) return featureUnavailableResponse("publicEconomy")!;
      const [{ getDb }, { DrizzlePublicEconomySnapshotStore }] = await Promise.all([
        import("@/db"),
        import("@/lib/repositories/drizzle/public-economy-snapshot.repository"),
      ]);
      const result = await runPublicEconomyCycle({
        store: new DrizzlePublicEconomySnapshotStore(getDb()),
        owner: `admin_${crypto.randomUUID()}`,
      });
      const records = result.jobs.reduce((sum, job) => sum + job.records, 0);
      if (result.status === "failed" || result.status === "backing-off") {
        const retryAfter = result.retryAfterSeconds;
        return adminJson({ error: {
          code: result.errorCode || "economy_cycle_unavailable",
          message: result.status === "backing-off" ? "The durable economy circuit is backing off." : "The elected economy cycle failed safely.",
          action: "Keep serving the last complete snapshot and retry after the recorded backoff.",
          ...(retryAfter ? { retryAfterSeconds: retryAfter } : {}),
        } }, result.status === "backing-off" ? 429 : 503, retryAfter);
      }
      return adminJson({ data: {
        message: result.status === "skipped"
          ? "Another elected economy cycle is already running. No duplicate upstream work was started."
          : `Economy cycle completed across ${result.jobs.length} feeds with ${records} normalized records.`,
        status: result.status,
        feeds: result.jobs.map((job) => ({ feed: job.job, status: job.status, records: job.records })),
      } }, result.status === "skipped" ? 202 : 200);
    }
    const deleted = await sharedProviderCache.deleteByPrefix("hypixel:economy:");
    return adminJson({ data: { message: "Cleared " + deleted + " economy cache entries in this runtime." } });
  } catch {
    return adminJson({ error: { code: "admin_action_failed", message: "The safe admin action could not complete. Upstream backoff remains in force." } }, 503);
  }
}

function adminJson(data: unknown, status = 200, retryAfterSeconds?: number): Response {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  if (retryAfterSeconds) headers.set("Retry-After", String(retryAfterSeconds));
  return Response.json(data, { status, headers });
}
