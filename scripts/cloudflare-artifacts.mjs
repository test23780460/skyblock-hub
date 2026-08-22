import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { relative, resolve } from "node:path";

const SENSITIVE_VARIABLE_NAME = /(key|token|secret|password|credential)/iu;

function isSensitiveEnvironmentFile(name) {
  return (
    name === ".dev.vars" ||
    name.startsWith(".dev.vars.") ||
    name === ".env" ||
    name.startsWith(".env.")
  );
}

export function findSensitiveBuildArtifacts(outputRoot = resolve("dist")) {
  const matches = [];

  function visit(directory) {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") return;
      throw error;
    }

    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        visit(path);
      } else if (entry.isFile() && isSensitiveEnvironmentFile(entry.name)) {
        matches.push(relative(outputRoot, path));
      }
    }
  }

  visit(outputRoot);
  return matches.sort();
}

export function removeSensitiveBuildArtifacts(outputRoot = resolve("dist")) {
  for (const artifact of findSensitiveBuildArtifacts(outputRoot)) {
    rmSync(resolve(outputRoot, artifact), { force: true });
  }

  const remaining = findSensitiveBuildArtifacts(outputRoot);
  if (remaining.length > 0) {
    throw new Error(
      `Sensitive environment files remain in build output: ${remaining.join(", ")}`,
    );
  }
}

export function findEmbeddedLocalSecrets(
  outputRoot = resolve("dist"),
  environmentRoot = resolve("."),
) {
  const secrets = localSecretValues(environmentRoot);
  if (secrets.length === 0) return [];
  const matches = [];

  for (const file of filesBelow(outputRoot)) {
    const contents = readFileSync(file);
    const variables = secrets
      .filter(({ value }) => contents.includes(Buffer.from(value)))
      .map(({ name }) => name);
    if (variables.length > 0) {
      matches.push({
        artifact: relative(outputRoot, file),
        variables: [...new Set(variables)].sort(),
      });
    }
  }

  return matches.sort((left, right) => left.artifact.localeCompare(right.artifact));
}

export function assertSafeBuildArtifacts(
  outputRoot = resolve("dist"),
  environmentRoot = resolve("."),
) {
  const environmentFiles = findSensitiveBuildArtifacts(outputRoot);
  if (environmentFiles.length > 0) {
    throw new Error(
      `Sensitive environment files remain in build output: ${environmentFiles.join(", ")}`,
    );
  }

  const embedded = findEmbeddedLocalSecrets(outputRoot, environmentRoot);
  if (embedded.length > 0) {
    const details = embedded
      .map(({ artifact, variables }) => `${artifact} (${variables.join(", ")})`)
      .join(", ");
    throw new Error(`Local secret values were embedded in build output: ${details}`);
  }
}

export function assertNativeBuildArtifacts(
  outputRoot = resolve("dist"),
  environmentRoot = resolve("."),
) {
  assertSafeBuildArtifacts(outputRoot, environmentRoot);
  if (existsSync(resolve(outputRoot, ".openai"))) {
    throw new Error("Sites rollback metadata remains in native build output: .openai");
  }
}

function localSecretValues(environmentRoot) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(environmentRoot, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return results;
    throw error;
  }

  for (const entry of entries) {
    if (
      !entry.isFile() ||
      !isSensitiveEnvironmentFile(entry.name) ||
      entry.name.endsWith(".example")
    ) continue;
    const source = readFileSync(resolve(environmentRoot, entry.name), "utf8");
    for (const line of source.split(/\r?\n/u)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u);
      if (!match || !SENSITIVE_VARIABLE_NAME.test(match[1])) continue;
      const value = unquote(match[2].trim());
      if (value.length >= 8 && !isPlaceholder(value)) {
        results.push({ name: match[1], value });
      }
    }
  }

  return results;
}

function filesBelow(root) {
  const files = [];
  function visit(directory) {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  visit(root);
  return files;
}

function unquote(value) {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

function isPlaceholder(value) {
  return /^(change-me|replace-me|your[-_]|example|placeholder|<.*>)$/iu.test(value);
}
