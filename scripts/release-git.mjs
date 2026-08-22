import { spawnSync } from "node:child_process";

export function assertCommittedWorktree() {
  const status = spawnSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true,
  });
  if (status.error) throw status.error;
  if (status.status !== 0) {
    throw new Error("Unable to verify the Git worktree before deployment.");
  }
  if (status.stdout.trim()) {
    throw new Error("Deployment requires a clean, committed Git worktree.");
  }

  const head = spawnSync("git", ["rev-parse", "--short=12", "HEAD"], {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true,
  });
  if (head.error) throw head.error;
  if (head.status !== 0 || !/^[0-9a-f]{7,40}$/iu.test(head.stdout.trim())) {
    throw new Error("Deployment requires a valid committed Git revision.");
  }
  console.log(`Deploying committed revision ${head.stdout.trim()}.`);
}
