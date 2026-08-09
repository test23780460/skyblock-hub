import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

let workerPromise;

async function getWorker() {
  workerPromise ??= import(new URL("../dist/server/index.js", import.meta.url));
  return (await workerPromise).default;
}

async function fetchRoute(path) {
  const worker = await getWorker();
  return worker.fetch(
    new Request(new URL(path, "http://localhost"), { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the finished SkyPilot homepage", async () => {
  const response = await fetchRoute("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>SkyPilot — Know Your Next SkyBlock Move<\/title>/i);
  assert.match(html, /Stop guessing/);
  assert.match(html, /Know your next move/);
  assert.match(html, /Enter Minecraft username/);
  assert.match(html, /No account required/);
  assert.match(html, /PRODUCT PREVIEW/);
  assert.match(html, /not affiliated with or endorsed by Hypixel/i);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|Your site is taking shape|react-loading-skeleton/i);
});

test("renders major navigation and profile loading states", async () => {
  const [about, dashboard, bazaar] = await Promise.all([
    fetchRoute("/about"),
    fetchRoute("/dashboard?demo=1"),
    fetchRoute("/bazaar"),
  ]);
  assert.equal(about.status, 200);
  assert.match(await about.text(), /turns profile data into a flight plan/i);
  assert.equal(dashboard.status, 200);
  assert.match(await dashboard.text(), /Building your flight plan/i);
  assert.equal(bazaar.status, 200);
  assert.match(await bazaar.text(), /Bazaar explorer/i);
});

test("every public product destination server-renders", async () => {
  const routes = [
    "/",
    "/dashboard",
    "/progression",
    "/gear",
    "/accessories",
    "/economy",
    "/goals",
    "/bazaar",
    "/auctions",
    "/money-making",
    "/items",
    "/skills",
    "/garden",
    "/mining",
    "/foraging",
    "/fishing",
    "/dungeons",
    "/slayers",
    "/minions",
    "/museum",
    "/collections",
    "/bestiary",
    "/rift",
    "/calculators",
    "/ai",
    "/account",
    "/admin",
    "/more",
    "/status",
    "/privacy",
    "/about",
  ];

  for (const route of routes) {
    const response = await fetchRoute(route);
    assert.equal(response.status, 200, `${route} should render successfully`);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i, `${route} should return HTML`);
    assert.match(await response.text(), /<main\b/i, `${route} should contain the application main landmark`);
  }
});

test("starter preview and dependency are completely removed", async () => {
  const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(page, /codex-preview|_sites-preview|SkeletonPreview/);
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});

test("safe-default player lookup gate fails clearly without demo fallback", async () => {
  const response = await fetchRoute("/api/player?username=PilotFixture");
  assert.equal(response.status, 503);
  const payload = await response.json();
  assert.equal(payload.error.code, "feature_disabled");
  assert.doesNotMatch(JSON.stringify(payload), /PilotExample|demo-watermelon/);
});

test("health remains a successful liveness check with integrations disabled", async () => {
  const response = await fetchRoute("/api/health");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.data.status, "ok");
  assert.equal(payload.data.dependencies.hypixelAuthenticated.status, "disabled");
  assert.equal(payload.data.dependencies.hypixelPublicEconomy.status, "disabled");
});

test("robots and sitemap metadata routes render", async () => {
  const robots = await fetchRoute("/robots.txt");
  const sitemap = await fetchRoute("/sitemap.xml");
  assert.equal(robots.status, 200);
  assert.match(await robots.text(), /User-Agent:\s*\*/i);
  assert.equal(sitemap.status, 200);
  assert.match(await sitemap.text(), /<urlset\b/i);
});
