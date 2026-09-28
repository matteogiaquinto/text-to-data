import { Text2DataError } from "./errors.js";
import type { Text2DataProvider } from "./types.js";

export interface OpenAIProviderOptions {
  apiKey?: string | undefined;
  model?: string | undefined;
  fetch?: typeof globalThis.fetch | undefined;
}

/** OpenAI Structured Outputs adapter. Construct this on a trusted server only. */
export function createOpenAIProvider(options: OpenAIProviderOptions = {}): Text2DataProvider {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const model = options.model ?? process.env.TEXT2DATA_OPENAI_MODEL ?? "gpt-4o-mini";
  const request = options.fetch ?? globalThis.fetch;
  return {
    name: "openai",
    async extract(input) {
      if (!apiKey) throw new Text2DataError("OPENAI_API_KEY is not configured", "OPENAI_NOT_CONFIGURED");
      const response = await request("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "Extract only facts explicitly supported by the user text. Do not invent values. Return JSON matching the supplied schema exactly." },
            ...(input.instructions ? [{ role: "system", content: input.instructions }] : []),
            { role: "user", content: input.text },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: "text2data_result", strict: true, schema: input.jsonSchema },
          },
        }),
      });
      if (!response.ok) throw new Text2DataError("OpenAI request failed", "OPENAI_REQUEST_FAILED");
      const body = (await response.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
      const content = body.choices?.[0]?.message?.content;
      if (!content) throw new Text2DataError("OpenAI returned no structured content", "OPENAI_EMPTY_RESPONSE");
      try {
        return JSON.parse(content) as unknown;
      } catch (cause) {
        throw new Text2DataError("OpenAI returned invalid JSON", "OPENAI_INVALID_JSON", { cause });
      }
    },
  };
}
