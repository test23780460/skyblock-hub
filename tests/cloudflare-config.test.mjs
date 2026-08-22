import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertNativeBuildArtifacts,
  assertSafeBuildArtifacts,
  findEmbeddedLocalSecrets,
  findSensitiveBuildArtifacts,
  removeSensitiveBuildArtifacts,
} from "../scripts/cloudflare-artifacts.mjs";
import { resolveCloudflareEnvironment } from "../scripts/cloudflare-environment.mjs";

const config = JSON.parse(
  await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
);
const economyConfig = JSON.parse(
  await readFile(new URL("../wrangler.economy.jsonc", import.meta.url), "utf8"),
);

test("Wrangler source config defines one unified Static Assets Worker", () => {
  assert.equal(config.name, "skypilot-local");
  assert.equal(config.main, "./worker/index.ts");
  assert.equal(config.compatibility_date, "2026-08-21");
  assert.deepEqual(config.compatibility_flags, [
    "nodejs_compat",
    "global_fetch_strictly_public",
  ]);
  assert.equal(config.assets.binding, "ASSETS");
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
  assert.equal(config.env.production.workers_dev, true);
  assert.equal(config.env.staging.workers_dev, true);
  assert.equal("images" in config, false, "unused Images binding must stay absent");
  assert.equal("site" in config, false, "deprecated Workers Sites must not be configured");
});

test("production and staging use isolated D1 databases", () => {
  const production = config.env.production;
  const staging = config.env.staging;
  assert.equal(production.name, "skypilot");
  assert.equal(staging.name, "skypilot-staging");
  assert.equal(production.d1_databases[0].binding, "DB");
  assert.equal(production.d1_databases[0].database_name, "skypilot-production");
  assert.equal(staging.d1_databases[0].binding, "DB");
  assert.equal(staging.d1_databases[0].database_name, "skypilot-staging");
  assert.notEqual(
    production.d1_databases[0].database_id,
    staging.d1_databases[0].database_id,
  );
  assert.equal(production.d1_databases[1].binding, "PROVIDER_BUDGET_DB");
  assert.equal(staging.d1_databases[1].binding, "PROVIDER_BUDGET_DB");
  assert.equal(
    production.d1_databases[1].database_id,
    staging.d1_databases[1].database_id,
    "the one shared credential needs one durable quota authority",
  );
  assert.notEqual(
    production.d1_databases[0].database_id,
    production.d1_databases[1].database_id,
    "application data must stay separate from the credential quota database",
  );
  assert.notEqual(
    production.kv_namespaces[0].id,
    staging.kv_namespaces[0].id,
  );
  assert.notEqual(
    production.ratelimits[0].namespace_id,
    staging.ratelimits[0].namespace_id,
  );
  assert.notEqual(
    production.ratelimits[1].namespace_id,
    staging.ratelimits[1].namespace_id,
  );
});

test("initial deploy leaves economy ingestion off until the paid-plan gate is verified", () => {
  assert.deepEqual(config.triggers.crons, []);
  assert.deepEqual(config.env.staging.triggers.crons, []);
  assert.deepEqual(config.env.production.triggers.crons, []);
  assert.equal(config.vars.ENABLE_PUBLIC_ECONOMY, "false");
  assert.equal(config.env.production.vars.ENABLE_PUBLIC_ECONOMY, "false");
  assert.equal(config.env.staging.vars.ENABLE_PUBLIC_ECONOMY, "false");
  assert.equal(economyConfig.name, "skypilot-economy-local");
  assert.equal(economyConfig.main, "./worker/economy.ts");
  assert.equal(economyConfig.workers_dev, false);
  assert.equal(economyConfig.preview_urls, false);
  assert.deepEqual(economyConfig.triggers.crons, []);
  assert.deepEqual(economyConfig.env.staging.triggers.crons, []);
  assert.deepEqual(economyConfig.env.production.triggers.crons, []);
  assert.equal(economyConfig.env.production.vars.ENABLE_PUBLIC_ECONOMY, "false");
  assert.equal(economyConfig.env.staging.vars.ENABLE_PUBLIC_ECONOMY, "false");
  assert.equal(config.env.production.services[0].service, "skypilot-economy");
  assert.equal(config.env.staging.services[0].service, "skypilot-economy-staging");
});

