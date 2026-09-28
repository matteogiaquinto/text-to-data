import { z } from "zod";
import {
  createCurrencyEvidenceExtractor,
  createCurrencyGroundingGuard,
  createNumberEvidenceExtractor,
  createNumericGroundingGuard,
  createOllamaProvider,
  ExtractionFailedError,
  extract,
} from "../dist/index.js";

const modelIndex = process.argv.indexOf("--model");
const model = modelIndex >= 0 ? process.argv[modelIndex + 1] : "qwen3.5:0.8b";
if (!model) throw new Error("Pass a model with --model <name>");

const schema = z
  .object({
    tasks: z
      .array(
        z.object({
          description: z.string(),
          amount: z.number(),
          currency: z.string(),
        }),
      )
      .min(1),
  })
  .strict();
const numberExtractor = createNumberEvidenceExtractor({ locales: ["fr"] });
const currencyExtractor = createCurrencyEvidenceExtractor({
  currencies: {
    CHF: ["CHF", "franc", "francs"],
    EUR: ["EUR", "euro", "euros"],
  },
});
const guards = [
  createNumericGroundingGuard({
    select: (value) => value.tasks.map((task) => task.amount),
  }),
  createCurrencyGroundingGuard({
    select: (value) => value.tasks.map((task) => task.currency),
  }),
];
const corpus = [
  "Atelier stratégique huit cents francs",
  "Campagne 1000 CHF et flyers 1500 CHF",
  "Audit 300 EUR et formation 450 EUR",
  "Conseil cent quatre-vingt francs cinquante",
  "Préparation 1000fr et révision 1500fr",
  "Déplacement à deux mille sept cent cinquante francs",
  "Retouches trois cinquante",
];

const provider = createOllamaProvider({ model });
for (const text of corpus) {
  try {
    const value = await extract({
      text,
      schema,
      provider,
      evidenceExtractors: [numberExtractor, currencyExtractor],
      guards,
    });
    console.log(
      JSON.stringify({
        text,
        zod: "success",
        guards: "success",
        result: value,
      }),
    );
  } catch (error) {
    const failures =
      error instanceof ExtractionFailedError ? error.failures : [error];
    const codes = failures.map((failure) => failure?.code ?? "UNKNOWN");
    const state = codes.includes("GUARD_VALIDATION_ERROR")
      ? "guard failure"
      : codes.includes("VALIDATION_ERROR")
        ? "Zod failure"
        : "provider failure";
    console.log(
      JSON.stringify({
        text,
        final: state,
        failures: codes,
      }),
    );
  }
}
