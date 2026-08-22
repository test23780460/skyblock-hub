import { readFileSync } from "node:fs";

export function assertCloudflareTypeOutput(filePath, expectedEntrypoint) {
  const content = readFileSync(filePath, "utf8");
  if (content.includes("\r")) {
    throw new Error(`${filePath} must use LF line endings for portable Wrangler checks.`);
  }

  const marker = `mainModule: typeof import("${expectedEntrypoint}");`;
  const occurrences = content.split(marker).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `${filePath} must contain exactly one ${marker} declaration. ` +
      "Wrangler may have silently skipped entrypoint analysis.",
    );
  }
}
