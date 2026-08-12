import { sameOriginMutationFailure } from "@/lib/auth/same-origin";
import { featureUnavailableResponse } from "@/lib/feature-access";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { providerErrorResponse } from "@/lib/providers/errors";
import {
  getPlayerAnalysisWithNegativeCache,
  playerRequestLimitFailure,
} from "@/lib/providers/player-request-policy";
import {
  MAX_LINKED_ACCOUNTS,
  MAX_SAVED_PROFILES,
  parseSavedProfileCreate,
} from "@/lib/saved-state/validation";
import {
  authenticatedSavedStateContext,
  invalidSavedState,
  privateJson,
  savedProfileView,
  savedStateFailure,
  withPrivateNoStore,
} from "../saved-state/shared";

export async function POST(request: Request) {
  const crossOrigin = sameOriginMutationFailure(request);
  if (crossOrigin) return crossOrigin;
  const lookupUnavailable = featureUnavailableResponse("playerLookup");
  if (lookupUnavailable) return withPrivateNoStore(lookupUnavailable);
  const context = await authenticatedSavedStateContext(true);
  if (!context.ok) return context.response;
  if (!context.userId) return savedStateFailure(new Error("Canonical user was not created"));
  const parsedBody = await readBoundedJson<unknown>(request, 4_096);
  if (!parsedBody.ok) return withPrivateNoStore(parsedBody.response);
  const parsed = parseSavedProfileCreate(parsedBody.value);
  if (!parsed.ok) return invalidSavedState(parsed.message);
  const rateLimited = playerRequestLimitFailure(request);
  if (rateLimited) return withPrivateNoStore(rateLimited);

  try {
    const internalProfileId = `profile_${parsed.value.profileId}`;
    const [savedProfiles, linkedAccounts, existing] = await Promise.all([
      context.repositories.profiles.listSavedProfileDetails(context.userId, MAX_SAVED_PROFILES),
      context.repositories.profiles.listLinkedMinecraftAccounts(context.userId, MAX_LINKED_ACCOUNTS),
      context.repositories.profiles.getSavedProfile(context.userId, internalProfileId),
    ]);
    if (!existing && savedProfiles.length >= MAX_SAVED_PROFILES) {
      return privateJson({ error: {
        code: "saved_profile_limit_reached",
        message: `Remove a saved profile before saving more than ${MAX_SAVED_PROFILES}.`,
      } }, 409);
    }

    const analysis = await getPlayerAnalysisWithNegativeCache(
      parsed.value.username,
      parsed.value.profileId,
    );
    const profile = analysis.profiles.find((candidate) => candidate.id === parsed.value.profileId);
    if (analysis.source !== "hypixel" || !profile) {
      return invalidSavedState("Only a profile returned by the live lookup can be saved.");
    }
    const minecraftUuid = analysis.player.uuid.replaceAll("-", "").toLowerCase();
    const accountId = `minecraft_${minecraftUuid}`;
    const alreadyLinked = linkedAccounts.find((account) => account.minecraftUuid === minecraftUuid);
    if (!alreadyLinked && linkedAccounts.length >= MAX_LINKED_ACCOUNTS) {
      return privateJson({ error: {
        code: "linked_account_limit_reached",
        message: `Unlink a Minecraft account before linking more than ${MAX_LINKED_ACCOUNTS}.`,
      } }, 409);
    }

    const account = await context.repositories.profiles.upsertMinecraftAccount({
      id: accountId,
      minecraftUuid,
      lastKnownUsername: analysis.player.username,
      usernameNormalized: analysis.player.username.toLowerCase(),
    });
    await context.repositories.profiles.linkMinecraftAccount(context.userId, account.id, {
      label: alreadyLinked?.label ?? null,
      isPrimary: parsed.value.isPrimary || alreadyLinked?.isPrimary || linkedAccounts.length === 0,
    });
    const storedProfile = await context.repositories.profiles.upsertProfile({
      id: internalProfileId,
      minecraftAccountId: account.id,
      hypixelProfileId: parsed.value.profileId,
      profileName: profile.name,
      cuteName: profile.name,
      gameMode: profile.gameMode,
      isSelected: profile.selected,
      dataState: profile.unavailable.length ? "partial" : "complete",
      lastRequestedAt: new Date(),
      lastSuccessfulFetchAt: new Date(analysis.fetchedAt),
    });
    await context.repositories.profiles.saveProfile(context.userId, storedProfile.id, {
      alias: parsed.value.alias,
      isPinned: parsed.value.isPinned,
    });
    const saved = await context.repositories.profiles.getSavedProfile(context.userId, storedProfile.id);
    if (!saved) throw new Error("Saved profile could not be read after persistence");
    return privateJson({ data: { profile: savedProfileView(saved) } }, existing ? 200 : 201);
  } catch (error) {
    const providerResponse = providerErrorResponse(error);
    if (providerResponse.status < 500 || providerResponse.status === 502 || providerResponse.status === 503) {
      return withPrivateNoStore(providerResponse);
    }
    return savedStateFailure(error);
  }
}
