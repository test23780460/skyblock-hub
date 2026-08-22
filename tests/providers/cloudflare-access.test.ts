import assert from "node:assert/strict";
import test from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  accountSignInPath,
  accountSignOutPath,
  isCloudflareAccessConfigured,
  safeAuthReturnPath,
  verifiedCloudflareAccessUser,
} from "../../lib/auth/cloudflare-access";

const TEAM_DOMAIN = "https://skypilot.cloudflareaccess.com";
const AUDIENCE = "skypilot-access-audience";

test("Cloudflare Access configuration fails closed on noncanonical values", () => {
  assert.equal(isCloudflareAccessConfigured({
    AUTH_PROVIDER: "cloudflare-access",
    CF_ACCESS_TEAM_DOMAIN: TEAM_DOMAIN,
    CF_ACCESS_AUD: AUDIENCE,
  }), true);
  for (const domain of [
    "http://skypilot.cloudflareaccess.com",
    "https://user:password@skypilot.cloudflareaccess.com",
    "https://skypilot.cloudflareaccess.com/path",
    "https://example.com",
  ]) {
    assert.equal(isCloudflareAccessConfigured({
      AUTH_PROVIDER: "cloudflare-access",
      CF_ACCESS_TEAM_DOMAIN: domain,
      CF_ACCESS_AUD: AUDIENCE,
    }), false);
  }
  assert.equal(isCloudflareAccessConfigured({
    AUTH_PROVIDER: "sites",
    CF_ACCESS_TEAM_DOMAIN: TEAM_DOMAIN,
    CF_ACCESS_AUD: AUDIENCE,
  }), false);
});

test("Cloudflare Access accepts only a verified issuer, audience, subject, and email", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  const token = await new SignJWT({ email: "PILOT@example.com", name: "Pilot" })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(TEAM_DOMAIN)
    .setAudience(AUDIENCE)
    .setSubject("access-subject-123")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
  const originalFetch = globalThis.fetch;
  let keyRequests = 0;
  globalThis.fetch = async (input) => {
    keyRequests += 1;
    assert.equal(String(input), `${TEAM_DOMAIN}/cdn-cgi/access/certs`);
    return Response.json({ keys: [{ ...publicJwk, kid: "test-key", alg: "RS256", use: "sig" }] });
  };
  try {
    const environment = {
      AUTH_PROVIDER: "cloudflare-access",
      CF_ACCESS_TEAM_DOMAIN: TEAM_DOMAIN,
      CF_ACCESS_AUD: AUDIENCE,
    };
    const user = await verifiedCloudflareAccessUser(
      new Headers({ "cf-access-jwt-assertion": token }),
      environment,
    );
    assert.deepEqual(user, {
      provider: "cloudflare-access",
      providerSubject: "access-subject-123",
      displayName: "Pilot",
      email: "pilot@example.com",
      fullName: "Pilot",
    });
    assert.equal(keyRequests, 1);

    const wrongAudience = { ...environment, CF_ACCESS_AUD: "different-audience" };
    assert.equal(await verifiedCloudflareAccessUser(
      new Headers({ "cf-access-jwt-assertion": token }),
      wrongAudience,
    ), null);
    assert.equal(await verifiedCloudflareAccessUser(new Headers(), environment), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("account redirects remain local and reserve authentication endpoints", () => {
  assert.equal(safeAuthReturnPath("/dashboard?player=Pilot#gear"), "/dashboard?player=Pilot#gear");
  for (const unsafe of [
    "https://attacker.example",
    "//attacker.example",
    "/auth/login?return_to=/admin",
    "/cdn-cgi/access/logout",
  ]) {
    assert.equal(safeAuthReturnPath(unsafe), "/");
  }
  assert.equal(
    accountSignInPath("/goals?status=active"),
    "/auth/login?return_to=%2Fgoals%3Fstatus%3Dactive",
  );
  assert.equal(accountSignOutPath(), "/cdn-cgi/access/logout");
});
