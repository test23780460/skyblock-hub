import { getCurrentUser } from "@/lib/auth/current-user";
import { isAdminUser } from "@/lib/auth/admin";
import { sameOriginMutationFailure } from "@/lib/auth/same-origin";
import { featureFlags } from "@/lib/config";
import { featureUnavailableResponse } from "@/lib/feature-access";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { requestEconomyRefresh } from "@/lib/platform/cloudflare/economy-service";

const allowedActions = new Set(["refresh-economy"]);

export async function POST(request: Request) {
  const unavailable = featureUnavailableResponse("accountAuth");
  if (unavailable) return unavailable;
  const crossOrigin = sameOriginMutationFailure(request);
  if (crossOrigin) return crossOrigin;
  const user = await getCurrentUser();
  if (!user) return adminJson({ error: { code: "authentication_required", message: "Sign in to use admin controls." } }, 401);
  if (!isAdminUser(user)) return adminJson({ error: { code: "forbidden", message: "This identity is not authorized for admin controls." } }, 403);
  const parsed = await readBoundedJson<{ action?: unknown }>(request, 2_048);
  if (!parsed.ok) return parsed.response;
  const action = typeof parsed.value.action === "string" ? parsed.value.action : "";
  if (!allowedActions.has(action)) return adminJson({ error: { code: "invalid_action", message: "That admin action is not available." } }, 400);
  try {
    if (!featureFlags.publicEconomy) return featureUnavailableResponse("publicEconomy")!;
    const { env } = await import("cloudflare:workers");
    return requestEconomyRefresh(env.ECONOMY_SERVICE);
  } catch {
    return adminJson({ error: { code: "admin_action_failed", message: "The safe admin action could not complete. Upstream backoff remains in force." } }, 503);
  }
}

function adminJson(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
