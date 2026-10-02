# Text2Data

Provider-agnostic TypeScript library for extracting structured, validated data from natural language.

Text2Data keeps the extraction pipeline deliberately small and explicit:

```text
text
→ deterministic evidence
→ provider
→ Zod validation
→ grounding guards
→ fallback
```

It provides the plumbing around an extraction provider; it does not decide your business rules.

## Installation

Requires Node.js 22 or later and uses ESM.

```powershell
pnpm add @matteogiaquinto/text-to-data
```

## Minimal example

The provider can be any async function behind `createFunctionProvider`. This is useful for integrating an existing model runtime, service, or deterministic parser.

```ts
import { z } from "zod";
import { createFunctionProvider, extract } from "@matteogiaquinto/text-to-data";

const schema = z.object({ customer: z.string() }).strict();

const provider = createFunctionProvider("example", async ({ text }) => ({
  customer: text.trim(),
}));

const result = await extract({
  text: "Acme SA",
  schema,
  provider,
});
// { customer: "Acme SA" }
```

## Ollama example

`createOllamaProvider` uses `http://127.0.0.1:11434` by default. It sends a JSON Schema to Ollama, uses temperature `0`, and disables thinking by default. Text2Data does not ship a cloud provider or download models.

```ts
import { z } from "zod";
import {
  createCurrencyEvidenceExtractor,
  createCurrencyGroundingGuard,
  createNumberEvidenceExtractor,
  createNumericGroundingGuard,
  createOllamaProvider,
  extract,
} from "@matteogiaquinto/text-to-data";

const schema = z
  .object({ amount: z.number().nonnegative(), currency: z.string() })
  .strict();

const result = await extract({
  text: "Atelier stratégique huit cents francs",
  schema,
  provider: createOllamaProvider({ model: "qwen3.5:0.8b" }),
  evidenceExtractors: [
    createNumberEvidenceExtractor({ locales: ["fr"] }),
    createCurrencyEvidenceExtractor({
      currencies: { CHF: ["CHF", "franc", "francs"] },
    }),
  ],
  guards: [
    createNumericGroundingGuard({ select: (value) => [value.amount] }),
    createCurrencyGroundingGuard({ select: (value) => [value.currency] }),
  ],
});
```

## Zod schemas

Pass a Zod 4 schema to `extract`. The library exports its JSON Schema to the provider and validates every provider response with the original Zod schema before returning it. The inferred return type follows the schema.

Schema validation guarantees structure, not factual correctness. Grounding guards can reject some unsupported values, but semantic errors may still require application-level validation.

## Deterministic evidence

Evidence extractors find narrow facts that can be read deterministically from the input and pass them to every provider attempt. `createNumberEvidenceExtractor` supports normalized numeric formats and selected French number words. `createCurrencyEvidenceExtractor` matches configured currency aliases and ISO codes, including supported compact forms such as `1000CHF`.

Evidence is not semantic interpretation: a provider still determines which extracted number belongs to which field.

## Numeric and currency grounding

Use guards after Zod validation to ensure selected output values have support in the evidence.

- `createNumericGroundingGuard` checks selected numbers, preserving decimal values and duplicate counts.
- `createCurrencyGroundingGuard` rejects a selected currency when conflicting currency evidence exists. Set `requireEvidence: true` when the currency must be explicit in the text.

Guards are generic. Select exactly the values your schema needs grounded.

## Fallback providers

Supply a `strategy` instead of a single `provider` to try providers in order. Evidence extraction runs once; provider errors, invalid JSON, Zod validation failures, and guard failures advance to the next provider.

```ts
const result = await extract({
  text,
  schema,
  evidenceExtractors: [numberExtractor, currencyExtractor],
  guards: [numericGuard, currencyGuard],
  strategy: [smallLocalModel, largerLocalModel],
});
```

## Custom providers

Use `createFunctionProvider(name, handler)` for an adapter function, or implement `Text2DataProvider` directly. A provider receives the text, JSON Schema, optional instructions/context, and deterministic evidence; it returns `unknown`. Text2Data validates and guards that value.

## What belongs in Text2Data

- providers
- schema validation
- deterministic evidence
- generic grounding guards
- fallback

## What belongs in your application

- business rules
- database IDs
- customer resolution
- financial calculations
- domain-specific defaults
- authorization
- workflow decisions

## Known limits

Providers can still make semantic mistakes, including selecting the wrong supported value or misunderstanding relationships in the text. Evidence and guards reduce a specific class of unsupported outputs; they do not make model output factually correct. Validate high-impact results with application-specific rules and appropriate human review.

## Local evaluation

With Ollama running and a model already installed locally:

```powershell
pnpm eval:ollama --model qwen3.5:0.8b
```

This optional command is not part of CI and does not download or call a paid service.

## License

[MIT](LICENSE)

## Detailed extraction

`extractDetailed(options)` runs the same pipeline as `extract(options)` and returns
`{ data, evidence, providerName, attemptedProviderNames, guardNames }`. The guard names
are those that succeeded on the winning attempt. Failed attempts are listed by name;
no prompts, context, credentials, raw provider responses or failure internals are returned.
`extract()` delegates to this pipeline and still returns only validated data. Both APIs
retain the same validation/guard/fallback error behavior.

`createPercentageEvidenceExtractor()` adds generic `percentage` evidence for explicit
expressions such as `8.1%`, `8,1 %`, `8.1 percent` and `8,1 pour cent`, with normalized
numeric values and exact source spans. It does not infer the percentage's business role.
Application guards should use that evidence for percentage fields in addition to grounding
all numeric values. Numeric membership alone cannot prevent swapping supported values.
