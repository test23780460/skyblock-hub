/**
 * Account deletion is browser-only and destructive, so require an explicit
 * Origin header that exactly matches the public Request URL exposed by Sites.
 * This deliberately does not trust Host or forwarded-host headers.
 */
export function hasExactRequestOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