test("secrets are declared by name and never placed in Wrangler vars", () => {
  for (const environment of [config.env.production, config.env.staging]) {
    assert.deepEqual(environment.secrets.required, ["HYPIXEL_API_KEY"]);
    assert.equal("HYPIXEL_API_KEY" in environment.vars, false);
    assert.equal("PLAYER_GATEWAY_SECRET" in environment.vars, false);
    assert.equal(environment.vars.ENABLE_BROWSER_PLAYER_GATEWAY, "false");
    assert.equal(environment.vars.REQUIRE_PLAYER_GATEWAY, "false");
    assert.equal(environment.vars.ENABLE_ACCOUNT_AUTH, "false");
    assert.equal(environment.vars.AUTH_PROVIDER, "cloudflare-access");
    assert.equal("ENABLE_CHATGPT_AUTH" in environment.vars, false);
  }
});

test("Workers Builds selects staging resources for non-production branches", () => {
  assert.equal(resolveCloudflareEnvironment({ requested: "auto" }), "staging");
  assert.equal(
    resolveCloudflareEnvironment({ requested: "auto", branch: "main" }),
    "production",
  );
  assert.equal(
    resolveCloudflareEnvironment({ requested: "auto", branch: "feature/cloudflare" }),
    "staging",
  );
});

test("the web Worker cannot schedule or directly compose economy ingestion", async () => {
  const source = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /scheduled\s*\(/u);
  assert.doesNotMatch(source, /economy-runtime/u);
});

test("native builds exclude Sites packaging while retaining an explicit rollback path", async () => {
  const [viteConfig, runner] = await Promise.all([
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/cloudflare-run.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(viteConfig, /cloudflareEnvironment \? \[\] : \[sites\(\)\]/);
  assert.match(runner, /dist\/\.openai/);
  assert.match(runner, /removeSensitiveBuildArtifacts/);
  assert.match(runner, /assertCommittedWorktree/);
});

test("native build cleanup removes generated environment files before upload", async () => {
  const output = await mkdtemp(join(tmpdir(), "skypilot-build-"));
  try {
    await mkdir(join(output, "server"));
    await writeFile(join(output, "server", ".dev.vars"), "SECRET=fake-test-value\n");
    await writeFile(join(output, "server", ".env.production"), "OTHER=fake\n");
    await writeFile(join(output, "server", "index.js"), "export default {};\n");

    assert.deepEqual(findSensitiveBuildArtifacts(output), [
      join("server", ".dev.vars"),
      join("server", ".env.production"),
    ]);
    removeSensitiveBuildArtifacts(output);
    assert.deepEqual(findSensitiveBuildArtifacts(output), []);
    assert.equal(
      await readFile(join(output, "server", "index.js"), "utf8"),
      "export default {};\n",
    );
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test("build safety rejects Sites metadata and embedded local secrets", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "skypilot-secret-scan-"));
  const output = join(workspace, "dist");
  try {
    await mkdir(join(output, "server"), { recursive: true });
    await writeFile(join(workspace, ".env"), "HYPIXEL_API_KEY=local-test-secret-value\n");
    await writeFile(join(output, "server", "index.js"), "const value='local-test-secret-value';\n");
    assert.deepEqual(findEmbeddedLocalSecrets(output, workspace), [{
      artifact: join("server", "index.js"),
      variables: ["HYPIXEL_API_KEY"],
    }]);
    assert.throws(
      () => assertSafeBuildArtifacts(output, workspace),
      /HYPIXEL_API_KEY/u,
    );
    await writeFile(join(output, "server", "index.js"), "export default {};\n");
    await mkdir(join(output, ".openai"));
    assert.throws(
      () => assertNativeBuildArtifacts(output, workspace),
      /Sites rollback metadata/u,
    );
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
