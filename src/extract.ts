import { z } from "zod";
import { ExtractionFailedError, ProviderError, Text2DataError, ValidationError } from "./errors.js";
import type { ExtractOptions, Text2DataProvider } from "./types.js";

export async function extract<TSchema extends z.ZodType>(
  options: ExtractOptions<TSchema>,
): Promise<z.output<TSchema>> {
  if (!options.text.trim()) throw new Text2DataError("Text is required", "EMPTY_TEXT");
  const providers = resolveProviders(options);
  const jsonSchema = z.toJSONSchema(options.schema, { io: "input" });
  const failures: Text2DataError[] = [];

  for (const provider of providers) {
    try {
      const raw = await provider.extract({
        text: options.text,
        jsonSchema,
        ...(options.instructions ? { instructions: options.instructions } : {}),
        ...(options.context === undefined ? {} : { context: options.context }),
      });
      const parsed = options.schema.safeParse(raw);
      if (parsed.success) return parsed.data;
      failures.push(new ValidationError(provider.name, parsed.error.issues));
    } catch (error) {
      failures.push(error instanceof Text2DataError ? error : new ProviderError(provider.name, error));
    }
  }
  throw new ExtractionFailedError(failures);
}

function resolveProviders<TSchema extends z.ZodType>(
  options: ExtractOptions<TSchema>,
): readonly Text2DataProvider[] {
  if (options.provider && options.strategy) {
    throw new Text2DataError("Use either provider or strategy, not both", "INVALID_OPTIONS");
  }
  const providers = options.strategy ?? (options.provider ? [options.provider] : []);
  if (!providers.length) throw new Text2DataError("A provider or strategy is required", "MISSING_PROVIDER");
  return providers;
}
