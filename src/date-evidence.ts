import type { EvidenceExtractor } from "./types.js";

export interface DateEvidenceExtractorOptions {
  /**
   * Locales whose calendar-date conventions are enabled. French Swiss dates are
   * enabled by default; `fr` is accepted as an alias for the same formats.
   */
  locales?: readonly string[];
}

type DateParts = {
  day: number;
  month: number;
  year: number;
};

type DateCandidate = DateParts & {
  raw: string;
  start: number;
  end: number;
};

const numericDatePatterns = [
  /(?<![\p{L}\p{N}/-])(?<year>\d{4})-(?<month>0[1-9]|1[0-2])-(?<day>0[1-9]|[12]\d|3[01])(?![\p{L}\p{N}/-])/gu,
  /(?<![\p{L}\p{N}/-])(?<day>0?[1-9]|[12]\d|3[01])\.(?<month>0?[1-9]|1[0-2])\.(?<year>\d{4})(?![\p{L}\p{N}/-])/gu,
  /(?<![\p{L}\p{N}/-])(?<day>0?[1-9]|[12]\d|3[01])\/(?<month>0?[1-9]|1[0-2])\/(?<year>\d{4})(?![\p{L}\p{N}/-])/gu,
];

const frenchMonths: Record<string, number> = {
  janvier: 1,
  "janv.": 1,
  janv: 1,
  février: 2,
  fevrier: 2,
  "févr.": 2,
  "fevr.": 2,
  févr: 2,
  fevr: 2,
  mars: 3,
  avril: 4,
  "avr.": 4,
  avr: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  "juil.": 7,
  juil: 7,
  août: 8,
  aout: 8,
  septembre: 9,
  "sept.": 9,
  sept: 9,
  octobre: 10,
  "oct.": 10,
  oct: 10,
  novembre: 11,
  "nov.": 11,
  nov: 11,
  décembre: 12,
  decembre: 12,
  "déc.": 12,
  "dec.": 12,
  déc: 12,
  dec: 12,
};

const frenchMonthPattern = Object.keys(frenchMonths)
  .sort((left, right) => right.length - left.length)
  .map(escape)
  .join("|");

const frenchDatePattern = new RegExp(
  String.raw`(?<![\p{L}\p{N}/-])(?<day>0?[1-9]|[12]\d|3[01])\s+(?<month>${frenchMonthPattern})\s+(?<year>\d{4})(?![\p{L}\p{N}/-])`,
  "giu",
);

export function createDateEvidenceExtractor(
  options: DateEvidenceExtractorOptions = {},
): EvidenceExtractor {
  const locales = options.locales ?? ["fr-CH"];
  const supportsFrenchSwissDates = locales.some(
    (locale) => locale === "fr-CH" || locale === "fr",
  );

  return {
    name: "dates",
    extract({ text }) {
      if (!supportsFrenchSwissDates) return [];

      const candidates = [
        ...numericDatePatterns.flatMap((pattern) =>
          numericDateEvidence(text, pattern),
        ),
        ...frenchDateEvidence(text),
      ];
      const uniqueCandidates = candidates
        .filter(isCalendarDate)
        .filter(
          (candidate, index, all) =>
            all.findIndex(
              (other) =>
                other.start === candidate.start && other.end === candidate.end,
            ) === index,
        )
        .sort(
          (left, right) => left.start - right.start || left.end - right.end,
        );

      return uniqueCandidates.map((candidate, index) => ({
        id: `date-${index + 1}`,
        kind: "date",
        raw: candidate.raw,
        value: formatIsoDate(candidate),
        start: candidate.start,
        end: candidate.end,
        source: "deterministic",
      }));
    },
  };
}

function numericDateEvidence(text: string, pattern: RegExp): DateCandidate[] {
  return [...text.matchAll(pattern)].flatMap((match) => {
    if (match.index === undefined || !match.groups) return [];
    return [candidate(match[0], match.index, match.groups)];
  });
}

function frenchDateEvidence(text: string): DateCandidate[] {
  return [...text.matchAll(frenchDatePattern)].flatMap((match) => {
    if (match.index === undefined || !match.groups) return [];
    const month = frenchMonths[match.groups.month.toLocaleLowerCase("fr-CH")];
    if (month === undefined) return [];
    return [
      {
        ...candidate(match[0], match.index, match.groups),
        month,
      },
    ];
  });
}

function candidate(
  raw: string,
  start: number,
  groups: Record<string, string>,
): DateCandidate {
  return {
    raw,
    start,
    end: start + raw.length,
    day: Number(groups.day),
    month: Number(groups.month),
    year: Number(groups.year),
  };
}

function isCalendarDate({ day, month, year }: DateParts): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day <= daysInMonth[month - 1];
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function formatIsoDate({ year, month, day }: DateParts): string {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
