import { assertFinite, round } from "./internal.js";

const COIN_SUFFIXES = {
  "": 1,
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000,
  t: 1_000_000_000_000,
} as const;

export interface ParseCoinOptions {
  allowNegative?: boolean;
}

export interface FormatCoinOptions {
  compact?: boolean;
  maximumFractionDigits?: number;
  includeUnit?: boolean;
}

/**
 * Parses user-facing coin inputs such as `11.4M`, `1,250,000`, or `~2b coins`.
 * The grammar is deliberately strict so malformed budgets are never guessed.
 */
export function parseCoins(
  input: string | number,
  options: ParseCoinOptions = {},
): number {
  if (typeof input === "number") {
    return validateParsedAmount(input, options.allowNegative ?? false);
  }

  const match = input
    .trim()
    .match(
      /^(?:~|≈)?\s*([+-]?)\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)\s*([kKmMbBtT]?)\s*(?:coins?)?$/i,
    );
  if (!match) {
    throw new TypeError(`Invalid coin amount: ${JSON.stringify(input)}`);
  }

  const sign = match[1] === "-" ? -1 : 1;
  const numericPart = Number(match[2].replaceAll(",", ""));
  const suffix = match[3].toLowerCase() as keyof typeof COIN_SUFFIXES;
  return validateParsedAmount(
    sign * numericPart * COIN_SUFFIXES[suffix],
    options.allowNegative ?? false,
  );
}

export function tryParseCoins(
  input: string | number,
  options: ParseCoinOptions = {},
): number | null {
  try {
    return parseCoins(input, options);
  } catch {
    return null;
  }
}

export function formatCoins(
  amount: number,
  options: FormatCoinOptions = {},
): string {
  assertFinite(amount, "amount");
  const compact = options.compact ?? true;
  const includeUnit = options.includeUnit ?? false;
  const maximumFractionDigits = options.maximumFractionDigits ?? 2;
  if (!Number.isInteger(maximumFractionDigits) || maximumFractionDigits < 0 || maximumFractionDigits > 8) {
    throw new RangeError("maximumFractionDigits must be an integer from zero to eight");
  }

  let result: string;
  if (!compact) {
    result = groupThousands(trimFixed(amount, maximumFractionDigits));
  } else {
    const units = [
      { suffix: "T", divisor: COIN_SUFFIXES.t },
      { suffix: "B", divisor: COIN_SUFFIXES.b },
      { suffix: "M", divisor: COIN_SUFFIXES.m },
      { suffix: "K", divisor: COIN_SUFFIXES.k },
    ] as const;
    let unitIndex = units.findIndex((unit) => Math.abs(amount) >= unit.divisor);
    if (unitIndex < 0) {
      result = trimFixed(amount, maximumFractionDigits);
    } else {
      let unit = units[unitIndex];
      let scaled = round(amount / unit.divisor, maximumFractionDigits);
      if (Math.abs(scaled) >= 1_000 && unitIndex > 0) {
        unitIndex -= 1;
        unit = units[unitIndex];
        scaled = round(amount / unit.divisor, maximumFractionDigits);
      }
      result = `${trimFixed(scaled, maximumFractionDigits)}${unit.suffix}`;
    }
  }

  return includeUnit ? `${result} coins` : result;
}

function validateParsedAmount(amount: number, allowNegative: boolean): number {
  assertFinite(amount, "coin amount");
  if (!allowNegative && amount < 0) {
    throw new RangeError("coin amount cannot be negative");
  }
  if (Math.abs(amount) > Number.MAX_SAFE_INTEGER) {
    throw new RangeError("coin amount exceeds JavaScript's safe integer range");
  }
  return amount;
}

function trimFixed(value: number, digits: number): string {
  if (digits === 0) {
    return Math.round(value).toString();
  }
  return value.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
}

function groupThousands(value: string): string {
  const [integer, fraction] = value.split(".");
  const sign = integer.startsWith("-") ? "-" : "";
  const unsigned = sign ? integer.slice(1) : integer;
  const grouped = unsigned.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${grouped}${fraction ? `.${fraction}` : ""}`;
}
