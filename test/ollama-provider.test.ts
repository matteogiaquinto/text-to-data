import { describe, expect, it, vi } from "vitest";
import { createOllamaProvider } from "../src/index.js";

const input = {
  text: "hello",
  jsonSchema: { type: "object" },
  evidence: [
    {
      id: "number-1",
      kind: "number",
      raw: "800",
      value: 800,
      start: 0,
      end: 3,
      source: "deterministic" as const,
    },
  ],
};

describe("Ollama provider", () => {
  it("uses the local API, schema format, and deterministic evidence", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ message: { content: '{"amount":800}' } }),
          { status: 200 },
        ),
      );
    const provider = createOllamaProvider({ model: "qwen3.5:0.8b", fetch });
    await expect(provider.extract(input)).resolves.toEqual({ amount: 800 });
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:11434/api/chat");
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "qwen3.5:0.8b",
      format: { type: "object" },
      think: false,
      options: { temperature: 0 },
    });
    expect(String(JSON.parse(String(init.body)).messages[0].content)).toContain(
      '"value":800',
    );
  });

  it("reports empty, HTTP, and invalid JSON responses without contacting Ollama", async () => {
    const empty = createOllamaProvider({
      model: "x",
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: { content: "" } }), {
          status: 200,
        }),
      ),
    });
    await expect(empty.extract(input)).rejects.toMatchObject({
      code: "OLLAMA_EMPTY_RESPONSE",
    });
    const http = createOllamaProvider({
      model: "x",
      fetch: vi
        .fn()
        .mockResolvedValue(new Response("missing", { status: 404 })),
    });
    await expect(http.extract(input)).rejects.toMatchObject({
      code: "OLLAMA_HTTP_ERROR",
    });
    const invalid = createOllamaProvider({
      model: "x",
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: { content: "not-json" } }), {
          status: 200,
        }),
      ),
    });
    await expect(invalid.extract(input)).rejects.toMatchObject({
      code: "OLLAMA_INVALID_JSON",
    });
  });
});
