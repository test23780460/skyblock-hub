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
  badRequestNotFoundCode?: string;
};

export async function requestJson(
  options: JsonRequestOptions,
): Promise<unknown> {
  assertServerRuntime();
  const timeoutMs = options.timeoutMs ?? 8_000;
  const maxResponseCharacters = options.maxResponseCharacters ?? 16_000_000;

  if (options.hypixelRateScope) {
    hypixelRateLimits.reserve(options.hypixelRateScope);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    const init: RequestInit = {
      method: "GET",
      headers: new Headers({
        Accept: "application/json",
        ...headersToRecord(options.headers),
      }),
      signal: controller.signal,
      redirect: "manual",
    };
    response = options.fetchImplementation
      ? await options.fetchImplementation(options.url, init)
      : await globalThis.fetch(options.url, init);
  } catch (error) {
    clearTimeout(timeout);
    // Deployment admission adapters intentionally reject with the public,
    // classified provider contract before an outbound request is made.
    if (error instanceof ProviderError) throw error;
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
      if (await isMappedBadRequestNotFound(response, options)) {
        throw options.notFoundError;
      }
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
      text = await readBoundedResponseText(response, maxResponseCharacters);
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
    if (text.length === 0) {
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

async function readBoundedResponseText(
  response: Response,
  maxCharacters: number,
): Promise<string> {
  if (!response.body) throw new Error("Response body is missing");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let characters = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    characters += chunk.length;
    if (characters > maxCharacters) {
      await reader.cancel();
      throw new Error("Response body exceeds its bound");
    }
    text += chunk;
  }
  const finalChunk = decoder.decode();
  characters += finalChunk.length;
  if (characters > maxCharacters) throw new Error("Response body exceeds its bound");
  return text + finalChunk;
}

export function assertServerRuntime(): void {
  if (typeof window === "undefined") return;
  throw new Error("Provider adapters are server-only and cannot run in a browser.");
}

function classifyHttpFailure(
  response: Response,
  options: JsonRequestOptions,
): ProviderError {
  if (
    options.notFoundError &&
    response.status === 404
  ) {
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
      retryAfterSeconds: retryAfterSeconds(response),
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

async function isMappedBadRequestNotFound(
  response: Response,
  options: JsonRequestOptions,
): Promise<boolean> {
  if (
    response.status !== 400 ||
    !options.notFoundError ||
    !options.badRequestNotFoundCode
  ) {
    return false;
  }
  try {
    const text = await readBoundedResponseText(response, 16_384);
    const payload = JSON.parse(text) as unknown;
    return typeof payload === "object" &&
      payload !== null &&
      !Array.isArray(payload) &&
      "success" in payload &&
      payload.success === false &&
      "code" in payload &&
      payload.code === options.badRequestNotFoundCode;
  } catch {
    return false;
  }
}

function retryAfterSeconds(response: Response): number {
  const fallback = 60;
  const value = response.headers.get("Retry-After")?.trim();
  if (!value) return fallback;

  if (/^\d{1,6}$/u.test(value)) {
    return Math.min(3_600, Math.max(1, Number(value)));
  }

  const retryAt = Date.parse(value);
  if (!Number.isFinite(retryAt)) return fallback;
  const seconds = Math.ceil((retryAt - Date.now()) / 1_000);
  return seconds > 0 ? Math.min(3_600, seconds) : fallback;
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
