const BASELINE_CSP =
  "base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'";

/**
 * Adds browser hardening headers without constraining Vinext scripts, styles,
 * images, fetches, or authentication redirects. HSTS is valid only on HTTPS.
 */
export function withBrowserSecurityHeaders(
  response: Response,
  requestUrl: URL,
): Response {
  // Switching-protocol responses cannot be reconstructed with the standard
  // Response constructor. SkyPilot has no application WebSocket route.
  if (response.status === 101) return response;

  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", `${BASELINE_CSP}; ${connectSourcePolicy()}`);
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  if (requestUrl.protocol === "https:") {
    headers.set("Strict-Transport-Security", "max-age=31536000");
  } else {
    headers.delete("Strict-Transport-Security");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function connectSourcePolicy(): string {
  const sources = ["'self'"];
  const configured = process.env.PLAYER_GATEWAY_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" && !url.username && !url.password) {
        sources.push(url.origin);
      }
    } catch {
      // Invalid deployment values must not widen the browser policy.
    }
  }
  return `connect-src ${sources.join(" ")}`;
}
