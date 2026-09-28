import { z } from "zod";
import {
  ExtractionFailedError,
  GuardValidationError,
  ProviderError,
  Text2DataError,
  ValidationError,
} from "./errors.js";
import type { ExtractOptions, Text2DataProvider } from "./types.js";

export async function extract<TSchema extends z.ZodType>(
  options: ExtractOptions<TSchema>,
): Promise<z.output<TSchema>> {
  if (!options.text.trim())
    throw new Text2DataError("Text is required", "EMPTY_TEXT");
  const providers = resolveProviders(options);
  const jsonSchema = z.toJSONSchema(options.schema, { io: "input" });
  const evidence = await extractEvidence(options);
  const failures: Text2DataError[] = [];

  for (const provider of providers) {
    try {
      const raw = await provider.extract({
        text: options.text,
        jsonSchema,
        ...(options.instructions ? { instructions: options.instructions } : {}),
        ...(options.context === undefined ? {} : { context: options.context }),
        ...(evidence.length ? { evidence } : {}),
      });
      const parsed = options.schema.safeParse(raw);
      if (parsed.success) {
        await validateGuards(options, parsed.data, evidence, provider);
        return parsed.data;
      }
      failures.push(new ValidationError(provider.name, parsed.error.issues));
    } catch (error) {
      failures.push(
        error instanceof Text2DataError
          ? error
          : new ProviderError(provider.name, error),
      );
    }
  }
  throw new ExtractionFailedError(failures);
}

async function extractEvidence<TSchema extends z.ZodType>(
  options: ExtractOptions<TSchema>,
): Promise<readonly import("./types.js").TextEvidence[]> {
  const extractors = options.evidenceExtractors ?? [];
  const extracted = await Promise.all(
    extractors.map((extractor) =>
      extractor.extract({
        text: options.text,
        ...(options.context === undefined ? {} : { context: options.context }),
      }),
    ),
  );
  return extracted.flat();
}

async function validateGuards<TSchema extends z.ZodType>(
  options: ExtractOptions<TSchema>,
  value: z.output<TSchema>,
  evidence: readonly import("./types.js").TextEvidence[],
  provider: Text2DataProvider,
): Promise<void> {
  for (const guard of options.guards ?? []) {
    try {
      const accepted = await guard.validate({
        value,
        text: options.text,
        evidence,
        provider,
        ...(options.context === undefined ? {} : { context: options.context }),
      });
      if (accepted === false) {
        throw new GuardValidationError(provider.name, guard.name);
      }
    } catch (error) {
      if (error instanceof Text2DataError) throw error;
      const reason = error instanceof Error ? error.message : undefined;
      throw new GuardValidationError(provider.name, guard.name, reason);
    }
  }
}

function resolveProviders<TSchema extends z.ZodType>(
  options: ExtractOptions<TSchema>,
): readonly Text2DataProvider[] {
  if (options.provider && options.strategy) {
    throw new Text2DataError(
      "Use either provider or strategy, not both",
      "INVALID_OPTIONS",
    );
  }
  const providers =
    options.strategy ?? (options.provider ? [options.provider] : []);
  if (!providers.length)
    throw new Text2DataError(
      "A provider or strategy is required",
      "MISSING_PROVIDER",
    );
  return providers;
}
