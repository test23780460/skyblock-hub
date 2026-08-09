import type { ApiFailure } from "../models";

export type ProviderErrorCode =
  | "missing_credentials"
  | "invalid_username"
  | "invalid_uuid"
  | "invalid_input"
  | "player_not_found"
  | "profile_not_found"
  | "no_skyblock_profiles"
  | "forbidden"
  | "rate_limited"
  | "upstream_unavailable"
  | "upstream_timeout"
  | "invalid_response"
  | "network_error";

type ProviderErrorOptions = {
  code: ProviderErrorCode;
  message: string;
  status: number;
  action?: string;
  retryable?: boolean;
  retryAfterSeconds?: number;
  cause?: unknown;
};

/** A classified, user-safe provider failure. Upstream bodies are never exposed. */
export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly status: number;
  readonly action?: string;
  readonly retryable: boolean;
  readonly retryAfterSeconds?: number;

  constructor(options: ProviderErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "ProviderError";
    this.code = options.code;
    this.status = options.status;
    this.action = options.action;
    this.retryable = options.retryable ?? false;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export function asProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;

  return new ProviderError({
    code: "upstream_unavailable",
    message: "A required game-data service is temporarily unavailable.",
    status: 503,
    action: "Try again in a few minutes.",
    retryable: true,
    cause: error,
  });
}

export function providerErrorPayload(error: unknown): ApiFailure {
  const classified = asProviderError(error);
  return {
    error: {
      code: classified.code,
      message: classified.message,
      ...(classified.action ? { action: classified.action } : {}),
      ...(classified.retryAfterSeconds !== undefined
        ? { retryAfterSeconds: classified.retryAfterSeconds }
        : {}),
    },
  };
}

export function providerErrorResponse(error: unknown): Response {
  const classified = asProviderError(error);
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  if (classified.retryAfterSeconds !== undefined) {
    headers.set("Retry-After", String(classified.retryAfterSeconds));
  }

  return new Response(JSON.stringify(providerErrorPayload(classified)), {
    status: classified.status,
    headers,
  });
}

