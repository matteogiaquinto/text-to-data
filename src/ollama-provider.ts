import { Text2DataError } from "./errors.js";
import type { Text2DataProvider } from "./types.js";

export interface OllamaProviderOptions {
  model: string;
  baseUrl?: string;
  temperature?: number;
  thinking?: boolean;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}

export function createOllamaProvider(
  options: OllamaProviderOptions,
): Text2DataProvider {
  const baseUrl = (options.baseUrl ?? "http://127.0.0.1:11434").replace(
    /\/$/u,
    "",
  );
  const request = options.fetch ?? globalThis.fetch;
  return {
    name: `ollama:${options.model}`,
    async extract(input) {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        options.timeoutMs ?? 30_000,
      );
      try {
        const response = await request(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            model: options.model,
            stream: false,
            think: options.thinking ?? false,
            options: { temperature: options.temperature ?? 0 },
            format: input.jsonSchema,
            messages: [
              {
                role: "system",
                content: systemPrompt(input.instructions, input.evidence),
              },
              { role: "user", content: input.text },
            ],
          }),
        });
        if (!response.ok) {
          throw new Text2DataError(
            `Ollama request failed with HTTP ${response.status}`,
            "OLLAMA_HTTP_ERROR",
          );
        }
        const body = (await response.json()) as {
          message?: { content?: string };
        };
        const content = body.message?.content?.trim();
        if (!content)
          throw new Text2DataError(
            "Ollama returned an empty response",
            "OLLAMA_EMPTY_RESPONSE",
          );
        try {
          return JSON.parse(content) as unknown;
        } catch (cause) {
          throw new Text2DataError(
            "Ollama returned invalid JSON",
            "OLLAMA_INVALID_JSON",
            { cause },
          );
        }
      } catch (error) {
        if (error instanceof Text2DataError) throw error;
        if (controller.signal.aborted)
          throw new Text2DataError(
            "Ollama request timed out",
            "OLLAMA_TIMEOUT",
            { cause: error },
          );
        throw new Text2DataError(
          "Ollama is unavailable",
          "OLLAMA_UNAVAILABLE",
          { cause: error },
        );
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function systemPrompt(
  instructions: string | undefined,
  evidence: readonly unknown[] | undefined,
): string {
  const facts = evidence?.length ? JSON.stringify(evidence) : "[]";
  return [
    "Return only JSON that conforms to the requested schema.",
    "Use deterministic evidence as reliable source facts. Do not change, invent, combine, or reinterpret its values.",
    `Deterministic evidence: ${facts}`,
    instructions,
  ]
    .filter(Boolean)
    .join("\n");
}
