import { MAX_SAVED_BUILDS } from "@/lib/saved-state/validation";
import {
  privateJson,
  publicSavedStateRepositories,
  savedStateFailure,
  sharedBuildView,
} from "../../saved-state/shared";

export async function GET() {
  const context = await publicSavedStateRepositories();
  if (!context.ok) return context.response;
  try {
    const builds = await context.repositories.userContent.listPublicBuilds(Math.min(24, MAX_SAVED_BUILDS));
    const views = builds.flatMap((build) => {
      const view = sharedBuildView(build);
      return view ? [view] : [];
    });
    return privateJson({ data: { builds: views } });
  } catch (error) {
    return savedStateFailure(error);
  }
}
