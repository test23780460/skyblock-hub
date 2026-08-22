import { safeShareSlug } from "@/lib/saved-state/validation";
import {
  invalidSavedState,
  privateJson,
  publicSavedStateRepositories,
  savedStateFailure,
  savedStateNotFound,
  sharedBuildView,
} from "../../../saved-state/shared";

type RouteContext = { params: Promise<{ shareSlug: string }> | { shareSlug: string } };

export async function GET(_request: Request, routeContext: RouteContext) {
  const shareSlug = safeShareSlug((await routeContext.params).shareSlug);
  if (!shareSlug) return invalidSavedState("The share link is invalid.");
  const context = await publicSavedStateRepositories();
  if (!context.ok) return context.response;
  try {
    const build = await context.repositories.userContent.findSharedBuild(shareSlug);
    if (!build) return savedStateNotFound("Shared build");
    const view = sharedBuildView(build);
    return view ? privateJson({ data: { build: view } }) : savedStateNotFound("Shared build");
  } catch (error) {
    return savedStateFailure(error);
  }
}
