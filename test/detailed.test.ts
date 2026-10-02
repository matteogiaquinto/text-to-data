import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  createFunctionProvider,
  createNumberEvidenceExtractor,
  createNumericGroundingGuard,
  createPercentageEvidenceExtractor,
  extract,
  extractDetailed,
  ExtractionFailedError,
} from "../src/index.js";

const schema = z.object({ amount: z.number() }).strict();
const evidenceExtractors = [createNumberEvidenceExtractor()];
const guards = [
  createNumericGroundingGuard<z.output<typeof schema>>({
    select: (v) => [v.amount],
  }),
];

describe("detailed extraction", () => {
  it("returns evidence and successful guard/provider names, without provider inputs", async () => {
    const provider = createFunctionProvider("local", () => ({ amount: 150 }));
    const options = {
      text: "150",
      schema,
      provider,
      evidenceExtractors,
      guards,
      instructions: "private prompt",
    };
    const detailed = await extractDetailed(options);
    expect(detailed).toEqual({
      data: { amount: 150 },
      evidence: [
        {
          id: "number-1",
          kind: "number",
          raw: "150",
          value: 150,
          start: 0,
          end: 3,
          source: "deterministic",
        },
      ],
      providerName: "local",
      attemptedProviderNames: ["local"],
      guardNames: ["numeric-grounding"],
    });
    expect(await extract(options)).toEqual(detailed.data);
  });
  it("extracts evidence once and reports fallback attempts after validation and guard failures", async () => {
    const extractor = {
      name: "counted",
      extract: vi.fn(createNumberEvidenceExtractor().extract),
    };
    const detailed = await extractDetailed({
      text: "150",
      schema,
      evidenceExtractors: [extractor],
      guards,
      strategy: [
        createFunctionProvider("invalid", () => ({})),
        createFunctionProvider("ungrounded", () => ({ amount: 1500 })),
        createFunctionProvider("fallback", () => ({ amount: 150 })),
      ],
    });
    expect(detailed.attemptedProviderNames).toEqual([
      "invalid",
      "ungrounded",
      "fallback",
    ]);
    expect(detailed.providerName).toBe("fallback");
    expect(extractor.extract).toHaveBeenCalledOnce();
  });
  it.each([{}, { amount: 1500 }])(
    "retains existing failure semantics for %j",
    async (raw) => {
      const options = {
        text: "150",
        schema,
        evidenceExtractors,
        guards,
        provider: createFunctionProvider("invalid", () => raw),
      };
      await expect(extractDetailed(options)).rejects.toBeInstanceOf(
        ExtractionFailedError,
      );
      await expect(extract(options)).rejects.toBeInstanceOf(
        ExtractionFailedError,
      );
    },
  );
});

describe("percentage evidence", () => {
  it.each(["8.1%", "8,1 %", "8.1 percent", "8,1 pour cent"])(
    "normalizes %s and preserves its span",
    async (raw) => {
      const text = `value ${raw}, done`;
      expect(
        await createPercentageEvidenceExtractor().extract({ text }),
      ).toEqual([
        {
          id: "percentage-1",
          kind: "percentage",
          raw,
          value: 8.1,
          start: 6,
          end: 6 + raw.length,
          source: "deterministic",
        },
      ]);
    },
  );
  it("does not treat bare numbers or signed fragments as percentages", async () => {
    expect(
      await createPercentageEvidenceExtractor().extract({
        text: "8.1; -8.1%; x8.1%",
      }),
    ).toEqual([]);
  });
});
