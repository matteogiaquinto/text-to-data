import type { EvidenceExtractor, TextEvidence } from "./types.js";

export interface CurrencyEvidenceExtractorOptions {
  currencies: Record<string, readonly string[]>;
}

export function createCurrencyEvidenceExtractor(
  options: CurrencyEvidenceExtractorOptions,
): EvidenceExtractor {
  const aliases = Object.entries(options.currencies)
    .flatMap(([currency, names]) =>
      [
        ...new Set(
          [currency, ...names].map((alias) => alias.toLocaleLowerCase()),
        ),
      ].map((alias) => ({ currency, alias })),
    )
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
        result.push(
          ...compactAmountEvidence(text, alias, currency, result.length),
        );
      }
      return result.sort(
        (left, right) => left.start - right.start || left.end - right.end,
      );
    },
  };
}

const compactNumber = String.raw`(?:\d+(?:[.,]\d+)?k|(?:\d{1,3}(?:'\d{3})+|\d{1,3}(?:[ \u00a0]\d{3})+|\d+)(?:[.,]\d+)?(?:\.-)?)`;

function compactAmountEvidence(
  text: string,
  alias: string,
  currency: string,
  offset: number,
): TextEvidence[] {
  const escaped = escape(alias);
  const patterns = [
    new RegExp(
      `(?<![\\p{L}\\p{N}'])(?<number>${compactNumber})(?<currency>${escaped})(?![\\p{L}\\p{N}])`,
      "giu",
    ),
    new RegExp(
      `(?<![\\p{L}\\p{N}'])(?<currency>${escaped})(?<number>${compactNumber})(?![\\p{L}\\p{N}])`,
      "giu",
    ),
  ];
  const result: TextEvidence[] = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (match.index === undefined || !match.groups) continue;
      const rawNumber = match.groups.number;
      const numberStart = match.index + match[0].indexOf(rawNumber);
      const number = normalizeNumber(rawNumber);
      if (number === undefined) continue;
      const currencyStart =
        match.index + match[0].indexOf(match.groups.currency);
      result.push({
        id: `number-currency-${offset + result.length + 1}`,
        kind: "number",
        raw: rawNumber,
        value: number,
        start: numberStart,
        end: numberStart + rawNumber.length,
        source: "deterministic",
      });
      result.push({
        id: `currency-${offset + result.length + 1}`,
        kind: "currency",
        raw: match.groups.currency,
        value: currency,
        start: currencyStart,
        end: currencyStart + match.groups.currency.length,
        source: "deterministic",
      });
    }
  }
  return result;
}

function normalizeNumber(raw: string): number | undefined {
  const compact = raw.toLowerCase().replace(/[ '\u00a0]/g, "");
  const multiplied = compact.endsWith("k");
  const value = Number(
    (multiplied ? compact.slice(0, -1) : compact)
      .replace(/\.-$/u, "")
      .replace(",", "."),
  );
  return Number.isFinite(value) ? value * (multiplied ? 1000 : 1) : undefined;
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
