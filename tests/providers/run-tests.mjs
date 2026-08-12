// tsx consults os.userInfo() on Windows, which can fail under constrained CI
// sandboxes. A stable numeric temp namespace avoids that platform-only lookup.
if (typeof process.geteuid !== "function") {
  Object.defineProperty(process, "geteuid", {
    configurable: true,
    value: () => 0,
  });
}

await import("tsx");
await import("./integration.test.ts");
await import("./profile-items.test.tsx");
await import("./goals.test.ts");
await import("./account-deletion.test.ts");
await import("./saved-state.test.ts");
await import("./economy-worker.test.ts");
await import("./ai-grounding.test.ts");
await import("./economy-history.test.ts");
