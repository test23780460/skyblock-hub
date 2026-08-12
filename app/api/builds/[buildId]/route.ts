import { sameOriginMutationFailure } from "@/lib/auth/same-origin";
import { readBoundedJson } from "@/lib/http/bounded-json";
import {
  buildRecord,
  parseBuildMutation,
  resolveShareSlug,
  safeBuildId,
} from "@/lib/saved-state/validation";
import {
  authenticatedSavedStateContext,
  invalidSavedState,
  ownerBuildView,
  privateJson,
  savedStateFailure,
  savedStateNotFound,
  withPrivateNoStore,
} from "../../saved-state/shared";

type RouteContext = { params: Promise<{ buildId: string }> | { buildId: string } };

export async function GET(_request: Request, routeContext: RouteContext) {
  const buildId = safeBuildId((await routeContext.params).buildId);
  if (!buildId) return invalidSavedState("The saved build identifier is invalid.");
  const context = await authenticatedSavedStateContext(false);
  if (!context.ok) return context.response;
  if (!context.userId) return savedStateNotFound("Saved build");
  try {
    const build = await context.repositories.userContent.getBuild(context.userId, buildId);
    if (!build) return savedStateNotFound("Saved build");
    const view = ownerBuildView(build);
    return view ? privateJson({ data: { build: view } }) : savedStateFailure(new Error("Saved build data is malformed"));
  } catch (error) {
    return savedStateFailure(error);
  }
}

export async function PATCH(request: Request, routeContext: RouteContext) {
  const crossOrigin = sameOriginMutationFailure(request);
  if (crossOrigin) return crossOrigin;
  const buildId = safeBuildId((await routeContext.params).buildId);
  if (!buildId) return invalidSavedState("The saved build identifier is invalid.");
  const context = await authenticatedSavedStateContext(false);
  if (!context.ok) return context.response;
  if (!context.userId) return savedStateNotFound("Saved build");
  const body = await readBoundedJson<unknown>(request, 16_384);
  if (!body.ok) return withPrivateNoStore(body.response);
  const parsed = parseBuildMutation(body.value);
  if (!parsed.ok) return invalidSavedState(parsed.message);
  try {
    const existing = await context.repositories.userContent.getBuild(context.userId, buildId);
    if (!existing) return savedStateNotFound("Saved build");
    if (parsed.value.profileId) {
      const profile = await context.repositories.profiles.getSavedProfile(context.userId, parsed.value.profileId);
      if (!profile) return savedStateNotFound("Linked saved profile");
    }
    const shareSlug = resolveShareSlug(
      existing.shareSlug,
      parsed.value.visibility,
      parsed.value.rotateShareLink,
    );
    const updated = await context.repositories.userContent.updateBuild(context.userId, buildId, {
      profileId: parsed.value.profileId,
      title: parsed.value.title,
      description: parsed.value.description,
      visibility: parsed.value.visibility,
      shareSlug,
      schemaVersion: 1,
      isExperimental: true,
      build: buildRecord(parsed.value.build),
    });
    if (!updated) return savedStateNotFound("Saved build");
    const view = ownerBuildView(updated);
    return view ? privateJson({ data: { build: view } }) : savedStateFailure(new Error("Updated build data is malformed"));
  } catch (error) {
    return savedStateFailure(error);
  }
}

export async function DELETE(request: Request, routeContext: RouteContext) {
  const crossOrigin = sameOriginMutationFailure(request);
  if (crossOrigin) return crossOrigin;
  const buildId = safeBuildId((await routeContext.params).buildId);
  if (!buildId) return invalidSavedState("The saved build identifier is invalid.");
  const context = await authenticatedSavedStateContext(false);
  if (!context.ok) return context.response;
  if (!context.userId) return savedStateNotFound("Saved build");
  try {
    const deleted = await context.repositories.userContent.deleteBuild(context.userId, buildId);
    if (!deleted) return savedStateNotFound("Saved build");
    await context.repositories.userContent.removeFavorite(context.userId, "build", buildId);
    return privateJson({ data: { deleted: true, buildId } });
  } catch (error) {
    return savedStateFailure(error);
  }
}
