import { isJsonObject } from "../providers/guards";
import type { AiGroundedContext, AiStructuredAnswer } from "./types";

export const SKY_PILOT_ANSWER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
    evidenceFactIds: {
      type: "array",
      items: { type: "string" },
    },
    assumptions: {
      type: "array",
      items: { type: "string" },
    },
    missingData: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["answer", "evidenceFactIds", "assumptions", "missingData"],
} as const;

const NUMBER_TOKEN = /(?<![\p{L}\p{N}_])[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?(?![\p{L}\p{N}_])/gu;
const NUMBER_WORD = "(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion)";
const SPELLED_QUANTITY = new RegExp(
  `\\b(?:${NUMBER_WORD}(?:[ -]+(?:and[ -]+)?${NUMBER_WORD})+|(?:hundred|thousand|million|billion|trillion)|${NUMBER_WORD}[ -]+(?:coins?|xp|hours?|days?|runs?|levels?|mp|percent|power|fortune|items?|attempts?|bosses|minutes?|seconds?))\\b`,
  "iu",
);
const DETERMINISTIC_CONTRADICTION = /(?:\b(?:ignore|override|disregard)\b.{0,48}\b(?:fact|calculator|engine|context)\b|\b(?:calculator|engine|server fact)\b.{0,48}\b(?:wrong|incorrect|mistaken)\b)/iu;
const GUARANTEED_RETURN = /\b(?:guaranteed profit|risk[- ]free profit|guaranteed returns?|always profitable)\b/iu;

export class AiAnswerValidationError extends Error {
  constructor(readonly reason: string) {
    super("The assistant response conflicted with the grounded output contract.");
    this.name = "AiAnswerValidationError";
  }
}

/**
 * Treats model output as untrusted. Evidence identifiers must resolve to the
 * server fact ledger, and every written quantity must exactly match a ledger
 * display. Conflicting or invented numbers are rejected rather than shown.
 */
export function parseGroundedAnswer(
  outputText: string,
  context: AiGroundedContext,
): AiStructuredAnswer {
  let value: unknown;
  try {
    value = JSON.parse(outputText) as unknown;
  } catch {
    throw new AiAnswerValidationError("invalid_json");
  }
  if (!isJsonObject(value) || !onlyKeys(value, new Set(["answer", "evidenceFactIds", "assumptions", "missingData"]))) {
    throw new AiAnswerValidationError("invalid_shape");
  }
  const answer = boundedString(value.answer, 1, 3_200);
  const evidenceFactIds = boundedStringArray(value.evidenceFactIds, 10, 120);
  const assumptions = boundedStringArray(value.assumptions, 6, 320);
  const missingData = boundedStringArray(value.missingData, 8, 320);
  if (!answer || !evidenceFactIds || !assumptions || !missingData) {
    throw new AiAnswerValidationError("invalid_fields");
  }

  const factIds = new Set(context.facts.map((fact) => fact.id));
  if (evidenceFactIds.some((id) => !factIds.has(id))) {
    throw new AiAnswerValidationError("unknown_evidence");
  }
  if (context.facts.length > 0 && evidenceFactIds.length === 0) {
    throw new AiAnswerValidationError("missing_evidence");
  }

  const citedFactIds = new Set(evidenceFactIds);
  const allowedNumbers = new Set(
    context.facts
      .filter((fact) => citedFactIds.has(fact.id))
      .flatMap((fact) => extractNumbers(fact.display)),
  );
  for (const text of [answer, ...assumptions, ...missingData]) {
    if (hasUnsafeControls(text)) throw new AiAnswerValidationError("unsafe_controls");
    if (containsUnparsedNumber(text)) {
      throw new AiAnswerValidationError("unsupported_numeric_claim");
    }
    for (const number of extractNumbers(text)) {
      if (!allowedNumbers.has(number)) {
        throw new AiAnswerValidationError("untrusted_numeric_claim");
      }
    }
    if (SPELLED_QUANTITY.test(text)) {
      throw new AiAnswerValidationError("spelled_numeric_claim");
    }
    if (DETERMINISTIC_CONTRADICTION.test(text)) {
      throw new AiAnswerValidationError("deterministic_contradiction");
    }
    if (GUARANTEED_RETURN.test(text)) {
      throw new AiAnswerValidationError("guaranteed_return");
    }
  }

  return {
    answer,
    evidenceFactIds: [...new Set(evidenceFactIds)],
    assumptions,
    missingData,
  };
}

function hasUnsafeControls(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return (codePoint < 32 && codePoint !== 9 && codePoint !== 10 && codePoint !== 13) ||
      codePoint === 127 ||
      (codePoint >= 0x202a && codePoint <= 0x202e) ||
      (codePoint >= 0x2066 && codePoint <= 0x2069);
  });
}

export function groundedEvidence(
  answer: AiStructuredAnswer,
  context: AiGroundedContext,
) {
  const requested = new Set(answer.evidenceFactIds);
  return context.facts.filter((fact) => requested.has(fact.id));
}

function extractNumbers(value: string): string[] {
  return [...value.matchAll(NUMBER_TOKEN)].map((match) => normalizeNumberToken(match[0]));
}

function containsUnparsedNumber(value: string): boolean {
  return /\p{N}/u.test(value.replace(NUMBER_TOKEN, ""));
}

function normalizeNumberToken(value: string): string {
  return value.replace(/^\+/, "").toLowerCase();
}

function boundedString(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length >= min && trimmed.length <= max ? trimmed : null;
}

function boundedStringArray(value: unknown, maxItems: number, maxLength: number): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const result: string[] = [];
  for (const item of value) {
    const parsed = boundedString(item, 1, maxLength);
    if (!parsed) return null;
    result.push(parsed);
  }
  return result;
}

function onlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}
