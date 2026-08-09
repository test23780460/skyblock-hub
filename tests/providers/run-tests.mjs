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
