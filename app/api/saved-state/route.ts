import {
  MAX_FAVORITES,
  MAX_LINKED_ACCOUNTS,
  MAX_SAVED_BUILDS,
  MAX_SAVED_PROFILES,
  defaultSavedPreferences,
  normalizePreferences,
} from "@/lib/saved-state/validation";
import {
  accountView,
  authenticatedSavedStateContext,
  favoriteView,
  ownerBuildView,
  privateJson,
  savedProfileView,
  savedStateFailure,
} from "./shared";

export async function GET() {
  const context = await authenticatedSavedStateContext(false);
  if (!context.ok) return context.response;
  if (!context.userId) return privateJson({ data: {
    accountExists: false,
    accounts: [],
    profiles: [],
    builds: [],
    favorites: [],
    preferences: { ...defaultSavedPreferences },
  } });

  try {
    const [accounts, profiles, builds, favorites, preferences] = await Promise.all([
      context.repositories.profiles.listLinkedMinecraftAccounts(context.userId, MAX_LINKED_ACCOUNTS),
      context.repositories.profiles.listSavedProfileDetails(context.userId, MAX_SAVED_PROFILES),
      context.repositories.userContent.listBuilds(context.userId, MAX_SAVED_BUILDS),
      context.repositories.userContent.listFavorites(context.userId, MAX_FAVORITES),
      context.repositories.identity.getPreferences(context.userId, "site"),
    ]);
    const buildViews = builds.flatMap((build) => {
      const view = ownerBuildView(build);
      return view ? [view] : [];
    });
    return privateJson({ data: {
      accountExists: true,
      accounts: accounts.map(accountView),
      profiles: profiles.map(savedProfileView),
      builds: buildViews,
      favorites: favorites.map(favoriteView),
      preferences: normalizePreferences(preferences.settings),
      meta: { skippedMalformedBuilds: builds.length - buildViews.length },
    } });
  } catch (error) {
    return savedStateFailure(error);
  }
}
