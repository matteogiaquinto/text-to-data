import type { EvidenceExtractor, TextEvidence } from "./types.js";

/** Explicit percentages, independent of the business meaning of the percentage. */
export function createPercentageEvidenceExtractor(): EvidenceExtractor {
  return {
    name: "percentages",
    extract({ text }) {
      const result: TextEvidence[] = [];
      const pattern =
        /(?<![\p{L}\p{N}.,+-])\d+(?:[.,]\d+)?\s*(?:%|percent\b|pour\s+cent\b)/giu;
      for (const match of text.matchAll(pattern)) {
        result.push({
          id: `percentage-${result.length + 1}`,
          kind: "percentage",
          raw: match[0],
          value: Number(
            match[0].match(/^\d+(?:[.,]\d+)?/)![0].replace(",", "."),
          ),
          start: match.index,
          end: match.index + match[0].length,
          source: "deterministic",
        });
      }
      return result;
    },
  };
}
