import assert from "node:assert/strict";
import test from "node:test";

let workerPromise;

async function fetchRoute(path) {
  workerPromise ??= import(new URL("../dist/server/index.js", import.meta.url));
  const worker = (await workerPromise).default;
  return worker.fetch(
    new Request(new URL(path, "http://localhost"), {
      headers: { accept: "text/html" },
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("privacy notice renders the implemented data boundaries and controls", async () => {
  const response = await fetchRoute("/privacy");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /EFFECTIVE.{0,24}AUGUST 15, 2026/i);
  assert.match(html, /provider subject.*normalized email address.*display name.*last login time/is);
  assert.match(html, /provider and subject reconnect your sign-in.*email and display name identify/is);
  assert.match(html, /one hour.*at most 24 hours/is);
  assert.match(html, /up to seven days/i);
  assert.match(html, /application code has no path that sells account or lookup data/i);
  assert.match(html, /one-way safety.*account ID or requesting IP address/is);
  assert.match(html, /structured application logs.*event.*status.*duration.*error-category/is);
  assert.match(html, /Public economy data is separate/i);
  assert.match(html, /does not delete the user.{0,20}Cloudflare Access identity/is);
  assert.match(html, /final production-wide retention period.*has not yet been set/is);
  assert.match(html, /href="\/account"/i);
  assert.match(html, /href="\/terms"/i);
  assert.match(html, /github\.com\/test23780460\/skyblock-hub\/issues/i);
});

test("terms render independent-project, fair-use, and no-guarantee limits", async () => {
  const response = await fetchRoute("/terms");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /EFFECTIVE.{0,24}AUGUST 15, 2026/i);
  assert.match(html, /independently operated.*not an official product of.*Hypixel Inc\..*Mojang Studios.*Microsoft.*Cloudflare.*OpenAI/is);
  assert.match(html, /do not use it to automate gameplay or trades/i);
  assert.match(html, /summary prices are not guaranteed executable trades/i);
  assert.match(html, /cannot guarantee uninterrupted operation.*permanent storage.*complete data/is);
  assert.match(html, /Nothing here limits rights or responsibilities that cannot legally be limited/i);
  assert.match(html, /href="\/privacy"/i);
  assert.match(html, /github\.com\/test23780460\/skyblock-hub\/issues/i);
});
