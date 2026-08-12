import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureCanonicalUser } from "@/lib/auth/canonical-user";
import { featureUnavailableResponse } from "@/lib/feature-access";
import { createDrizzleRepositoryProvider } from "@/lib/repositories/drizzle";
import type {
  FavoriteRecord,
  LinkedMinecraftAccountRecord,
  RepositoryProvider,
  SavedBuildRecord,
  SavedProfileDetailRecord,
} from "@/lib/repositories/contracts";
import { normalizeBuildConfiguration } from "@/lib/saved-state/validation";

export type SavedStateContext = {
  ok: true;
  repositories: RepositoryProvider;
  userId: string | null;
};
type SavedStateContextFailure = { ok: false; response: Response };

export async function authenticatedSavedStateContext(
  createUser: boolean,
): Promise<SavedStateContext | SavedStateContextFailure> {
  const unavailable = featureUnavailableResponse("chatGptAuth");
  if (unavailable) return { ok: false, response: withPrivateNoStore(unavailable) };
  const identity = await getChatGPTUser();
  if (!identity) {
    return { ok: false, response: privateJson({
      error: { code: "authentication_required", message: "Sign in to manage saved SkyPilot data." },
    }, 401) };
  }
  if (!identity.userId.trim() || identity.userId.length > 512) {
    return { ok: false, response: privateJson({
      error: { code: "invalid_identity", message: "The authenticated identity could not be validated." },
    }, 401) };
  }

  try {
    const { getDb } = await import("@/db");
    const repositories = createDrizzleRepositoryProvider(getDb());
    const user = createUser
      ? await ensureCanonicalUser(repositories, identity)
      : await repositories.identity.findUserByExternalIdentity("chatgpt", identity.userId);
    if (user && user.status !== "active") {
      return { ok: false, response: privateJson({
        error: { code: "account_unavailable", message: "This SkyPilot account cannot manage saved data." },
      }, 403) };
    }
    return { ok: true, repositories, userId: user?.id ?? null };
  } catch (error) {
    return { ok: false, response: savedStateFailure(error) };
  }
}

export async function publicSavedStateRepositories(): Promise<
  { ok: true; repositories: RepositoryProvider } | SavedStateContextFailure
> {
  const unavailable = featureUnavailableResponse("chatGptAuth");
  if (unavailable) return { ok: false, response: withPrivateNoStore(unavailable) };
  try {
    const { getDb } = await import("@/db");
    return { ok: true, repositories: createDrizzleRepositoryProvider(getDb()) };
  } catch (error) {
    return { ok: false, response: savedStateFailure(error) };
  }
}

export function accountView(account: LinkedMinecraftAccountRecord) {
  return {
    id: account.id,
    minecraftUuid: account.minecraftUuid,
    username: account.lastKnownUsername,
    label: account.label,
    isPrimary: account.isPrimary,
    linkedAt: account.linkedAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

export function savedProfileView(profile: SavedProfileDetailRecord) {
  return {
    id: profile.profileId,
    minecraftAccountId: profile.minecraftAccountId,
    minecraftUuid: profile.minecraftUuid,
    username: profile.lastKnownUsername,
    name: profile.cuteName ?? profile.profileName ?? "Unnamed profile",
    gameMode: profile.gameMode ?? "standard",
    alias: profile.alias,
    isPinned: profile.isPinned,
    dataState: profile.dataState,
    savedAt: profile.createdAt.toISOString(),
    lastViewedAt: profile.lastViewedAt?.toISOString() ?? null,
    lastSuccessfulFetchAt: profile.lastSuccessfulFetchAt?.toISOString() ?? null,
  };
}

export function ownerBuildView(build: SavedBuildRecord) {
  const configuration = normalizeBuildConfiguration(build.build);
  if (!configuration) return null;
  return {
    id: build.id,
    profileId: build.profileId,
    title: build.title,
    description: build.description,
    visibility: build.visibility,
    sharePath: build.shareSlug ? `/builds/share/${build.shareSlug}` : null,
    schemaVersion: build.schemaVersion,
    isExperimental: build.isExperimental,
    build: configuration,
    createdAt: build.createdAt.toISOString(),
    updatedAt: build.updatedAt.toISOString(),
  };
}

export function sharedBuildView(build: SavedBuildRecord) {
  const ownerView = ownerBuildView(build);
  if (!ownerView || ownerView.visibility === "private" || !ownerView.sharePath) return null;
  return {
    id: ownerView.id,
    title: ownerView.title,
    description: ownerView.description,
    visibility: ownerView.visibility,
    sharePath: ownerView.sharePath,
    schemaVersion: ownerView.schemaVersion,
    isExperimental: ownerView.isExperimental,
    build: ownerView.build,
    createdAt: ownerView.createdAt,
    updatedAt: ownerView.updatedAt,
  };
}

export function favoriteView(favorite: FavoriteRecord) {
  return {
    id: favorite.id,
    resourceType: favorite.resourceType,
    resourceId: favorite.resourceId,
    label: favorite.label,
    createdAt: favorite.createdAt.toISOString(),
  };
}

export function savedStateFailure(error: unknown): Response {
  const message = error instanceof Error ? error.message : "";
  const unavailable = message.includes("D1 binding") || message.includes("no such table");
  return privateJson({ error: {
    code: unavailable ? "persistence_not_ready" : "saved_state_operation_failed",
    message: unavailable
      ? "Saved-state persistence is not activated in this environment."
      : "SkyPilot could not complete the saved-state operation.",
    action: unavailable
      ? "Activate the database binding and apply the included migrations."
      : "Try again shortly.",
  } }, unavailable ? 503 : 500);
}

export function invalidSavedState(message: string): Response {
  return privateJson({ error: { code: "invalid_saved_state", message } }, 400);
}

export function savedStateNotFound(label: string): Response {
  return privateJson({ error: { code: "not_found", message: `${label} was not found.` } }, 404);
}

export function privateJson(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "cache-control": "private, no-store" } });
}

export function withPrivateNoStore(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "private, no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
