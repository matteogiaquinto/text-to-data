# Text2Data

Small, provider-agnostic TypeScript extraction library. It turns text into data validated by a consumer-provided Zod 4 schema; providers never bypass final validation.

```ts
import { extract, createFunctionProvider } from "@matteogiaquinto/text2data";

const result = await extract({
  text,
  schema,
  strategy: [deterministicProvider, openaiProvider],
});
```

Use `createOpenAIProvider` from `@matteogiaquinto/text2data/openai` on a trusted server. It requires `OPENAI_API_KEY` and optionally `TEXT2DATA_OPENAI_MODEL`. Do not instantiate it in browser code.

For local consumers, add `"@matteogiaquinto/text2data": "link:../../text-to-data"` then run `pnpm install`. For a private registry release, publish the built package and replace the link with its version.
