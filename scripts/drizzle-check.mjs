// Drizzle's CLI asks libuv for the current Windows account through a transitive
// helper. That lookup can fail with UV_ENOMEM in constrained sandboxes even
// when plenty of memory is available. Supplying the standard POSIX-style ID
// lets the helper choose its deterministic numeric namespace instead.
if (typeof process.geteuid !== "function") {
  Object.defineProperty(process, "geteuid", {
    configurable: true,
    value: () => 0,
  });
}

process.argv = [process.execPath, "drizzle-kit", "check"];
await import("../node_modules/drizzle-kit/bin.cjs");
