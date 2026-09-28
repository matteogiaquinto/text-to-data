import { GuardValidationError } from "./errors.js";
import type { OutputGuard, TextEvidence } from "./types.js";

type NumericValue = number | string;

export function createNumericGroundingGuard<TValue>(options: {
  select: (value: TValue) => readonly NumericValue[];
}): OutputGuard<TValue> {
  return {
    name: "numeric-grounding",
    validate({ value, evidence, provider }) {
      const available = count(
        evidence
          .filter((item) => item.kind === "number")
          .map((item) => numericKey(item.value)),
      );
      for (const selected of options.select(value)) {
        const key = numericKey(selected);
        if (!key || !available.get(key)) {
          throw new GuardValidationError(
            provider.name,
            "numeric-grounding",
            "Output contains a number not grounded in the source text",
          );
        }
        available.set(key, (available.get(key) ?? 0) - 1);
      }
    },
  };
}

export function createCurrencyGroundingGuard<TValue>(options: {
  select: (value: TValue) => readonly string[];
  requireEvidence?: boolean;
}): OutputGuard<TValue> {
  return {
    name: "currency-grounding",
    validate({ value, evidence, provider }) {
      const currencies = new Set(
        evidence
          .filter((item) => item.kind === "currency")
          .map((item) => String(item.value)),
      );
      if (!currencies.size && !options.requireEvidence) return;
      for (const selected of options.select(value)) {
        if (!currencies.has(selected)) {
          throw new GuardValidationError(
            provider.name,
            "currency-grounding",
            "Output currency is not grounded in the source text",
          );
        }
      }
    },
  };
}

function numericKey(value: unknown): string | undefined {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(",", "."))
        : Number.NaN;
  if (!Number.isFinite(number)) return undefined;
  return number.toString();
}

function count(values: Array<string | undefined>): Map<string, number> {
  const result = new Map<string, number>();
  for (const value of values) {
    if (value) result.set(value, (result.get(value) ?? 0) + 1);
  }
  return result;
}

export function numericEvidence(
  evidence: readonly TextEvidence[],
): readonly TextEvidence[] {
  return evidence.filter((item) => item.kind === "number");
}
