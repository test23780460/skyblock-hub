import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { resolveCloudflareEnvironment } from "./cloudflare-environment.mjs";
import { assertCloudflareTypeOutput } from "./cloudflare-type-output.mjs";
import { assertCommittedWorktree } from "./release-git.mjs";

const [requestedEnvironment, action] = process.argv.slice(2);
const environments = new Set(["auto", "production", "staging"]);
const actions = new Set(["deploy", "dry-run", "typegen", "types-check"]);

if (!environments.has(requestedEnvironment) || !actions.has(action)) {
  console.error("Usage: node scripts/cloudflare-economy-run.mjs <auto|production|staging> <deploy|dry-run|typegen|types-check>");
  process.exit(2);
}

const environment = resolveCloudflareEnvironment({
  requested: requestedEnvironment,
  branch: process.env.WORKERS_CI_BRANCH,
  productionBranch: process.env.SKYPILOT_PRODUCTION_BRANCH || "main",
});
const commandEnvironment = {
  ...process.env,
  WRANGLER_LOG_PATH: process.env.WRANGLER_LOG_PATH || ".wrangler/logs",
  WRANGLER_WRITE_LOGS: process.env.WRANGLER_WRITE_LOGS || "false",
};
if (action === "deploy") assertCommittedWorktree();
const wrangler = resolve("node_modules/wrangler/bin/wrangler.js");
const args = action === "typegen" || action === "types-check"
  ? [
      "types",
      "worker-economy-configuration.d.ts",
      "--config",
      "wrangler.economy.jsonc",
      "--env",
      environment,
      "--env-interface",
      "EconomyEnv",
      "--include-runtime",
      "false",
      "--strict-vars",
      "false",
      ...(action === "types-check" ? ["--check"] : []),
    ]
  : [
      "deploy",
      "--config",
      "wrangler.economy.jsonc",
      "--env",
      environment,
      ...(action === "dry-run" ? ["--dry-run"] : []),
    ];

const result = spawnSync(process.execPath, [wrangler, ...args], {
  cwd: process.cwd(),
  env: commandEnvironment,
  stdio: "inherit",
});
if (result.error) throw result.error;
const status = result.status ?? 1;
if (status !== 0) process.exit(status);
if (action === "typegen" || action === "types-check") {
  assertCloudflareTypeOutput(
    "worker-economy-configuration.d.ts",
    "./worker/economy",
  );
}
