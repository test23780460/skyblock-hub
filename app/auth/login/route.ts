import { getCurrentUser, safeAuthReturnPath } from "@/lib/auth/current-user";

export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json(
      {
        error: {
          code: "authentication_required",
          message: "Cloudflare Access authentication is required.",
          action: "Protect this route with the configured Cloudflare Access application.",
        },
      },
      { status: 401, headers: { "cache-control": "private, no-store" } },
    );
  }
  const returnTo = safeAuthReturnPath(new URL(request.url).searchParams.get("return_to"));
  return new Response(null, {
    status: 302,
    headers: { location: returnTo, "cache-control": "private, no-store" },
  });
}
