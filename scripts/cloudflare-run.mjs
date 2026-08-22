import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertNativeBuildArtifacts,
  removeSensitiveBuildArtifacts,
} from "./cloudflare-artifacts.mjs";
import { resolveCloudflareEnvironment } from "./cloudflare-environment.mjs";
import { assertCommittedWorktree } from "./release-git.mjs";

const [requestedEnvironment, action] = process.argv.slice(2);
const environments = new Set(["auto", "production", "staging"]);
const actions = new Set([
  "build",
  "deploy",
  "dev",
  "dry-run",
  "preview",
  "typegen",
  "types-check",
]);

if (!environments.has(requestedEnvironment) || !actions.has(action)) {
  console.error(
    "Usage: node scripts/cloudflare-run.mjs <auto|production|staging> <build|deploy|dev|dry-run|preview|typegen|types-check>",
  );
  process.exit(2);
}

const environment = resolveCloudflareEnvironment({
  requested: requestedEnvironment,
  branch: process.env.WORKERS_CI_BRANCH,
  productionBranch: process.env.SKYPILOT_PRODUCTION_BRANCH || "main",
});

const commandEnvironment = {
  ...process.env,
  CLOUDFLARE_ENV: environment,
  MINIFLARE_REGISTRY_PATH:
    process.env.MINIFLARE_REGISTRY_PATH || ".wrangler/registry",
  WRANGLER_LOG_PATH: process.env.WRANGLER_LOG_PATH || ".wrangler/logs",
  WRANGLER_WRITE_LOGS: process.env.WRANGLER_WRITE_LOGS || "false",
};

if (action === "deploy") assertCommittedWorktree();

const cli = {
  build: resolve("scripts/build.mjs"),
  vinext: resolve("node_modules/vinext/dist/cli.js"),
  vite: resolve("node_modules/vite/bin/vite.js"),
  wrangler: resolve("node_modules/wrangler/bin/wrangler.js"),
};

function invoke(entrypoint, args, environmentOverride = commandEnvironment) {
  const result = spawnSync(process.execPath, [entrypoint, ...args], {
    cwd: process.cwd(),
    env: environmentOverride,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function run(entrypoint, args, environmentOverride = commandEnvironment) {
  const status = invoke(entrypoint, args, environmentOverride);
  if (status !== 0) process.exit(status);
}

function invokeInteractive(entrypoint, args, environmentOverride) {
  return new Promise((resolveStatus, reject) => {
    const child = spawn(process.execPath, [entrypoint, ...args], {
      cwd: process.cwd(),
      env: environmentOverride,
      stdio: "inherit",
    });
    let interrupted = false;

    const forwardSignal = (signal) => {
      interrupted = true;
      if (!child.killed) child.kill(signal);
    };
    const onInterrupt = () => forwardSignal("SIGINT");
    const onTerminate = () => forwardSignal("SIGTERM");
    const detach = () => {
      process.off("SIGINT", onInterrupt);
      process.off("SIGTERM", onTerminate);
    };

    process.on("SIGINT", onInterrupt);
    process.on("SIGTERM", onTerminate);
    child.once("error", (error) => {
      detach();
      reject(error);
    });
    child.once("close", (code) => {
      detach();
      resolveStatus(interrupted ? 0 : (code ?? 1));
    });
  });
}

if (action === "dev") {
  run(cli.vinext, ["dev"]);
  process.exit(0);
}

if (action === "typegen" || action === "types-check") {
  const args = [
    "types",
    "worker-configuration.d.ts",
    "--env",
    environment,
    "--strict-vars",
    "false",
  ];
  if (action === "types-check") args.push("--check");
  run(cli.wrangler, args);
  process.exit(0);
}

// Sites rollback metadata is intentionally excluded from native Worker builds.
rmSync(resolve("dist/.openai"), { recursive: true, force: true });
removeSensitiveBuildArtifacts();
run(cli.build, []);
assertNativeBuildArtifacts();

if (action === "preview") {
  const previewEnvironment = { ...commandEnvironment };
  delete previewEnvironment.CLOUDFLARE_ENV;
  let previewStatus = 1;
  try {
    // The generated Wrangler config is already flattened to the selected
    // environment. Passing CLOUDFLARE_ENV again would look for a nested env
    // and produce a duplicate local service name.
    previewStatus = await invokeInteractive(
      cli.vite,
      ["preview"],
      previewEnvironment,
    );
  } finally {
    removeSensitiveBuildArtifacts();
    assertNativeBuildArtifacts();
  }
  if (previewStatus !== 0) process.exit(previewStatus);
} else if (action === "deploy") {
  removeSensitiveBuildArtifacts();
  assertNativeBuildArtifacts();
  run(cli.wrangler, ["deploy"]);
} else if (action === "dry-run") {
  removeSensitiveBuildArtifacts();
  assertNativeBuildArtifacts();
  run(cli.wrangler, ["deploy", "--dry-run"]);
} else {
  removeSensitiveBuildArtifacts();
  assertNativeBuildArtifacts();
}
