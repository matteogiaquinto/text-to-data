import type { z } from "zod";

export interface DetailedExtraction<TValue> {
  data: TValue;
  evidence: readonly TextEvidence[];
  providerName: string;
  attemptedProviderNames: readonly string[];
  guardNames: readonly string[];
}

export interface ProviderExtractInput {
  text: string;
  jsonSchema: object;
  instructions?: string | undefined;
  context?: unknown;
  evidence?: readonly TextEvidence[] | undefined;
}

export interface TextEvidence {
  id: string;
  kind: string;
  raw: string;
  value: unknown;
  start: number;
  end: number;
  source: "deterministic";
}

export interface EvidenceExtractor {
  name: string;
  extract(input: {
    text: string;
    context?: unknown;
  }): readonly TextEvidence[] | Promise<readonly TextEvidence[]>;
}

export interface Text2DataProvider {
  name: string;
  extract(input: ProviderExtractInput): Promise<unknown>;
}

export interface GuardInput<TValue> {
  value: TValue;
  text: string;
  evidence: readonly TextEvidence[];
  provider: Text2DataProvider;
  context?: unknown;
}

export interface OutputGuard<TValue> {
  name: string;
  validate(input: GuardInput<TValue>): boolean | void | Promise<boolean | void>;
}

export interface ExtractOptions<TSchema extends z.ZodType> {
  text: string;
  schema: TSchema;
  provider?: Text2DataProvider | undefined;
  strategy?: readonly Text2DataProvider[] | undefined;
  instructions?: string | undefined;
  context?: unknown;
  evidenceExtractors?: readonly EvidenceExtractor[] | undefined;
  guards?: readonly OutputGuard<z.output<TSchema>>[] | undefined;
}
