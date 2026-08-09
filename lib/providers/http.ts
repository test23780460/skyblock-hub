import { ProviderError } from "./errors";
import {
  hypixelRateLimits,
  type HypixelRateScope,
} from "./rate-limit";

export type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type JsonRequestOptions = {
  provider: string;
  url: URL;
  fetchImplementation?: FetchImplementation;
  headers?: HeadersInit;
  timeoutMs?: number;
  maxResponseCharacters?: number;
  hypixelRateScope?: HypixelRateScope;
  notFoundError?: ProviderError;
};

export async function requestJson(
  options: JsonRequestOptions,
): Promise<unknown> {
  assertServerRuntime();
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const maxResponseCharacters = options.maxResponseCharacters ?? 16_000_000;

  if (options.hypixelRateScope) {
    hypixelRateLimits.reserve(options.hypixelRateScope);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetchImplementation(options.url, {
      method: "GET",
      headers: new Headers({
        Accept: "application/json",
        ...headersToRecord(options.headers),
      }),
      signal: controller.signal,
      redirect: "error",
    });
  } catch (error) {
    clearTimeout(timeout);
    if (controller.signal.aborted || isAbortError(error)) {
      throw new ProviderError({
        code: "upstream_timeout",
        message: `${options.provider} took too long to respond.`,
        status: 504,
        action: "Try again after a short wait.",
        retryable: true,
        cause: error,
      });
    }
    throw new ProviderError({
      code: "network_error",
      message: `${options.provider} could not be reached.`,
      status: 503,
      action: "Try again after a short wait.",
      retryable: true,
      cause: error,
    });
  }
  try {
    if (options.hypixelRateScope) {
      hypixelRateLimits.observe(
        options.hypixelRateScope,
        response.headers,
        response.status,
      );
    }

    if (!response.ok) {
      throw classifyHttpFailure(response, options);
    }

    const declaredLength = Number(response.headers.get("Content-Length"));
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > maxResponseCharacters
    ) {
      throw invalidJsonResponse(options.provider);
    }

    let text: string;
    try {
      text = await response.text();
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) {
        throw new ProviderError({
          code: "upstream_timeout",
          message: `${options.provider} took too long to respond.`,
          status: 504,
          action: "Try again after a short wait.",
          retryable: true,
          cause: error,
        });
      }
      throw new ProviderError({
        code: "invalid_response",
        message: `${options.provider} returned an unreadable response.`,
        status: 502,
        action: "Try again later.",
        retryable: true,
        cause: error,
      });
    }
    if (text.length === 0 || text.length > maxResponseCharacters) {
      throw invalidJsonResponse(options.provider);
    }

    try {
      return JSON.parse(text) as unknown;
    } catch (error) {
      throw new ProviderError({
        code: "invalid_response",
        message: `${options.provider} returned invalid JSON.`,
        status: 502,
        action: "Try again later.",
        retryable: true,
        cause: error,
      });
    }
  } finally {
    clearTimeout(timeout);
  }
}

export function assertServerRuntime(): void {
  if (typeof window === "undefined") return;
  throw new Error("Provider adapters are server-only and cannot run in a browser.");
}

function classifyHttpFailure(
  response: Response,
  options: JsonRequestOptions,
): ProviderError {
  if (response.status === 404 && options.notFoundError) {
    return options.notFoundError;
  }
  if (response.status === 429) {
    if (options.hypixelRateScope) {
      try {
        hypixelRateLimits.assertAvailable(options.hypixelRateScope);
      } catch (error) {
        if (error instanceof ProviderError) return error;
      }
    }
    return new ProviderError({
      code: "rate_limited",
      message: `${options.provider} is temporarily rate limiting SkyPilot.`,
      status: 429,
      action: "Use cached data or try again shortly.",
      retryable: true,
      retryAfterSeconds: 60,
    });
  }
  if (response.status === 403) {
    return new ProviderError({
      code: "forbidden",
      message: `${options.provider} rejected SkyPilot's server credentials.`,
      status: 503,
      action: "An administrator must verify or rotate the provider credential.",
    });
  }
  if (response.status >= 500) {
    return new ProviderError({
      code: "upstream_unavailable",
      message: `${options.provider} is temporarily unavailable.`,
      status: 503,
      action: "Try again later.",
      retryable: true,
    });
  }
  return new ProviderError({
    code: "invalid_response",
    message: `${options.provider} could not process the validated request.`,
    status: 502,
    action: "Check the input or try again later.",
    retryable: response.status >= 408,
  });
}

function invalidJsonResponse(provider: string): ProviderError {
  return new ProviderError({
    code: "invalid_response",
    message: `${provider} returned an unexpected response size.`,
    status: 502,
    action: "Try again later.",
    retryable: true,
  });
}

function headersToRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  return Object.fromEntries(new Headers(headers).entries());
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}
