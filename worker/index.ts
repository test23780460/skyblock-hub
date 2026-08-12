/** Cloudflare Worker entry point for the SkyPilot vinext application. */
import { featureFlags } from "../lib/config";
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { runPublicEconomyCycle } from "./jobs";
import { withBrowserSecurityHeaders } from "./security-headers";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const response = await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
      return withBrowserSecurityHeaders(response, url);
    }

    const response = await handler.fetch(request, env, ctx);
    return withBrowserSecurityHeaders(response, url);
  },

  scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): void {
    // Public economy remains an explicit deployment opt-in. Disabled cron
    // ticks make no upstream calls and do not mutate durable state.
    if (!featureFlags.publicEconomy) return;
    ctx.waitUntil(runScheduledPublicEconomy(env.DB));
  },
};

export async function runScheduledPublicEconomy(
  binding: D1Database,
): Promise<void> {
  // Keep D1 composition out of the fetch/render module graph. Node-based build
  // and route inspection do not provide the `cloudflare:workers` runtime module.
  const [{ createDb }, { DrizzlePublicEconomySnapshotStore }] =
    await Promise.all([
      import("../db"),
      import(
        "../lib/repositories/drizzle/public-economy-snapshot.repository"
      ),
    ]);
  const store = new DrizzlePublicEconomySnapshotStore(createDb(binding));
  await runPublicEconomyCycle({ store });
}

export default worker;
