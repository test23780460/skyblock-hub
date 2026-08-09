import type { ApiFailure } from "./models";

const DEFAULT_FAILURE: ApiFailure["error"] = {
  code: "network_error",
  message: "The profile service did not respond.",
  action: "Check your connection and try again.",
};

/**
 * Accepts only the user-safe error envelope emitted by SkyPilot APIs. Native
 * errors and malformed upstream values fall back to stable display copy.
 */
export function normalizeApiFailure(
  value: unknown,
  fallback: ApiFailure["error"] = DEFAULT_FAILURE,
): ApiFailure["error"] {
  if (!value || typeof value !== "object") return { ...fallback };
  const candidate = value as Record<string, unknown>;
  const code = safeString(candidate.code, 100);
  const message = safeString(candidate.message, 500);
  if (!code || !message) return { ...fallback };
  const action = safeString(candidate.action, 500);
  const retryAfterSeconds = candidate.retryAfterSeconds;
  return {
    code,
    message,
    ...(action ? { action } : {}),
    ...(typeof retryAfterSeconds === "number" && Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0
      ? { retryAfterSeconds }
      : {}),
  };
}

function safeString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
