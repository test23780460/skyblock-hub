/** Cloudflare Worker entry point for the SkyPilot vinext application. */
import handler from "vinext/server/app-router-entry";
import { withBrowserSecurityHeaders } from "./security-headers";

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const response = await handler.fetch(request, env, ctx);
    return withBrowserSecurityHeaders(response, url);
  },
} satisfies ExportedHandler<Env>;

export default worker;
