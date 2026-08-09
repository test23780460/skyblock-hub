import { optionalProfileId } from "../../../lib/providers/guards";
import { ProviderError, providerErrorResponse } from "../../../lib/providers/errors";
import { featureUnavailableResponse } from "../../../lib/feature-access";
import {
  getPlayerAnalysisWithNegativeCache,
  playerRequestLimitFailure,
} from "../../../lib/providers/player-request-policy";

export async function GET(request: Request): Promise<Response> {
  const unavailable = featureUnavailableResponse("playerLookup");
  if (unavailable) return unavailable;
  const rateLimited = playerRequestLimitFailure(request);
  if (rateLimited) return rateLimited;
  try {
    const url = new URL(request.url);
    const username = url.searchParams.get("username")?.trim();
    if (!username) {
      throw new ProviderError({
        code: "invalid_input",
        message: "A Minecraft username is required.",
        status: 400,
        action: "Add a username query parameter and try again.",
      });
    }
    const profileId = optionalProfileId(url.searchParams.get("profile"));
    const data = await getPlayerAnalysisWithNegativeCache(username, profileId);
    return playerResponse(data);
  } catch (error) {
    return providerErrorResponse(error);
  }
}

function playerResponse(data: Awaited<ReturnType<typeof getPlayerAnalysisWithNegativeCache>>): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
