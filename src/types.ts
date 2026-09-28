import type { z } from "zod";

export interface ProviderExtractInput {
  text: string;
  jsonSchema: object;
  instructions?: string | undefined;
  context?: unknown;
}

export interface Text2DataProvider {
  name: string;
  extract(input: ProviderExtractInput): Promise<unknown>;
}

export interface ExtractOptions<TSchema extends z.ZodType> {
  text: string;
  schema: TSchema;
  provider?: Text2DataProvider | undefined;
  strategy?: readonly Text2DataProvider[] | undefined;
  instructions?: string | undefined;
  context?: unknown;
}
