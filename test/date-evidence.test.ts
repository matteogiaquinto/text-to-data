import { describe, expect, it } from "vitest";
import { createDateEvidenceExtractor } from "../src/index.js";

const extractor = createDateEvidenceExtractor({ locales: ["fr-CH"] });

describe("date evidence", () => {
  it.each([
    ["2026-10-30", "2026-10-30"],
    ["30.10.2026", "2026-10-30"],
    ["30/10/2026", "2026-10-30"],
    ["30 octobre 2026", "2026-10-30"],
    ["30 oct. 2026", "2026-10-30"],
  ])("normalizes %s", (raw, value) => {
    expect(extractor.extract({ text: raw })).toMatchObject([
      {
        kind: "date",
        raw,
        value,
        start: 0,
        end: raw.length,
        source: "deterministic",
      },
    ]);
  });

  it("matches French months regardless of case and accents", () => {
    const text = "Échéances: 1 FÉVRIER 2028, 2 aout 2027 et 3 DÉC. 2026.";
    expect(
      extractor.extract({ text }).map(({ raw, value }) => ({ raw, value })),
    ).toEqual([
      { raw: "1 FÉVRIER 2028", value: "2028-02-01" },
      { raw: "2 aout 2027", value: "2027-08-02" },
      { raw: "3 DÉC. 2026", value: "2026-12-03" },
    ]);
  });

  it("rejects impossible calendar dates while accepting leap days", () => {
    const text = "31 février 2026; 31.02.2026; 29.02.2025; 29.02.2024";
    expect(extractor.extract({ text }).map((item) => item.value)).toEqual([
      "2024-02-29",
    ]);
  });

  it("returns distinct exact source spans without duplicates", () => {
    const text = "Du 30.10.2026 au 2 novembre 2026, puis le 2026-12-01.";
    const evidence = extractor.extract({ text });
    expect(evidence.map(({ raw, value }) => ({ raw, value }))).toEqual([
      { raw: "30.10.2026", value: "2026-10-30" },
      { raw: "2 novembre 2026", value: "2026-11-02" },
      { raw: "2026-12-01", value: "2026-12-01" },
    ]);
    expect(evidence.map(({ start, end }) => text.slice(start, end))).toEqual(
      evidence.map((item) => item.raw),
    );
  });

  it("does not treat neighboring numbers or invoice references as dates", () => {
    const text =
      "30.10 est un taux, 2026 est une année; facture INV-30.10.2026 et REF/2026-10-30.";
    expect(extractor.extract({ text })).toEqual([]);
  });

  it("does not resolve relative expressions", () => {
    expect(
      extractor.extract({
        text: "aujourd'hui, fin du mois, bientôt, dans quelques jours",
      }),
    ).toEqual([]);
  });
});
