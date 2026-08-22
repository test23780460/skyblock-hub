import { sameOriginMutationFailure } from "@/lib/auth/same-origin";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { parseLinkedAccountUpdate, safeMinecraftAccountId } from "@/lib/saved-state/validation";
import {
  accountView,
  authenticatedSavedStateContext,
  invalidSavedState,
  privateJson,
  savedStateFailure,
  savedStateNotFound,
  withPrivateNoStore,
} from "../../saved-state/shared";

type RouteContext = { params: Promise<{ accountId: string }> | { accountId: string } };

export async function PATCH(request: Request, routeContext: RouteContext) {
  const crossOrigin = sameOriginMutationFailure(request);
  if (crossOrigin) return crossOrigin;
  const accountId = safeMinecraftAccountId((await routeContext.params).accountId);
  if (!accountId) return invalidSavedState("The linked account identifier is invalid.");
  const context = await authenticatedSavedStateContext(false);
  if (!context.ok) return context.response;
  if (!context.userId) return savedStateNotFound("Linked Minecraft account");
  const body = await readBoundedJson<unknown>(request, 2_048);
  if (!body.ok) return withPrivateNoStore(body.response);
  const parsed = parseLinkedAccountUpdate(body.value);
  if (!parsed.ok) return invalidSavedState(parsed.message);
  try {
    const updated = await context.repositories.profiles.updateLinkedMinecraftAccount(
      context.userId,
      accountId,
      parsed.value,
    );
    return updated
      ? privateJson({ data: { account: accountView(updated) } })
      : savedStateNotFound("Linked Minecraft account");
  } catch (error) {
    return savedStateFailure(error);
  }
}

export async function DELETE(request: Request, routeContext: RouteContext) {
  const crossOrigin = sameOriginMutationFailure(request);
  if (crossOrigin) return crossOrigin;
  const accountId = safeMinecraftAccountId((await routeContext.params).accountId);
  if (!accountId) return invalidSavedState("The linked account identifier is invalid.");
  const context = await authenticatedSavedStateContext(false);
  if (!context.ok) return context.response;
  if (!context.userId) return savedStateNotFound("Linked Minecraft account");
  try {
    const profiles = await context.repositories.profiles.listSavedProfileDetails(context.userId, 50);
    const linkedProfileIds = profiles
      .filter((profile) => profile.minecraftAccountId === accountId)
      .map((profile) => profile.profileId);
    const deleted = await context.repositories.profiles.unlinkMinecraftAccount(context.userId, accountId);
    if (!deleted) return savedStateNotFound("Linked Minecraft account");
    await Promise.all(linkedProfileIds.map((profileId) =>
      context.repositories.userContent.removeFavorite(context.userId!, "profile", profileId)
    ));
    return privateJson({ data: { deleted: true, accountId, removedProfileIds: linkedProfileIds } });
  } catch (error) {
    return savedStateFailure(error);
  }
}
