const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_RETENTION_MS = 24 * 60 * 60_000;

export type ProviderBudgetReservation = {
  scope: string;
  tokens: number;
  limit: number;
  now?: number;
  windowMs?: number;
};

/**
 * Atomically reserves a globally consistent provider budget in D1.
 * Cloudflare Rate Limit bindings remain coarse abuse filters because they are
 * per-location and eventually consistent; this table protects shared keys.
 */
export async function reserveD1ProviderBudget(
  binding: D1Database,
  input: ProviderBudgetReservation,
): Promise<boolean> {
  const scope = boundedScope(input.scope);
  const tokens = boundedInteger(input.tokens, 1, 100);
  const limit = boundedInteger(input.limit, tokens, 10_000);
  const windowMs = boundedInteger(input.windowMs ?? DEFAULT_WINDOW_MS, 1_000, 3_600_000);
  const now = boundedInteger(input.now ?? Date.now(), 0, Number.MAX_SAFE_INTEGER);
  const windowStartedAt = Math.floor(now / windowMs) * windowMs;
  const id = `${scope}:${windowStartedAt}`;

  const row = await binding.prepare(`
    INSERT INTO provider_request_budgets (
      id, scope, window_started_at, reserved_count, updated_at
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      reserved_count = provider_request_budgets.reserved_count + excluded.reserved_count,
      updated_at = excluded.updated_at
    WHERE provider_request_budgets.reserved_count + excluded.reserved_count <= ?
    RETURNING reserved_count
  `).bind(id, scope, windowStartedAt, tokens, now, limit).first<{ reserved_count: number }>();

  // Keep the durable guard bounded without putting cleanup on every request.
  if (
    row?.reserved_count === tokens &&
    windowStartedAt % 3_600_000 === 0
  ) {
    await binding.prepare(
      "DELETE FROM provider_request_budgets WHERE window_started_at < ?",
    ).bind(now - DEFAULT_RETENTION_MS).run();
  }
  return row !== null;
}

function boundedScope(value: string): string {
  const normalized = value.trim();
  if (!/^[a-z0-9:_-]{1,80}$/u.test(normalized)) {
    throw new Error("Provider budget scope is invalid");
  }
  return normalized;
}

function boundedInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error("Provider budget value is invalid");
  }
  return value;
}
