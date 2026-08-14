const REQUEST_VERSION = "skypilot-player-gateway-v1";
const REQUEST_PATH = "/v1/player-analysis";
const MAX_CLOCK_SKEW_SECONDS = 30;
const HEADER_TIMESTAMP = "x-skypilot-timestamp";
const HEADER_NONCE = "x-skypilot-nonce";
const HEADER_ACTOR = "x-skypilot-actor";
const HEADER_SIGNATURE = "x-skypilot-signature";
const HEADER_RESPONSE_SIGNATURE = "x-skypilot-response-signature";

const encoder = new TextEncoder();

export const PLAYER_GATEWAY_PATH = REQUEST_PATH;

export type PlayerGatewayRequestAuth = {
  timestamp: string;
  nonce: string;
  actor: string;
  signature: string;
};

export async function opaquePlayerGatewayActor(
  secret: string,
  actorSubject: string,
): Promise<string> {
  const subject = actorSubject.trim().slice(0, 160) || "anonymous";
  return hmac(secret, `actor\n${subject}`);
}

export async function signPlayerGatewayRequest(
  secret: string,
  body: string,
  actor: string,
  options: { now?: number; nonce?: string } = {},
): Promise<Headers> {
  assertSecret(secret);
  const timestamp = String(Math.floor((options.now ?? Date.now()) / 1_000));
  const nonce = options.nonce ?? randomNonce();
  assertToken("nonce", nonce, 16, 64);
  assertToken("actor", actor, 24, 96);
  const bodyHash = await sha256(body);
  const signature = await hmac(
    secret,
    requestCanonical(timestamp, nonce, actor, bodyHash),
  );
  return new Headers({
    [HEADER_TIMESTAMP]: timestamp,
    [HEADER_NONCE]: nonce,
    [HEADER_ACTOR]: actor,
    [HEADER_SIGNATURE]: signature,
  });
}

export async function verifyPlayerGatewayRequest(
  secret: string,
  headers: Headers,
  body: string,
  now = Date.now(),
): Promise<{ ok: true; nonce: string; actor: string } | { ok: false }> {
  try {
    assertSecret(secret);
    const timestamp = requiredHeader(headers, HEADER_TIMESTAMP);
    const nonce = requiredHeader(headers, HEADER_NONCE);
    const actor = requiredHeader(headers, HEADER_ACTOR);
    const signature = requiredHeader(headers, HEADER_SIGNATURE);
    assertToken("nonce", nonce, 16, 64);
    assertToken("actor", actor, 24, 96);
    assertToken("signature", signature, 40, 96);
    const seconds = Number(timestamp);
    if (!Number.isSafeInteger(seconds)) return { ok: false };
    const nowSeconds = Math.floor(now / 1_000);
    if (Math.abs(nowSeconds - seconds) > MAX_CLOCK_SKEW_SECONDS) {
      return { ok: false };
    }
    const bodyHash = await sha256(body);
    const verified = await verifyHmac(
      secret,
      requestCanonical(timestamp, nonce, actor, bodyHash),
      signature,
    );
    return verified ? { ok: true, nonce, actor } : { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function signPlayerGatewayResponse(
  secret: string,
  status: number,
  nonce: string,
  body: string,
): Promise<string> {
  assertSecret(secret);
  const bodyHash = await sha256(body);
  return hmac(secret, responseCanonical(status, nonce, bodyHash));
}

export async function verifyPlayerGatewayResponse(
  secret: string,
  status: number,
  nonce: string,
  body: string,
  headers: Headers,
): Promise<boolean> {
  try {
    assertSecret(secret);
    assertToken("nonce", nonce, 16, 64);
    const signature = requiredHeader(headers, HEADER_RESPONSE_SIGNATURE);
    assertToken("response signature", signature, 40, 96);
    const bodyHash = await sha256(body);
    return verifyHmac(
      secret,
      responseCanonical(status, nonce, bodyHash),
      signature,
    );
  } catch {
    return false;
  }
}

export function playerGatewayResponseSignatureHeader(signature: string): Headers {
  return new Headers({ [HEADER_RESPONSE_SIGNATURE]: signature });
}

export function playerGatewayRequestAuth(headers: Headers): PlayerGatewayRequestAuth | null {
  const timestamp = headers.get(HEADER_TIMESTAMP);
  const nonce = headers.get(HEADER_NONCE);
  const actor = headers.get(HEADER_ACTOR);
  const signature = headers.get(HEADER_SIGNATURE);
  if (!timestamp || !nonce || !actor || !signature) return null;
  return { timestamp, nonce, actor, signature };
}

function requestCanonical(
  timestamp: string,
  nonce: string,
  actor: string,
  bodyHash: string,
): string {
  return [
    REQUEST_VERSION,
    "POST",
    REQUEST_PATH,
    timestamp,
    nonce,
    actor,
    bodyHash,
  ].join("\n");
}

function responseCanonical(status: number, nonce: string, bodyHash: string): string {
  return [REQUEST_VERSION, "RESPONSE", String(status), nonce, bodyHash].join("\n");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return base64Url(new Uint8Array(digest));
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await importHmacKey(secret, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return base64Url(new Uint8Array(signature));
}

async function verifyHmac(
  secret: string,
  value: string,
  signature: string,
): Promise<boolean> {
  const bytes = fromBase64Url(signature);
  const key = await importHmacKey(secret, ["verify"]);
  return crypto.subtle.verify("HMAC", key, bytes, encoder.encode(value));
}

function importHmacKey(
  secret: string,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
}

function randomNonce(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + padding);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function requiredHeader(headers: Headers, name: string): string {
  const value = headers.get(name)?.trim();
  if (!value) throw new Error("Missing gateway authentication header");
  return value;
}

function assertSecret(secret: string): void {
  if (secret.trim().length < 32) throw new Error("Gateway secret is not configured");
}

function assertToken(label: string, value: string, min: number, max: number): void {
  if (
    value.length < min ||
    value.length > max ||
    !/^[A-Za-z0-9_-]+$/u.test(value)
  ) {
    throw new Error(`Invalid ${label}`);
  }
}
