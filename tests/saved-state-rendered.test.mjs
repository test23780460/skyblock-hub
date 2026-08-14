import assert from "node:assert/strict";
import test from "node:test";

let workerPromise;

async function fetchRoute(path, init) {
  workerPromise ??= import(new URL("../dist/server/index.js", import.meta.url));
  const worker = (await workerPromise).default;
  return worker.fetch(
    new Request(new URL(path, "http://localhost"), {
      headers: { accept: "text/html", ...init?.headers },
      ...init,
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("build planner renders as an anonymous manual tool with explicit privacy choices", async () => {
  const response = await fetchRoute("/builds");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Build planner/i);
  assert.match(html, /Compose a build/i);
  assert.match(html, /Private/i);
  assert.match(html, /Unlisted/i);
  assert.match(html, /Public/i);
  assert.match(html, /user-entered planning notes/i);
  assert.match(html, /Durable saving is disabled/i);
});

test("account page renders the durable saved workspace without requiring persistence", async () => {
  const response = await fetchRoute("/account");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Saved workspace/i);
  assert.match(html, /Profiles.*preferences.*favorites.*builds/is);
  assert.match(html, /Anonymous lookup and planning remain available/i);
});

test("shared build page fails closed when account persistence is disabled", async () => {
  const response = await fetchRoute("/builds/share/share_00000000000000000000000000000001");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Shared SkyPilot build/i);
  assert.match(html, /Sharing disabled/i);
  assert.match(html, /UNVERIFIED/i);
});

test("saved-state APIs fail safely before loading a missing D1 binding", async () => {
  const routes = [
    "/api/saved-state",
    "/api/preferences",
    "/api/favorites",
    "/api/builds",
    "/api/builds/public",
    "/api/builds/shared/share_00000000000000000000000000000001",
  ];
  for (const route of routes) {
    const response = await fetchRoute(route, { headers: { accept: "application/json" } });
    assert.equal(response.status, 503, route);
    const payload = await response.json();
    assert.equal(payload.error.code, "feature_disabled", route);
    assert.equal(response.headers.get("cache-control"), "private, no-store", route);
  }
});
