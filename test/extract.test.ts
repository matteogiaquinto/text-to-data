import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ExtractionFailedError,
  createFunctionProvider,
  extract,
} from "../src/index.js";

const schema = z
  .object({
    customer: z.string().optional(),
    lines: z
      .array(
        z
          .object({
            description: z.string(),
            unitPrice: z.number().nonnegative(),
          })
          .strict(),
      )
      .min(1),
    metadata: z.object({ source: z.string() }).strict(),
  })
  .strict();

describe("extract", () => {
  it("returns Zod-validated nested data and optional fields", async () => {
    const result = await extract({
      text: "invoice",
      schema,
      provider: createFunctionProvider("fake", () => ({
        lines: [{ description: "Design", unitPrice: 1000 }],
        metadata: { source: "fake" },
      })),
    });
    expect(result).toEqual({
      lines: [{ description: "Design", unitPrice: 1000 }],
      metadata: { source: "fake" },
    });
  });

  it("rejects invalid JSON-shaped data and uses the fallback provider", async () => {
    const result = await extract({
      text: "invoice",
      schema,
      strategy: [
        createFunctionProvider("invalid", () => ({ lines: [], extra: true })),
        createFunctionProvider("fallback", () => ({
          customer: "Fitness",
          lines: [{ description: "Campaign", unitPrice: 1000 }],
          metadata: { source: "fallback" },
        })),
      ],
    });
    expect(result.customer).toBe("Fitness");
  });

  it("surfaces provider failures after all fallback attempts", async () => {
    await expect(
      extract({
        text: "invoice",
        schema,
        strategy: [
          createFunctionProvider("broken", () => {
            throw new Error("offline");
          }),
        ],
      }),
    ).rejects.toBeInstanceOf(ExtractionFailedError);
  });

  it("exports an input JSON schema from Zod 4", async () => {
    let jsonSchema: object | undefined;
    await extract({
      text: "invoice",
      schema,
      provider: createFunctionProvider("capture", (input) => {
        jsonSchema = input.jsonSchema;
        return {
          lines: [{ description: "Campaign", unitPrice: 1000 }],
          metadata: { source: "capture" },
        };
      }),
    });
    expect(jsonSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
    });
  });
});
