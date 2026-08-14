import { optionalProfileId } from "../../../../lib/providers/guards";
import { providerErrorResponse } from "../../../../lib/providers/errors";
import { featureUnavailableResponse } from "../../../../lib/feature-access";
import {
  getPlayerAnalysisWithNegativeCache,
  playerRequestActorSubject,
  playerRequestLimitFailure,
} from "../../../../lib/providers/player-request-policy";

type RouteContext = {
  params: Promise<{ username: string }> | { username: string };
};

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const unavailable = featureUnavailableResponse("playerLookup");
  if (unavailable) return unavailable;
  const rateLimited = playerRequestLimitFailure(request);
  if (rateLimited) return rateLimited;
  try {
    const { username } = await context.params;
    const profileId = optionalProfileId(
      new URL(request.url).searchParams.get("profile"),
    );
    const data = await getPlayerAnalysisWithNegativeCache(username, profileId, {
      actorSubject: playerRequestActorSubject(request),
    });
    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    return providerErrorResponse(error);
  }
}
