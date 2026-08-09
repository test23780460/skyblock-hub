export function assertFinite(value: number, name: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number`);
  }
  return value;
}

export function assertNonNegative(value: number, name: string): number {
  assertFinite(value, name);
  if (value < 0) {
    throw new RangeError(`${name} must be greater than or equal to zero`);
  }
  return value;
}

export function assertPositive(value: number, name: string): number {
  assertFinite(value, name);
  if (value <= 0) {
    throw new RangeError(`${name} must be greater than zero`);
  }
  return value;
}

export function assertRate(value: number, name: string): number {
  assertFinite(value, name);
  if (value < 0 || value > 1) {
    throw new RangeError(`${name} must be between zero and one`);
  }
  return value;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function round(value: number, digits = 2): number {
  if (!Number.isFinite(value)) {
    return value;
  }
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) {
    throw new RangeError("median requires at least one value");
  }
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
}

export function weightedMedian(
  values: readonly { value: number; weight: number }[],
): number {
  if (values.length === 0) {
    throw new RangeError("weightedMedian requires at least one value");
  }

  const ordered = [...values].sort(
    (left, right) => left.value - right.value,
  );
  const totalWeight = ordered.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    return median(ordered.map((entry) => entry.value));
  }

  let accumulated = 0;
  for (const entry of ordered) {
    accumulated += entry.weight;
    if (accumulated >= totalWeight / 2) {
      return entry.value;
    }
  }
  return ordered[ordered.length - 1].value;
}

export function lexicalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

