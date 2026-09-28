import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ExtractionFailedError,
  createCurrencyEvidenceExtractor,
  createCurrencyGroundingGuard,
  createFunctionProvider,
  createNumberEvidenceExtractor,
  createNumericGroundingGuard,
  extract,
} from "../src/index.js";

const numberExtractor = createNumberEvidenceExtractor({ locales: ["fr"] });
const currencyExtractor = createCurrencyEvidenceExtractor({
  currencies: {
    CHF: ["CHF", "franc", "francs"],
    EUR: ["EUR", "euro", "euros"],
  },
});

describe("deterministic evidence", () => {
  it("extracts normalized numeric formats and preserves positions", () => {
    const text = "1000 1 000 1'000 999.90 180,50 1'500.- 350.- 3k";
    const evidence = numberExtractor.extract({ text });
    expect(evidence.map((item) => item.value)).toEqual([
      1000, 1000, 1000, 999.9, 180.5, 1500, 350, 3000,
    ]);
    expect(evidence[2]).toMatchObject({
      raw: "1'000",
      start: 11,
      end: 16,
      source: "deterministic",
    });
  });

  it("extracts the supported French number words without inventing values", () => {
    const text =
      "mille; mille cinq cents; quinze cents; huit cents; deux mille sept cent cinquante; trois cents; quatre cent cinquante; cent quatre-vingt; cent quatre-vingt francs cinquante";
    const evidence = numberExtractor.extract({ text });
    expect(evidence.map((item) => item.value)).toEqual([
      1000, 1500, 1500, 800, 2750, 300, 450, 180, 180.5,
    ]);
  });

  it("extracts configured currency aliases and ISO codes", () => {
    const text = "CHF 300 et 450 EUR, puis francs et euros";
    const evidence = currencyExtractor.extract({ text });
    expect(evidence.map((item) => [item.raw, item.value])).toEqual([
      ["CHF", "CHF"],
      ["EUR", "EUR"],
      ["francs", "CHF"],
      ["euros", "EUR"],
    ]);
  });

  it("runs extractors once and gives identical evidence to each fallback provider", async () => {
    let calls = 0;
    const snapshots: unknown[] = [];
    const extractor = {
      name: "once",
      extract: () => {
        calls += 1;
        return [
          {
            id: "one",
            kind: "number",
            raw: "8",
            value: 8,
            start: 0,
            end: 1,
            source: "deterministic" as const,
          },
        ];
      },
    };
    const schema = z.object({ amount: z.number() }).strict();
    await extract({
      text: "8",
      schema,
      evidenceExtractors: [extractor],
      strategy: [
        createFunctionProvider("first", ({ evidence }) => {
          snapshots.push(evidence);
          return { amount: "invalid" };
        }),
        createFunctionProvider("second", ({ evidence }) => {
          snapshots.push(evidence);
          return { amount: 8 };
        }),
      ],
    });
    expect(calls).toBe(1);
    expect(snapshots).toEqual([
      [
        {
          id: "one",
          kind: "number",
          raw: "8",
          value: 8,
          start: 0,
          end: 1,
          source: "deterministic",
        },
      ],
      [
        {
          id: "one",
          kind: "number",
          raw: "8",
          value: 8,
          start: 0,
          end: 1,
          source: "deterministic",
        },
      ],
    ]);
  });
});

describe("output guards", () => {
  const schema = z
    .object({ amount: z.number(), currency: z.string() })
    .strict();
  const guards = [
    createNumericGroundingGuard<{ amount: number; currency: string }>({
      select: (value) => [value.amount],
    }),
    createCurrencyGroundingGuard<{ amount: number; currency: string }>({
      select: (value) => [value.currency],
    }),
  ];

  it("accepts grounded data", async () => {
    await expect(
      extract({
        text: "huit cents francs",
        schema,
        evidenceExtractors: [numberExtractor, currencyExtractor],
        guards,
        provider: createFunctionProvider("good", () => ({
          amount: 800,
          currency: "CHF",
        })),
      }),
    ).resolves.toEqual({ amount: 800, currency: "CHF" });
  });

  it("rejects a structurally-valid ungrounded number and falls back", async () => {
    const result = await extract({
      text: "huit cents francs",
      schema,
      evidenceExtractors: [numberExtractor, currencyExtractor],
      guards,
      strategy: [
        createFunctionProvider("wrong", () => ({
          amount: 8000,
          currency: "CHF",
        })),
        createFunctionProvider("right", () => ({
          amount: 800,
          currency: "CHF",
        })),
      ],
    });
    expect(result.amount).toBe(800);
  });

  it("rejects an explicit wrong currency but permits missing currency evidence by default", async () => {
    await expect(
      extract({
        text: "300 EUR",
        schema,
        evidenceExtractors: [numberExtractor, currencyExtractor],
        guards,
        provider: createFunctionProvider("wrong", () => ({
          amount: 300,
          currency: "CHF",
        })),
      }),
    ).rejects.toBeInstanceOf(ExtractionFailedError);
    await expect(
      extract({
        text: "300",
        schema,
        evidenceExtractors: [numberExtractor],
        guards,
        provider: createFunctionProvider("default", () => ({
          amount: 300,
          currency: "CHF",
        })),
      }),
    ).resolves.toEqual({ amount: 300, currency: "CHF" });
  });

  it("handles decimal values and duplicate values as a multiset", async () => {
    const values = z.object({ values: z.array(z.number()) }).strict();
    const guard = createNumericGroundingGuard<{ values: number[] }>({
      select: (value) => value.values,
    });
    await expect(
      extract({
        text: "180,50 et 180,50",
        schema: values,
        evidenceExtractors: [numberExtractor],
        guards: [guard],
        provider: createFunctionProvider("good", () => ({
          values: [180.5, 180.5],
        })),
      }),
    ).resolves.toEqual({ values: [180.5, 180.5] });
    await expect(
      extract({
        text: "180,50",
        schema: values,
        evidenceExtractors: [numberExtractor],
        guards: [guard],
        provider: createFunctionProvider("duplicate", () => ({
          values: [180.5, 180.5],
        })),
      }),
    ).rejects.toBeInstanceOf(ExtractionFailedError);
  });
});
