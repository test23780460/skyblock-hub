import { sameOriginMutationFailure } from "@/lib/auth/same-origin";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { parseSavedProfileUpdate, safeProfileId } from "@/lib/saved-state/validation";
import {
  authenticatedSavedStateContext,
  invalidSavedState,
  privateJson,
  savedProfileView,
  savedStateFailure,
  savedStateNotFound,
  withPrivateNoStore,
} from "../../saved-state/shared";

type RouteContext = { params: Promise<{ profileId: string }> | { profileId: string } };

export async function PATCH(request: Request, routeContext: RouteContext) {
  const crossOrigin = sameOriginMutationFailure(request);
  if (crossOrigin) return crossOrigin;
  const profileId = safeProfileId((await routeContext.params).profileId);
  if (!profileId) return invalidSavedState("The saved profile identifier is invalid.");
  const context = await authenticatedSavedStateContext(false);
  if (!context.ok) return context.response;
  if (!context.userId) return savedStateNotFound("Saved profile");
  const parsedBody = await readBoundedJson<unknown>(request, 2_048);
  if (!parsedBody.ok) return withPrivateNoStore(parsedBody.response);
  const parsed = parseSavedProfileUpdate(parsedBody.value);
  if (!parsed.ok) return invalidSavedState(parsed.message);
  try {
    const existing = await context.repositories.profiles.getSavedProfile(context.userId, profileId);
    if (!existing) return savedStateNotFound("Saved profile");
    await context.repositories.profiles.saveProfile(context.userId, profileId, {
      alias: parsed.value.alias === undefined ? existing.alias : parsed.value.alias,
      isPinned: parsed.value.isPinned ?? existing.isPinned,
    });
    const updated = await context.repositories.profiles.getSavedProfile(context.userId, profileId);
    if (!updated) return savedStateNotFound("Saved profile");
    return privateJson({ data: { profile: savedProfileView(updated) } });
  } catch (error) {
    return savedStateFailure(error);
  }
}

export async function DELETE(request: Request, routeContext: RouteContext) {
  const crossOrigin = sameOriginMutationFailure(request);
  if (crossOrigin) return crossOrigin;
  const profileId = safeProfileId((await routeContext.params).profileId);
  if (!profileId) return invalidSavedState("The saved profile identifier is invalid.");
  const context = await authenticatedSavedStateContext(false);
  if (!context.ok) return context.response;
  if (!context.userId) return savedStateNotFound("Saved profile");
  try {
    const deleted = await context.repositories.profiles.deleteSavedProfile(context.userId, profileId);
    if (!deleted) return savedStateNotFound("Saved profile");
    await context.repositories.userContent.removeFavorite(context.userId, "profile", profileId);
    return privateJson({ data: { deleted: true, profileId } });
  } catch (error) {
    return savedStateFailure(error);
  }
}
