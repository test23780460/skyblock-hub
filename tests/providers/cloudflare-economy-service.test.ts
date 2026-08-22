import assert from "node:assert/strict";
import test from "node:test";
import { requestEconomyRefresh } from "../../lib/platform/cloudflare/economy-service";
import economyWorker from "../../worker/economy";

test("private economy worker stays inert while ingestion is disabled", async () => {
  const environment = {
    DB: {} as D1Database,
    SKYPILOT_ENVIRONMENT: "staging",
    ENABLE_PUBLIC_ECONOMY: "false",
  } as EconomyEnv;
  const missing = await economyWorker.fetch(
    new Request("https://economy.internal/not-public"),
    environment,
  );
  assert.equal(missing.status, 404);
  const disabled = await economyWorker.fetch(
    new Request("https://economy.internal/internal/economy/refresh", { method: "POST" }),
    environment,
  );
  assert.equal(disabled.status, 503);
  assert.equal(disabled.headers.get("Cache-Control"), "private, no-store");
});

test("web admin adapter accepts only a bounded economy-service contract", async () => {
  let capturedMethod = "";
  let capturedUrl = "";
  const service = {
    async fetch(input: RequestInfo | URL) {
      const request = input instanceof Request ? input : new Request(input);
      capturedMethod = request.method;
      capturedUrl = request.url;
      return Response.json({
        data: {
          message: "Economy cycle completed.",
          status: "completed",
          feeds: [{ feed: "bazaar", status: "completed", records: 1_400 }],
          ignored: "must-not-cross-the-boundary",
        },
      });
    },
  } as unknown as Fetcher;
  const response = await requestEconomyRefresh(service);
  assert.equal(capturedMethod, "POST");
  assert.equal(new URL(capturedUrl).hostname, "skypilot-economy.internal");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    data: {
      message: "Economy cycle completed.",
      status: "completed",
      feeds: [{ feed: "bazaar", status: "completed", records: 1_400 }],
    },
  });
});

test("web admin adapter fails safely on an oversized private-service response", async () => {
  const service = {
    async fetch() {
      return new Response("x".repeat(32_769), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  } as unknown as Fetcher;
  const response = await requestEconomyRefresh(service);
  assert.equal(response.status, 503);
  const payload = await response.json() as { error?: { code?: string } };
  assert.equal(payload.error?.code, "economy_service_unavailable");
});
