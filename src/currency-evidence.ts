import type { EvidenceExtractor, TextEvidence } from "./types.js";

export interface CurrencyEvidenceExtractorOptions {
  currencies: Record<string, readonly string[]>;
}

export function createCurrencyEvidenceExtractor(
  options: CurrencyEvidenceExtractorOptions,
): EvidenceExtractor {
  const aliases = Object.entries(options.currencies)
    .flatMap(([currency, names]) => names.map((alias) => ({ currency, alias })))
    .sort((left, right) => right.alias.length - left.alias.length);
  return {
    name: "currencies",
    extract({ text }) {
      const result: TextEvidence[] = [];
      for (const { currency, alias } of aliases) {
        const pattern = new RegExp(
          `(?<![\\p{L}\\p{N}])${escape(alias)}(?![\\p{L}\\p{N}])`,
          "giu",
        );
        for (const match of text.matchAll(pattern)) {
          if (match.index === undefined) continue;
          result.push({
            id: `currency-${result.length + 1}`,
            kind: "currency",
            raw: match[0],
            value: currency,
            start: match.index,
            end: match.index + match[0].length,
            source: "deterministic",
          });
        }
      }
      return result.sort(
        (left, right) => left.start - right.start || left.end - right.end,
      );
    },
  };
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
