# Text2Data

Small, provider-agnostic TypeScript extraction library. It turns text into data validated by a consumer-provided Zod 4 schema; providers never bypass final validation.

```ts
import { extract, createFunctionProvider } from "@matteogiaquinto/text2data";

const result = await extract({
  text,
  schema,
  strategy: [deterministicProvider, localModelProvider],
});
```

This V1 intentionally includes no cloud, paid, or external API provider. Plug a local model, parser, or regex engine in with `createFunctionProvider`; the core never makes network requests.

For local consumers, add `"@matteogiaquinto/text2data": "link:../../text-to-data"` then run `pnpm install`. For a private registry release, publish the built package and replace the link with its version.
