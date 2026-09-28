import type { EvidenceExtractor, TextEvidence } from "./types.js";

export interface NumberEvidenceExtractorOptions {
  locales?: readonly string[];
}

const numericPattern =
  /(?<![\p{L}\p{N}])(?:\d+(?:[.,]\d+)?k|(?:\d{1,3}(?:'\d{3})+|\d{1,3}(?:[ \u00a0]\d{3})+|\d+)(?:[.,]\d+)?(?:\.-)?)(?![\p{L}\p{N}])/giu;

export function createNumberEvidenceExtractor(
  options: NumberEvidenceExtractorOptions = {},
): EvidenceExtractor {
  const locales = options.locales ?? [];
  return {
    name: "numbers",
    extract({ text }) {
      const evidence = numericEvidence(text);
      if (locales.includes("fr")) evidence.push(...frenchNumberEvidence(text));
      return evidence.sort(
        (left, right) => left.start - right.start || left.end - right.end,
      );
    },
  };
}

function numericEvidence(text: string): TextEvidence[] {
  const result: TextEvidence[] = [];
  for (const match of text.matchAll(numericPattern)) {
    const raw = match[0];
    const value = normalizeNumeric(raw);
    if (value === undefined || match.index === undefined) continue;
    result.push(
      evidence(
        `number-${result.length + 1}`,
        raw,
        value,
        match.index,
        match.index + raw.length,
      ),
    );
  }
  return result;
}

function normalizeNumeric(raw: string): number | undefined {
  const compact = raw.toLowerCase().replace(/[ '\u00a0]/g, "");
  const multiplied = compact.endsWith("k");
  const normalized = (multiplied ? compact.slice(0, -1) : compact)
    .replace(/\.-$/, "")
    .replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value * (multiplied ? 1000 : 1) : undefined;
}

const units: Record<string, number> = {
  zero: 0,
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  quinze: 15,
  seize: 16,
  vingt: 20,
  trente: 30,
  quarante: 40,
  cinquante: 50,
  soixante: 60,
  "quatre-vingt": 80,
  "quatre-vingts": 80,
};

function frenchNumberEvidence(text: string): TextEvidence[] {
  const tokens = [...text.matchAll(/[\p{L}-]+/gu)].map(
    (match, index, matches) => {
      const start = match.index ?? 0;
      const previous = matches[index - 1];
      const previousEnd = previous
        ? (previous.index ?? 0) + previous[0].length
        : start;
      return {
        raw: match[0],
        lower: match[0].toLocaleLowerCase("fr"),
        start,
        separatorBefore: text.slice(previousEnd, start),
      };
    },
  );
  const result: TextEvidence[] = [];
  for (let index = 0; index < tokens.length;) {
    const parsed = parseFrenchTokens(tokens, index);
    if (!parsed) {
      index += 1;
      continue;
    }
    const decimal = tokens[parsed.end]?.lower.match(/^francs?$/u)
      ? parseFrenchTokens(tokens, parsed.end + 1)
      : undefined;
    const isCents = decimal && decimal.value >= 0 && decimal.value < 100;
    const end = isCents ? decimal.end : parsed.end;
    const last = tokens[end - 1];
    const raw = text.slice(tokens[index].start, last.start + last.raw.length);
    const value = isCents ? parsed.value + decimal.value / 100 : parsed.value;
    result.push(
      evidence(
        `number-fr-${result.length + 1}`,
        raw,
        value,
        tokens[index].start,
        last.start + last.raw.length,
      ),
    );
    index = end;
  }
  return result;
}

function parseFrenchTokens(
  tokens: Array<{ lower: string; separatorBefore: string }>,
  start: number,
): { value: number; end: number } | undefined {
  let total = 0;
  let current = 0;
  let index = start;
  let seen = false;
  let appendAfterScale = false;
  while (index < tokens.length) {
    if (index > start && !/^\s+$/u.test(tokens[index].separatorBefore)) break;
    const word = tokens[index].lower;
    if (word in units) {
      const unit = units[word];
      const currentRemainder = current % 100;
      const canAppendUnit =
        currentRemainder >= 20 && currentRemainder % 10 === 0 && unit < 10;
      const canAppendTens = current === 0 || appendAfterScale;
      if (
        current !== 0 &&
        !(unit < 20 ? canAppendUnit || appendAfterScale : canAppendTens)
      )
        break;
      current += unit;
      seen = true;
      appendAfterScale = false;
      index += 1;
      continue;
    }
    if (word === "cent" || word === "cents") {
      current = (current || 1) * 100;
      seen = true;
      appendAfterScale = true;
      index += 1;
      continue;
    }
    if (word === "mille") {
      total += (current || 1) * 1000;
      current = 0;
      seen = true;
      appendAfterScale = true;
      index += 1;
      continue;
    }
    break;
  }
  if (!seen) return undefined;
  const value = total + current;
  return value > 0 ? { value, end: index } : undefined;
}

function evidence(
  id: string,
  raw: string,
  value: number,
  start: number,
  end: number,
): TextEvidence {
  return {
    id,
    kind: "number",
    raw,
    value,
    start,
    end,
    source: "deterministic",
  };
}
