import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const trackedFiles = execFileSync(
  "git",
  ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const findings = [];
const openAiKeyPattern = /sk-proj-[A-Za-z0-9_-]{20,}/g;
const uuidPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const zeroPlaceholder = "00000000-0000-4000-8000-000000000000";

function lineNumber(text, index) {
  return text.slice(0, index).split("\n").length;
}

for (const file of trackedFiles) {
  // `git ls-files --cached` includes an unstaged deletion until the migration
  // is committed. Skip paths that no longer exist in the worktree so the
  // pre-commit scan still checks every file that could actually be staged.
  if (!existsSync(file)) continue;
  const bytes = readFileSync(file);
  if (bytes.includes(0)) continue;
  const text = bytes.toString("utf8");

  for (const match of text.matchAll(openAiKeyPattern)) {
    findings.push({ file, line: lineNumber(text, match.index), kind: "OpenAI project key" });
  }

  for (const match of text.matchAll(uuidPattern)) {
    if (match[0].toLowerCase() === zeroPlaceholder) continue;
    const context = text.slice(Math.max(0, match.index - 120), match.index + match[0].length + 40);
    if (/(?:hypixel|api[\s_-]*key|secret|credential)/i.test(context)) {
      findings.push({ file, line: lineNumber(text, match.index), kind: "credential-like UUID" });
    }
  }
}

if (findings.length) {
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line}: potential ${finding.kind} (value redacted)`);
  }
  process.exitCode = 1;
} else {
  console.log(`Secret-pattern scan passed across ${trackedFiles.length} tracked files.`);
}
