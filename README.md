# Text2Data

Small, provider-agnostic TypeScript extraction library. A consumer supplies a Zod 4 schema; Text2Data combines semantic extraction with deterministic source facts and returns only a Zod-validated, guard-approved result.

```text
source text → evidence extractors (once) → provider → Zod → guards → result
                                          ↘ next provider on any failure
```

## Deterministic facts vs. semantic interpretation

Evidence is deliberately narrow: numbers, currencies, positions and other facts that can be read safely from text. Providers remain responsible for semantics — for example, associating `1000` with a campaign rather than flyers. A guard is needed because valid JSON can still contain an ungrounded fact.

## Local provider example

```ts
import { createFunctionProvider, extract } from "@matteogiaquinto/text2data";

const parser = createFunctionProvider("parser", async ({ text, evidence }) => {
  // Call a local runtime, regex parser, or embedded model here.
  return { text, evidence };
});

const result = await extract({ text, schema, provider: parser });
```

## Ollama with evidence and guards

`createOllamaProvider` makes requests only to `http://127.0.0.1:11434` by default. It uses Ollama's JSON Schema `format`, temperature `0`, and disabled thinking. No cloud or paid provider is shipped.

```ts
import {
  createCurrencyEvidenceExtractor,
  createCurrencyGroundingGuard,
  createNumberEvidenceExtractor,
  createNumericGroundingGuard,
  createOllamaProvider,
  extract,
} from "@matteogiaquinto/text2data";

const result = await extract({
  text,
  schema,
  provider: createOllamaProvider({ model: "qwen3.5:0.8b" }),
  evidenceExtractors: [
    createNumberEvidenceExtractor({ locales: ["fr"] }),
    createCurrencyEvidenceExtractor({
      currencies: {
        CHF: ["CHF", "franc", "francs"],
        EUR: ["EUR", "euro", "euros"],
      },
    }),
  ],
  guards: [
    createNumericGroundingGuard({
      select: (value) => value.lines.map((line) => line.amount),
    }),
    createCurrencyGroundingGuard({ select: (value) => [value.currency] }),
  ],
});
```

Evidence extractors run once before fallback. A provider failure, invalid JSON, Zod failure, or `GUARD_VALIDATION_ERROR` moves to the next provider in `strategy`.

```ts
await extract({
  text,
  schema,
  evidenceExtractors: [numberExtractor, currencyExtractor],
  guards: [numericGuard, currencyGuard],
  strategy: [smallLocalModel, largerLocalModel],
});
```

`createNumericGroundingGuard` compares only values selected by the consumer, preserving decimals and duplicate counts. `createCurrencyGroundingGuard` rejects a returned currency only when source currency evidence exists by default; use `requireEvidence: true` when a currency must be explicit.

## Local evaluation

With Ollama running and the model installed locally:

```powershell
pnpm eval:ollama --model qwen3.5:0.8b
```

This optional script is not part of CI and does not download a model. It uses a small generic task corpus and prints Zod/guard success or final provider failure.

For local consumers, add `"@matteogiaquinto/text2data": "link:../../text-to-data"` then run `pnpm install`. To add another provider later, implement `Text2DataProvider` or wrap it with `createFunctionProvider`; the core and consumer schema do not change.
