import { sameOriginMutationFailure } from "@/lib/auth/same-origin";
import { readBoundedJson } from "@/lib/http/bounded-json";
import {
  buildRecord,
  MAX_SAVED_BUILDS,
  parseBuildMutation,
  resolveShareSlug,
} from "@/lib/saved-state/validation";
import {
  authenticatedSavedStateContext,
  invalidSavedState,
  ownerBuildView,
  privateJson,
  savedStateFailure,
  savedStateNotFound,
  withPrivateNoStore,
} from "../saved-state/shared";

export async function GET() {
  const context = await authenticatedSavedStateContext(false);
  if (!context.ok) return context.response;
  if (!context.userId) return privateJson({ data: { builds: [], meta: { skippedMalformed: 0 } } });
  try {
    const builds = await context.repositories.userContent.listBuilds(context.userId, MAX_SAVED_BUILDS);
    const views = builds.flatMap((build) => {
      const view = ownerBuildView(build);
      return view ? [view] : [];
    });
    return privateJson({ data: { builds: views, meta: { skippedMalformed: builds.length - views.length } } });
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
  const body = await readBoundedJson<unknown>(request, 16_384);
  if (!body.ok) return withPrivateNoStore(body.response);
  const parsed = parseBuildMutation(body.value);
  if (!parsed.ok) return invalidSavedState(parsed.message);
  try {
    const existing = await context.repositories.userContent.listBuilds(context.userId, MAX_SAVED_BUILDS);
    if (existing.length >= MAX_SAVED_BUILDS) {
      return privateJson({ error: {
        code: "saved_build_limit_reached",
        message: `Delete a build before saving more than ${MAX_SAVED_BUILDS}.`,
      } }, 409);
    }
    if (parsed.value.profileId) {
      const profile = await context.repositories.profiles.getSavedProfile(context.userId, parsed.value.profileId);
      if (!profile) return savedStateNotFound("Linked saved profile");
    }
    const build = await context.repositories.userContent.createBuild({
      id: `build_${crypto.randomUUID()}`,
      userId: context.userId,
      profileId: parsed.value.profileId,
      title: parsed.value.title,
      description: parsed.value.description,
      visibility: parsed.value.visibility,
      shareSlug: resolveShareSlug(null, parsed.value.visibility, false),
      schemaVersion: 1,
      isExperimental: true,
      build: buildRecord(parsed.value.build),
    });
    const view = ownerBuildView(build);
    if (!view) throw new Error("Created build could not be normalized");
    return privateJson({ data: { build: view } }, 201);
  } catch (error) {
    return savedStateFailure(error);
  }
}
