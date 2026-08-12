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
  assert.match(html, /Enter username or UUID/);
  assert.match(html, /Minecraft username or Java UUID/);
  assert.match(html, /maxlength="36"/i);
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

test("player entry points accept a bounded username or Java UUID", async () => {
  const [home, dashboard, moneyMaking] = await Promise.all([
    fetchRoute("/"),
    fetchRoute("/dashboard"),
    fetchRoute("/money-making"),
  ]);
  for (const response of [home, dashboard, moneyMaking]) {
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /Minecraft username or Java UUID/i);
    assert.match(html, /maxlength="36"/i);
    assert.match(html, /\[0-9A-Fa-f\]\{32\}/);
    assert.match(html, /\[0-9A-Fa-f\]\{8\}-\[0-9A-Fa-f\]\{4\}/);
  }
});

test("calculator lab server-renders six deterministic tools", async () => {
  const response = await fetchRoute("/calculators");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Six working, deterministic planners/i);
  assert.match(html, /Farming XP target/i);
  assert.match(html, /SkyBlock calculators/i);
  assert.match(html, /Calculated locally/i);
});

test("accessory page renders the family-aware optimizer", async () => {
  const response = await fetchRoute("/accessories");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Accessory optimizer/i);
  assert.match(html, /Editable reference catalog/i);
  assert.match(html, /Exact budget plan/i);
  assert.match(html, /not live quotes/i);
});

test("garden page renders the crop-specific Fortune optimizer", async () => {
  const response = await fetchRoute("/garden");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Garden optimizer/i);
  assert.match(html, /Fortune breakdown/i);
  assert.match(html, /Coins per Fortune/i);
  assert.match(html, /not live data/i);
});

test("money-making page renders the personalized deterministic ranker", async () => {
  const response = await fetchRoute("/money-making");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Money-making flight plan/i);
  assert.match(html, /Editable method scenarios/i);
  assert.match(html, /Deterministic ranking/i);
  assert.match(html, /not live quotes or guarantees/i);
  assert.match(html, /Username or UUID/i);
});

test("economy overview renders working craft and NPC comparison labs", async () => {
  const response = await fetchRoute("/economy");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Economy command center/i);
  assert.match(html, /Craft flip evaluator/i);
  assert.match(html, /NPC.*Bazaar comparison/i);
  assert.match(html, /editable example assumption/i);
});

test("skills page renders all seven core level-to-time planners", async () => {
  const response = await fetchRoute("/skills");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Core skill flight plan/i);
  assert.match(html, /Core skill target summaries/i);
  assert.match(html, /Target total XP/i);
  for (const skill of ["Farming", "Mining", "Foraging", "Fishing", "Combat", "Enchanting", "Alchemy"]) {
    assert.match(html, new RegExp(skill, "i"));
  }
});

test("AI page renders selector-only grounding and deterministic authority rules", async () => {
  const response = await fetchRoute("/ai?demo=1");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /SkyPilot resolves facts on the server and rejects model output that conflicts with them/i);
  assert.match(html, /Grounding context/i);
  assert.match(html, /Accepts selectors, never client-supplied player facts or prices/i);
  assert.match(html, /Stores aggregate usage metrics, never prompts or answers/i);
});

test("Dungeon, Slayer, and minion destinations open their working focused planners", async () => {
  const [dungeons, slayers, minions] = await Promise.all([
    fetchRoute("/dungeons"),
    fetchRoute("/slayers"),
    fetchRoute("/minions"),
  ]);
  const dungeonHtml = await dungeons.text();
  assert.match(dungeonHtml, /Dungeon run planner/i);
  assert.match(dungeonHtml, /Floor readiness check/i);
  assert.match(dungeonHtml, /UNOFFICIAL SCORE/i);
  assert.match(await slayers.text(), /Slayer roadmap/i);
  const minionHtml = await minions.text();
  assert.match(minionHtml, /Minion production planner/i);
  assert.match(minionHtml, /Cheapest route to the next minion slot/i);
  assert.match(minionHtml, /Exact plan/i);
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

test("disabled persistence and economy APIs fail clearly without loading Cloudflare bindings", async () => {
  const [goals, economy] = await Promise.all([
    fetchRoute("/api/goals"),
    fetchRoute("/api/economy/bazaar"),
  ]);
  assert.equal(goals.status, 503);
  assert.equal((await goals.json()).error.code, "feature_disabled");
  assert.equal(economy.status, 503);
  assert.equal((await economy.json()).error.code, "feature_disabled");
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
