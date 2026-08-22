const INTERNAL_REFRESH_URL = "https://skypilot-economy.internal/internal/economy/refresh";
const MAX_SERVICE_RESPONSE_BYTES = 32_768;

type JsonRecord = Record<string, unknown>;

export async function requestEconomyRefresh(service: Fetcher): Promise<Response> {
  try {
    const upstream = await service.fetch(new Request(INTERNAL_REFRESH_URL, {
      method: "POST",
      headers: { Accept: "application/json" },
    }));
    const payload = await boundedJson(upstream);
    const normalized = normalizePayload(payload, upstream.status);
    if (!normalized) throw new Error("Invalid economy service response");
    const headers = new Headers({ "Cache-Control": "private, no-store" });
    const retryAfter = boundedRetryAfter(upstream.headers.get("Retry-After"));
    if (retryAfter) headers.set("Retry-After", String(retryAfter));
    return Response.json(normalized, { status: upstream.status, headers });
  } catch {
    return Response.json({ error: {
      code: "economy_service_unavailable",
      message: "The private economy service could not complete that request.",
      action: "Keep serving the last complete snapshot and try again later.",
    } }, {
      status: 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}

async function boundedJson(response: Response): Promise<unknown> {
  const declared = Number(response.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > MAX_SERVICE_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new Error("Economy service response exceeds its bound");
  }
  if (!response.body) throw new Error("Economy service response is missing");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_SERVICE_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("Economy service response exceeds its bound");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return JSON.parse(text) as unknown;
}

function normalizePayload(value: unknown, status: number): JsonRecord | null {
  const record = asRecord(value);
  if (!record) return null;
  if (status === 200 || status === 202) {
    const data = asRecord(record.data);
    if (!data || !boundedString(data.message, 512)) return null;
    if (data.status !== "completed" && data.status !== "skipped") return null;
    if (!Array.isArray(data.feeds) || data.feeds.length > 3) return null;
    const feeds = data.feeds.map(normalizeFeed);
    if (feeds.some((feed) => feed === null)) return null;
    return { data: { message: data.message, status: data.status, feeds } };
  }
  if (status === 429 || status === 503) {
    const error = asRecord(record.error);
    const code = boundedCode(error?.code);
    const message = boundedString(error?.message, 512);
    if (!error || !code || !message) return null;
    const action = boundedString(error.action, 512);
    const retryAfterSeconds = boundedNumber(error.retryAfterSeconds, 1, 86_400);
    return { error: {
      code,
      message,
      ...(action ? { action } : {}),
      ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
    } };
  }
  return null;
}

function normalizeFeed(value: unknown): JsonRecord | null {
  const feed = asRecord(value);
  if (!feed) return null;
  if (feed.feed !== "bazaar" && feed.feed !== "active-auctions" && feed.feed !== "ended-auctions") return null;
  if (feed.status !== "completed" && feed.status !== "skipped") return null;
  const records = boundedNumber(feed.records, 0, 1_000_000);
  if (records === null) return null;
  return { feed: feed.feed, status: feed.status, records };
}

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function boundedString(value: unknown, maximum: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= maximum
    ? value
    : null;
}

function boundedCode(value: unknown): string | null {
  return typeof value === "string" && /^[a-z0-9_-]{1,64}$/u.test(value) ? value : null;
}

function boundedNumber(value: unknown, minimum: number, maximum: number): number | null {
  return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum
    ? Number(value)
    : null;
}

function boundedRetryAfter(value: string | null): number | null {
  if (!value || !/^\d{1,5}$/u.test(value)) return null;
  return boundedNumber(Number(value), 1, 86_400);
}
