import assert from "node:assert/strict";

// tsx consults os.userInfo() on Windows unless geteuid exists. Match the
// provider runner so this isolated environment test remains CI-safe.
if (typeof process.geteuid !== "function") {
  Object.defineProperty(process, "geteuid", {
    configurable: true,
    value: () => 0,
  });
}
await import("tsx");

const gatewaySecret = "fixture-gateway-secret-that-is-at-least-thirty-two-characters";
const siteOrigin = "https://skypilot.example";

process.env.ENABLE_PLAYER_LOOKUP = "true";
process.env.ENABLE_BROWSER_PLAYER_GATEWAY = "true";
process.env.SITE_URL = siteOrigin;
process.env.PLAYER_GATEWAY_URL = "https://gateway.example";
process.env.PLAYER_GATEWAY_SECRET = gatewaySecret;

const { POST } = await import("../../../app/api/player/capability/route.ts");

function capabilityRequest(body, options = {}) {
  const requestOrigin = options.requestOrigin ?? siteOrigin;
  return new Request(`${requestOrigin}/api/player/capability`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: options.origin ?? siteOrigin,
      "sec-fetch-site": "same-origin",
      "cf-connecting-ip": "203.0.113.20",
    },
    body: JSON.stringify(body),
  });
}

function assertPrivate(response) {
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
}

const success = await POST(capabilityRequest({ player: "PilotFixture" }));
assert.equal(success.status, 200);
assertPrivate(success);
const successText = await success.text();
assert.equal(successText.includes(gatewaySecret), false);
const successPayload = JSON.parse(successText);
assert.equal(successPayload.data.method, "POST");
assert.equal(successPayload.data.url, "https://gateway.example/v1/player-analysis");
assert.equal(successPayload.data.body, JSON.stringify({ player: "PilotFixture" }));

const extraField = await POST(capabilityRequest({
  player: "PilotFixture",
  role: "admin",
}));
assert.equal(extraField.status, 400);
assertPrivate(extraField);
assert.equal((await extraField.text()).includes(gatewaySecret), false);

const hostileOrigin = await POST(capabilityRequest(
  { player: "PilotFixture" },
  { origin: "https://preview.skypilot.example" },
));
assert.equal(hostileOrigin.status, 403);
assertPrivate(hostileOrigin);
assert.equal((await hostileOrigin.text()).includes(gatewaySecret), false);

const wrongPublicHost = await POST(capabilityRequest(
  { player: "PilotFixture" },
  {
    origin: "https://preview.skypilot.example",
    requestOrigin: "https://preview.skypilot.example",
  },
));
assert.equal(wrongPublicHost.status, 503);
assertPrivate(wrongPublicHost);
assert.equal((await wrongPublicHost.text()).includes(gatewaySecret), false);
