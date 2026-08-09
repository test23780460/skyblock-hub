import { ProviderError } from "./errors";

export type JsonObject = Record<string, unknown>;

// One-character lower bound preserves lookup support for legacy Java names;
// Minecraft Services remains the authority on whether the account exists.
const USERNAME_PATTERN = /^[A-Za-z0-9_]{1,16}$/;
const UUID_PATTERN = /^[0-9a-f]{32}$/;

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function requireObject(
  value: unknown,
  provider: string,
): JsonObject {
  if (isJsonObject(value)) return value;
  throw invalidResponse(provider);
}

export function optionalObject(value: unknown): JsonObject | null {
  return isJsonObject(value) ? value : null;
}

export function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function nonNegativeNumber(value: unknown): number | null {
  const number = finiteNumber(value);
  return number !== null && number >= 0 ? number : null;
}

export function boundedString(
  value: unknown,
  maxLength: number,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

export function normalizeMinecraftUsername(value: string): string {
  const username = value.trim();
  if (!USERNAME_PATTERN.test(username)) {
    throw new ProviderError({
      code: "invalid_username",
      message:
        "Minecraft usernames must be 1-16 characters using letters, numbers, or underscores.",
      status: 400,
      action: "Check the username and try again.",
    });
  }
  return username;
}

export function normalizeUuid(value: string): string {
  const uuid = value.trim().replaceAll("-", "").toLowerCase();
  if (!UUID_PATTERN.test(uuid)) {
    throw new ProviderError({
      code: "invalid_uuid",
      message: "The player identifier is invalid.",
      status: 400,
      action: "Search again with a valid Minecraft username.",
    });
  }
  return uuid;
}

export function optionalProfileId(value: string | null): string | null {
  if (!value) return null;
  const profileId = value.trim().replaceAll("-", "").toLowerCase();
  if (!UUID_PATTERN.test(profileId)) {
    throw new ProviderError({
      code: "invalid_input",
      message: "The requested SkyBlock profile identifier is invalid.",
      status: 400,
      action: "Choose a profile returned by the player lookup.",
    });
  }
  return profileId;
}

export function cleanMinecraftText(value: unknown, maxLength = 160): string {
  if (typeof value !== "string") return "Unknown item";
  const withoutFormatting = value.replace(/\u00a7./g, "");
  const printable = [...withoutFormatting]
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 32 && codePoint !== 127;
    })
    .join("");
  return printable.trim().slice(0, maxLength) || "Unknown item";
}

export function safeTimestamp(value: unknown): number | null {
  const timestamp = nonNegativeNumber(value);
  if (timestamp === null || timestamp > 8_640_000_000_000_000) return null;
  return timestamp;
}

export function invalidResponse(provider: string): ProviderError {
  return new ProviderError({
    code: "invalid_response",
    message: `${provider} returned data SkyPilot could not safely interpret.`,
    status: 502,
    action: "Try again later while the integration catches up.",
    retryable: true,
  });
}
