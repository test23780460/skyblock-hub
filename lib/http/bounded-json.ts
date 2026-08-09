export type BoundedJsonResult<T> =
  | { ok: true; value: T }
  | { ok: false; response: Response };

/** Reads a JSON body without ever retaining more than maxBytes in memory. */
export async function readBoundedJson<T>(
  request: Request,
  maxBytes: number,
): Promise<BoundedJsonResult<T>> {
  const contentType = request.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.includes("application/json")) {
    return failure(415, "unsupported_media_type", "Send this request as application/json.");
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return tooLarge(maxBytes);
  }

  const reader = request.body?.getReader();
  if (!reader) return failure(400, "invalid_json", "The JSON request body is missing.");

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return tooLarge(maxBytes);
      }
      chunks.push(value);
    }
  } catch {
    return failure(400, "invalid_json", "The JSON request body could not be read.");
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) as T };
  } catch {
    return failure(400, "invalid_json", "The JSON request body could not be read.");
  }
}

function tooLarge(maxBytes: number): BoundedJsonResult<never> {
  return failure(
    413,
    "request_too_large",
    `The request body must be ${maxBytes.toLocaleString("en-US")} bytes or smaller.`,
  );
}

function failure(
  status: number,
  code: string,
  message: string,
): BoundedJsonResult<never> {
  return {
    ok: false,
    response: Response.json(
      { error: { code, message } },
      { status, headers: { "cache-control": "no-store" } },
    ),
  };
}
