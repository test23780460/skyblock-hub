import { optionalProfileId } from "../../../lib/providers/guards";
import { ProviderError, providerErrorResponse } from "../../../lib/providers/errors";
import { featureUnavailableResponse } from "../../../lib/feature-access";
import {
  playerRequestLimitFailure,
} from "../../../lib/providers/player-request-policy";
import { getCloudflarePlayerAnalysis } from "../../../worker/player-runtime";

export async function GET(request: Request): Promise<Response> {
  const unavailable = featureUnavailableResponse("playerLookup");
  if (unavailable) return unavailable;
  const rateLimited = await playerRequestLimitFailure(request);
  if (rateLimited) return rateLimited;
  try {
    const url = new URL(request.url);
    const username = url.searchParams.get("username")?.trim();
    if (!username) {
      throw new ProviderError({
        code: "invalid_input",
        message: "A Minecraft username or Java UUID is required.",
        status: 400,
        action: "Add a username or UUID query parameter and try again.",
      });
    }
    const profileId = optionalProfileId(url.searchParams.get("profile"));
    const data = await getCloudflarePlayerAnalysis(
      username,
      profileId,
    );
    return playerResponse(data);
  } catch (error) {
    return providerErrorResponse(error);
  }
}

function playerResponse(data: Awaited<ReturnType<typeof getCloudflarePlayerAnalysis>>): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
