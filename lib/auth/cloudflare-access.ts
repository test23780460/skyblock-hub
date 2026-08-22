import { createRemoteJWKSet, jwtVerify } from "jose";

const ACCESS_ASSERTION_HEADER = "cf-access-jwt-assertion";
const ACCESS_PROVIDER = "cloudflare-access" as const;
const LOGIN_PATH = "/auth/login";
const LOGOUT_PATH = "/cdn-cgi/access/logout";
const MAX_ASSERTION_LENGTH = 16_384;

export type AuthenticatedUser = {
  provider: typeof ACCESS_PROVIDER;
  providerSubject: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export type HeaderReader = { get(name: string): string | null };

let cachedJwksOrigin = "";
let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export async function verifiedCloudflareAccessUser(
  requestHeaders: HeaderReader,
  environment: Record<string, string | undefined> = process.env,
): Promise<AuthenticatedUser | null> {
  const assertion = requestHeaders.get(ACCESS_ASSERTION_HEADER)?.trim();
  if (!assertion || assertion.length > MAX_ASSERTION_LENGTH) return null;

  const configuration = accessConfiguration(environment);
  if (!configuration) return null;

  try {
    const { payload } = await jwtVerify(
      assertion,
      accessKeySet(configuration.issuer),
      {
        issuer: configuration.issuer,
        audience: configuration.audience,
        algorithms: ["RS256"],
      },
    );
    const providerSubject = boundedClaim(payload.sub, 512);
    const email = boundedEmail(payload.email);
    if (!providerSubject || !email) return null;
    const fullName = boundedClaim(payload.name, 120);
    return {
      provider: ACCESS_PROVIDER,
      providerSubject,
      displayName: fullName ?? email,
      email,
      fullName,
    };
  } catch {
    return null;
  }
}

export function accountSignInPath(returnTo: string): string {
  return `${LOGIN_PATH}?return_to=${encodeURIComponent(safeAuthReturnPath(returnTo))}`;
}

export function accountSignOutPath(): string {
  return LOGOUT_PATH;
}

export function safeAuthReturnPath(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/";
  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local" || isReservedAuthPath(url.pathname)) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}

export function isCloudflareAccessConfigured(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return configuredAuthProvider(environment) === ACCESS_PROVIDER && Boolean(accessConfiguration(environment));
}

function configuredAuthProvider(environment: Record<string, string | undefined>): string {
  return environment.AUTH_PROVIDER?.trim().toLowerCase() ?? "";
}

function accessConfiguration(
  environment: Record<string, string | undefined>,
): { issuer: string; audience: string } | null {
  const rawTeamDomain = environment.CF_ACCESS_TEAM_DOMAIN?.trim();
  const audience = environment.CF_ACCESS_AUD?.trim();
  if (!rawTeamDomain || !audience || audience.length > 512) return null;
  let teamDomain: URL;
  try {
    teamDomain = new URL(rawTeamDomain);
  } catch {
    return null;
  }
  if (
    teamDomain.protocol !== "https:" ||
    teamDomain.username ||
    teamDomain.password ||
    teamDomain.pathname !== "/" ||
    teamDomain.search ||
    teamDomain.hash ||
    !teamDomain.hostname.endsWith(".cloudflareaccess.com") ||
    rawTeamDomain !== teamDomain.origin
  ) {
    return null;
  }
  return { issuer: teamDomain.origin, audience };
}

function accessKeySet(issuer: string): ReturnType<typeof createRemoteJWKSet> {
  if (!cachedJwks || cachedJwksOrigin !== issuer) {
    cachedJwksOrigin = issuer;
    cachedJwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
  }
  return cachedJwks;
}

function boundedClaim(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maximum ? normalized : null;
}

function boundedEmail(value: unknown): string | null {
  const normalized = boundedClaim(value, 320)?.toLowerCase() ?? null;
  return normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized) ? normalized : null;
}

function isReservedAuthPath(pathname: string): boolean {
  return pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`) || pathname === LOGOUT_PATH;
}
