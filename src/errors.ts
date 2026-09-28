export class Text2DataError extends Error {
  constructor(message: string, public readonly code: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "Text2DataError";
  }
}

export class ProviderError extends Text2DataError {
  constructor(public readonly provider: string, cause?: unknown) {
    super(`Provider "${provider}" could not extract structured data`, "PROVIDER_ERROR", { cause });
    this.name = "ProviderError";
  }
}

export class ValidationError extends Text2DataError {
  constructor(public readonly provider: string, public readonly issues: unknown) {
    super(`Provider "${provider}" returned data that does not match the schema`, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class ExtractionFailedError extends Text2DataError {
  constructor(public readonly failures: readonly Text2DataError[]) {
    super("All text extraction providers failed", "EXTRACTION_FAILED");
    this.name = "ExtractionFailedError";
  }
}
