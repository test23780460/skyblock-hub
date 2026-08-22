import { sameOriginMutationFailure } from "@/lib/auth/same-origin";
import { readBoundedJson } from "@/lib/http/bounded-json";
import {
  defaultSavedPreferences,
  normalizePreferences,
  parsePreferences,
  preferencesRecord,
} from "@/lib/saved-state/validation";
import {
  authenticatedSavedStateContext,
  invalidSavedState,
  privateJson,
  savedStateFailure,
  withPrivateNoStore,
} from "../saved-state/shared";

const NAMESPACE = "site";
const SETTINGS_KEY = "settings";

export async function GET() {
  const context = await authenticatedSavedStateContext(false);
  if (!context.ok) return context.response;
  if (!context.userId) return privateJson({ data: { preferences: { ...defaultSavedPreferences } } });
  try {
    const preferences = await context.repositories.identity.getPreferences(context.userId, NAMESPACE);
    return privateJson({ data: { preferences: normalizePreferences(preferences[SETTINGS_KEY]) } });
  } catch (error) {
    return savedStateFailure(error);
  }
}

export async function PATCH(request: Request) {
  const crossOrigin = sameOriginMutationFailure(request);
  if (crossOrigin) return crossOrigin;
  const context = await authenticatedSavedStateContext(true);
  if (!context.ok) return context.response;
  if (!context.userId) return savedStateFailure(new Error("Canonical user was not created"));
  const body = await readBoundedJson<unknown>(request, 4_096);
  if (!body.ok) return withPrivateNoStore(body.response);
  const parsed = parsePreferences(body.value);
  if (!parsed.ok) return invalidSavedState(parsed.message);
  try {
    await context.repositories.identity.setPreference(
      `preference_${crypto.randomUUID()}`,
      context.userId,
      NAMESPACE,
      SETTINGS_KEY,
      preferencesRecord(parsed.value),
    );
    return privateJson({ data: { preferences: parsed.value } });
  } catch (error) {
    return savedStateFailure(error);
  }
}

export async function DELETE(request: Request) {
  const crossOrigin = sameOriginMutationFailure(request);
  if (crossOrigin) return crossOrigin;
  const context = await authenticatedSavedStateContext(false);
  if (!context.ok) return context.response;
  if (!context.userId) return privateJson({ data: { reset: false, preferences: { ...defaultSavedPreferences } } });
  try {
    const reset = await context.repositories.identity.deletePreference(
      context.userId,
      NAMESPACE,
      SETTINGS_KEY,
    );
    return privateJson({ data: { reset, preferences: { ...defaultSavedPreferences } } });
  } catch (error) {
    return savedStateFailure(error);
  }
}
