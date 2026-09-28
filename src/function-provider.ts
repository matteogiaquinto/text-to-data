import type { ProviderExtractInput, Text2DataProvider } from "./types.js";

export function createFunctionProvider(
  name: string,
  extract: (input: ProviderExtractInput) => Promise<unknown> | unknown,
): Text2DataProvider {
  if (!name.trim()) throw new TypeError("A provider name is required");
  return { name, extract: async (input) => extract(input) };
}
