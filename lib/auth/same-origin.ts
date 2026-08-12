/**
 * Browser mutation guard. Cloudflare/Sites exposes the public URL as
 * Request.url, so comparing URL origins avoids trusting forwarded host headers.
 * These account-affecting and spend-capable endpoints are browser-only, so an
 * explicit Origin is required and must exactly match the public request URL.
 */
export function sameOriginMutationFailure(request: Request): Response | null {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();

  if (!origin || fetchSite === "cross-site") return forbidden();
  try {
    if (new URL(origin).origin !== new URL(request.url).origin) return forbidden();
  } catch {
    return forbidden();
  }

  return null;
}

function forbidden(): Response {
  return Response.json(
    {
      error: {
        code: "cross_origin_request_blocked",
        message: "This browser request did not originate from SkyPilot.",
      },
    },
    { status: 403, headers: { "cache-control": "no-store" } },
  );
}
