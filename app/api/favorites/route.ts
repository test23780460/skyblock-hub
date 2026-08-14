import { sameOriginMutationFailure } from "@/lib/auth/same-origin";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { getModuleDefinition } from "@/lib/module-catalog";
import type { RepositoryProvider } from "@/lib/repositories/contracts";
import {
  MAX_FAVORITES,
  parseFavorite,
  safeBuildId,
  safeProfileId,
} from "@/lib/saved-state/validation";
import {
  authenticatedSavedStateContext,
  favoriteView,
  invalidSavedState,
  privateJson,
  savedStateFailure,
  savedStateNotFound,
  withPrivateNoStore,
} from "../saved-state/shared";

export async function GET() {
  const context = await authenticatedSavedStateContext(false);
  if (!context.ok) return context.response;
  if (!context.userId) return privateJson({ data: { favorites: [] } });
  try {
    const favorites = await context.repositories.userContent.listFavorites(context.userId, MAX_FAVORITES);
    return privateJson({ data: { favorites: favorites.map(favoriteView) } });
  } catch (error) {
    return savedStateFailure(error);
  }
}

export async function POST(request: Request) {
  const crossOrigin = sameOriginMutationFailure(request);
  if (crossOrigin) return crossOrigin;
  const context = await authenticatedSavedStateContext(true);
  if (!context.ok) return context.response;
  if (!context.userId) return savedStateFailure(new Error("Canonical user was not created"));
  const body = await readBoundedJson<unknown>(request, 4_096);
  if (!body.ok) return withPrivateNoStore(body.response);
  const parsed = parseFavorite(body.value);
  if (!parsed.ok) return invalidSavedState(parsed.message);
  try {
    const accessible = await favoriteTargetIsAccessible(
      context.repositories,
      context.userId,
      parsed.value.resourceType,
      parsed.value.resourceId,
    );
    if (!accessible) return savedStateNotFound("Favorite target");
    const existing = await context.repositories.userContent.listFavorites(context.userId, MAX_FAVORITES);
    const duplicate = existing.find((favorite) =>
      favorite.resourceType === parsed.value.resourceType && favorite.resourceId === parsed.value.resourceId
    );
    if (!duplicate && existing.length >= MAX_FAVORITES) {
      return privateJson({ error: {
        code: "favorite_limit_reached",
        message: `Remove a favorite before saving more than ${MAX_FAVORITES}.`,
      } }, 409);
    }
    const favorite = await context.repositories.userContent.addFavorite({
      id: duplicate?.id ?? `favorite_${crypto.randomUUID()}`,
      userId: context.userId,
      ...parsed.value,
    });
    return privateJson({ data: { favorite: favoriteView(favorite) } }, duplicate ? 200 : 201);
  } catch (error) {
    return savedStateFailure(error);
  }
}

export async function DELETE(request: Request) {
  const crossOrigin = sameOriginMutationFailure(request);
  if (crossOrigin) return crossOrigin;
  const context = await authenticatedSavedStateContext(false);
  if (!context.ok) return context.response;
  if (!context.userId) return privateJson({ data: { removed: false } });
  const body = await readBoundedJson<unknown>(request, 4_096);
  if (!body.ok) return withPrivateNoStore(body.response);
  const parsed = parseFavorite(body.value);
  if (!parsed.ok) return invalidSavedState(parsed.message);
  try {
    const removed = await context.repositories.userContent.removeFavorite(
      context.userId,
      parsed.value.resourceType,
      parsed.value.resourceId,
    );
    return privateJson({ data: {
      removed,
      resourceType: parsed.value.resourceType,
      resourceId: parsed.value.resourceId,
    } });
  } catch (error) {
    return savedStateFailure(error);
  }
}

async function favoriteTargetIsAccessible(
  repositories: RepositoryProvider,
  userId: string,
  resourceType: "tool" | "recommendation" | "profile" | "build",
  resourceId: string,
): Promise<boolean> {
  if (resourceType === "tool") {
    return Boolean(getModuleDefinition(resourceId)) || ["dashboard", "goals", "builds"].includes(resourceId);
  }
  if (resourceType === "profile") {
    const profileId = safeProfileId(resourceId);
    return Boolean(profileId && await repositories.profiles.getSavedProfile(userId, profileId));
  }
  if (resourceType === "build") {
    const buildId = safeBuildId(resourceId);
    return Boolean(buildId && await repositories.userContent.getBuild(userId, buildId));
  }
  return true;
}
