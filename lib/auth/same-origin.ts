/**
 * Browser mutation guard. Cloudflare/Sites exposes the public URL as
 * Request.url, so comparing URL origins avoids trusting forwarded host headers.
 * Requests without browser provenance remain available to first-party server
 * callers, while an explicit cross-origin signal is rejected.
 */
export function sameOriginMutationFailure(request: Request): Response | null {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();

  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) return forbidden();
    } catch {
      return forbidden();
    }
  } else if (fetchSite === "cross-site") {
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
