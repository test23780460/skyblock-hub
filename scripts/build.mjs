import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  assertSafeBuildArtifacts,
  removeSensitiveBuildArtifacts,
} from "./cloudflare-artifacts.mjs";

const vinext = resolve("node_modules/vinext/dist/cli.js");
let status = 1;

try {
  const result = spawnSync(process.execPath, [vinext, "build"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  status = result.status ?? 1;
} finally {
  // vinext may copy local development environment files into its server
  // output. They are never deployment artifacts, even on failed builds.
  removeSensitiveBuildArtifacts();
  assertSafeBuildArtifacts();
}

process.exitCode = status;
