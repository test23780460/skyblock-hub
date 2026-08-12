import { getChatGPTUser } from "@/app/chatgpt-auth";
import { hasExactRequestOrigin } from "@/app/api/account/origin";
import { featureUnavailableResponse } from "@/lib/feature-access";
import { createDrizzleRepositoryProvider } from "@/lib/repositories/drizzle";

export async function DELETE(request: Request): Promise<Response> {
  const unavailable = featureUnavailableResponse("chatGptAuth");
  if (unavailable) return withPrivateNoStore(unavailable);
  if (!hasExactRequestOrigin(request)) {
    return privateJson({
      error: {
        code: "cross_origin_request_blocked",
        message: "Account deletion requires a request from this exact SkyPilot origin.",
      },
    }, 403);
  }
  const identity = await getChatGPTUser();
  if (!identity) {
    return privateJson({
      error: { code: "authentication_required", message: "Sign in to delete SkyPilot account data." },
    }, 401);
  }
  const providerSubject = identity.userId;
  if (!providerSubject.trim() || providerSubject.length > 512) {
    return privateJson({
      error: { code: "invalid_identity", message: "The authenticated identity could not be validated." },
    }, 401);
  }

  try {
    const { getDb } = await import("@/db");
    const repositories = createDrizzleRepositoryProvider(getDb());
    const deleted = await repositories.identity.deleteUserByExternalIdentity("chatgpt", providerSubject);
    return privateJson({
      data: {
        deleted,
        alreadyAbsent: !deleted,
        scope: "skypilot-application-account",
        message: deleted
          ? "SkyPilot application account data was deleted. Your ChatGPT sign-in session was not changed."
          : "No SkyPilot application account data existed for this signed-in identity.",
      },
    });
  } catch (error) {
    return deletionFailure(error);
  }
}

function deletionFailure(error: unknown): Response {
  const message = error instanceof Error ? error.message : "";
  const unavailable = message.includes("D1 binding") || message.includes("no such table");
  return privateJson({
    error: {
      code: unavailable ? "persistence_not_ready" : "account_deletion_failed",
      message: unavailable
        ? "Account persistence is unavailable in this environment. No deletion was attempted."
        : "SkyPilot could not safely complete account deletion.",
      action: unavailable
        ? "Restore the database binding before trying again."
        : "Try again later; no successful deletion is being claimed.",
    },
  }, unavailable ? 503 : 500);
}

function privateJson(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}

function withPrivateNoStore(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "private, no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
