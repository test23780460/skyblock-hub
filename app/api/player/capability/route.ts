import { sameOriginMutationFailure } from "@/lib/auth/same-origin";
import { featureFlags } from "@/lib/config";
import { featureUnavailableResponse } from "@/lib/feature-access";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { ProviderError, providerErrorResponse } from "@/lib/providers/errors";
import { createPlayerGatewayBrowserCapability } from "@/lib/providers/player-gateway";
import {
  playerRequestActorSubject,
  playerRequestLimitFailure,
} from "@/lib/providers/player-request-policy";

const MAX_CAPABILITY_REQUEST_BYTES = 2_048;

export async function POST(request: Request): Promise<Response> {
  const crossOrigin = sameOriginMutationFailure(request);
  if (crossOrigin) return privateResponse(crossOrigin);

  const unavailable = featureUnavailableResponse("playerLookup");
  if (unavailable) return privateResponse(unavailable);
  if (!featureFlags.browserPlayerGateway) {
    return privateResponse(providerErrorResponse(new ProviderError({
      code: "upstream_unavailable",
      message: "This deployment does not use browser-issued player capabilities.",
      status: 503,
      action: "Use the configured SkyPilot player transport.",
    })));
  }

  let origin: string;
  try {
    origin = configuredCapabilityOrigin(request);
  } catch (error) {
    return privateResponse(providerErrorResponse(error));
  }

  const rateLimited = playerRequestLimitFailure(request);
  if (rateLimited) return privateResponse(rateLimited);
  const parsed = await readBoundedJson<unknown>(
    request,
    MAX_CAPABILITY_REQUEST_BYTES,
  );
  if (!parsed.ok) return privateResponse(parsed.response);
  if (!isCapabilityInput(parsed.value)) {
    return privateResponse(providerErrorResponse(new ProviderError({
      code: "invalid_input",
      message: "The player capability request is invalid.",
      status: 400,
      action: "Provide only a Minecraft username or Java UUID and an optional profile ID.",
    })));
  }

  try {
    const data = await createPlayerGatewayBrowserCapability(
      parsed.value.player,
      parsed.value.profileId ?? null,
      origin,
      { actorSubject: playerRequestActorSubject(request) },
    );
    return privateJson({ data }, 200);
  } catch (error) {
    return privateResponse(providerErrorResponse(error));
  }
}

export function configuredCapabilityOrigin(request: Request): string {
  const configured = process.env.SITE_URL?.trim();
  if (!configured) throw missingCapabilityConfiguration();
  let origin: URL;
  try {
    origin = new URL(configured);
  } catch {
    throw missingCapabilityConfiguration();
  }
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    configured !== origin.origin ||
    new URL(request.url).origin !== origin.origin
  ) {
    throw missingCapabilityConfiguration();
  }
  return origin.origin;
}

function isCapabilityInput(
  value: unknown,
): value is { player: string; profileId?: string | null } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const input = value as Record<string, unknown>;
  return Object.keys(input).every((key) => key === "player" || key === "profileId") &&
    typeof input.player === "string" && input.player.length <= 36 &&
    (input.profileId === undefined || input.profileId === null ||
      (typeof input.profileId === "string" && input.profileId.length <= 36));
}

function missingCapabilityConfiguration(): ProviderError {
  return new ProviderError({
    code: "missing_credentials",
    message: "The browser player capability issuer is not configured.",
    status: 503,
    action: "An administrator must configure the canonical SkyPilot origin.",
  });
}

function privateJson(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function privateResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
