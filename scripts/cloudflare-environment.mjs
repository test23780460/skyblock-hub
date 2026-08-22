export function resolveCloudflareEnvironment({
  requested,
  branch,
  productionBranch = "main",
}) {
  if (requested === "production" || requested === "staging") return requested;
  if (requested !== "auto") {
    throw new Error("Cloudflare environment must be auto, production, or staging");
  }
  const normalizedBranch = branch?.trim();
  return normalizedBranch === productionBranch ? "production" : "staging";
}
