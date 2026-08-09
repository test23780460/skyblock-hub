import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isAdminUser } from "@/lib/auth/admin";
import { sameOriginMutationFailure } from "@/lib/auth/same-origin";
import { sharedProviderCache } from "@/lib/cache/ttl-cache";
import { featureFlags } from "@/lib/config";
import { featureUnavailableResponse } from "@/lib/feature-access";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { refreshBazaar, refreshEndedAuctions } from "@/worker/jobs";

const allowedActions = new Set(["refresh-bazaar", "refresh-ended-auctions", "clear-economy-cache"]);

export async function POST(request: Request) {
  const unavailable = featureUnavailableResponse("chatGptAuth");
  if (unavailable) return unavailable;
  const crossOrigin = sameOriginMutationFailure(request);
  if (crossOrigin) return crossOrigin;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: { code: "authentication_required", message: "Sign in to use admin controls." } }, { status: 401 });
  if (!isAdminUser(user)) return Response.json({ error: { code: "forbidden", message: "This identity is not authorized for admin controls." } }, { status: 403 });
  const parsed = await readBoundedJson<{ action?: unknown }>(request, 2_048);
  if (!parsed.ok) return parsed.response;
  const action = typeof parsed.value.action === "string" ? parsed.value.action : "";
  if (!allowedActions.has(action)) return Response.json({ error: { code: "invalid_action", message: "That admin action is not available." } }, { status: 400 });
  try {
    if (action === "refresh-bazaar") {
      if (!featureFlags.publicEconomy) return featureUnavailableResponse("publicEconomy")!;
      const result = await refreshBazaar();
      return Response.json({ data: { message: "Bazaar job " + result.status + " with " + result.records + " normalized products." } });
    }
    if (action === "refresh-ended-auctions") {
      if (!featureFlags.publicEconomy) return featureUnavailableResponse("publicEconomy")!;
      const result = await refreshEndedAuctions();
      return Response.json({ data: { message: "Ended-auction job " + result.status + " with " + result.records + " normalized records." } });
    }
    const deleted = await sharedProviderCache.deleteByPrefix("hypixel:economy:");
    return Response.json({ data: { message: "Cleared " + deleted + " economy cache entries in this runtime." } });
  } catch {
    return Response.json({ error: { code: "admin_action_failed", message: "The safe admin action could not complete. Upstream backoff remains in force." } }, { status: 503 });
  }
}
