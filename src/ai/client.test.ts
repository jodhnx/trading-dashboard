import { describe, expect, it, vi } from "vitest";
import {
  extractMessageContent,
  HttpOpenAiClient,
  MockOpenAiClient,
  parseOpenAiHttpError,
  resolveOpenAiModel,
  sanitizeAiLogText,
  userFacingOpenAiError,
} from "./client";

describe("OpenAI client", () => {
  it("resolves OPENAI_MODEL from the environment", () => {
    expect(resolveOpenAiModel({ OPENAI_MODEL: "gpt-4o-mini" })).toBe("gpt-4o-mini");
    expect(resolveOpenAiModel({ OPENAI_MODEL: "  " })).toBe("gpt-4o-mini");
  });

  it("marks the mock client as mock", () => {
    const client = new MockOpenAiClient({ decision: "NO_TRADE" });
    expect(client.isMock).toBe(true);
    expect(client.model).toBe("mock-analysis");
  });

  it("sends a strict json_schema response format", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ ok: true }) } }],
      }),
    });
    const client = new HttpOpenAiClient("sk-test", "gpt-4o-mini", fetchFn as unknown as typeof fetch);
    expect(client.isMock).toBe(false);
    await client.completeStructured({
      system: "sys",
      user: "{}",
      schemaName: "trading_analysis",
      schema: { type: "object" },
    });
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string) as {
      response_format: { type: string; json_schema: { strict: boolean } };
    };
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/sk-test/);
  });

  it("returns AI_TIMEOUT on abort", async () => {
    const fetchFn = vi.fn().mockRejectedValue(
      Object.assign(new Error("aborted"), { name: "TimeoutError" }),
    );
    const client = new HttpOpenAiClient("sk-test", "gpt-4o-mini", fetchFn as unknown as typeof fetch);
    await expect(
      client.completeStructured({
        system: "sys",
        user: "{}",
        schemaName: "trading_analysis",
        schema: {},
      }),
    ).resolves.toEqual({ status: "AI_TIMEOUT" });
  });

  it("returns AI_ANALYSIS_INVALID for non-JSON content", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "not-json" } }],
      }),
    });
    const client = new HttpOpenAiClient("sk-test", "gpt-4o-mini", fetchFn as unknown as typeof fetch);
    await expect(
      client.completeStructured({
        system: "sys",
        user: "{}",
        schemaName: "trading_analysis",
        schema: {},
      }),
    ).resolves.toEqual({ status: "AI_ANALYSIS_INVALID" });
  });

  it("extracts message content", () => {
    expect(
      extractMessageContent({
        choices: [{ message: { content: "{\"a\":1}" } }],
      }),
    ).toBe("{\"a\":1}");
    expect(extractMessageContent({})).toBeNull();
  });

  it("maps OpenAI insufficient_quota (429) to AI_UNAVAILABLE with a quota message", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: {
          message:
            "You exceeded your current quota, please check your plan and billing details.",
          type: "insufficient_quota",
          code: "insufficient_quota",
        },
      }),
    });
    const client = new HttpOpenAiClient(
      "sk-test",
      "gpt-4o-mini",
      fetchFn as unknown as typeof fetch,
    );
    await expect(
      client.completeStructured({
        system: "sys",
        user: "{}",
        schemaName: "trading_analysis",
        schema: {},
      }),
    ).resolves.toEqual({
      status: "AI_UNAVAILABLE",
      detail: "OpenAI quota exceeded",
    });
    const request = fetchFn.mock.calls[0][1] as { headers: Record<string, string> };
    expect(request.headers.Authorization).toBe("Bearer sk-test");
    expect(JSON.stringify(fetchFn.mock.calls[0][1].body)).not.toMatch(/sk-test/);
  });

  it("does not treat a configured key with exhausted quota as missing configuration", () => {
    const parsed = parseOpenAiHttpError(
      {
        error: {
          message: "You exceeded your current quota, please check your plan and billing details.",
          type: "insufficient_quota",
          code: "insufficient_quota",
        },
      },
      429,
    );
    expect(userFacingOpenAiError(parsed)).toBe("OpenAI quota exceeded");
    expect(parsed.errorCode).toBe("insufficient_quota");
  });

  it("redacts secrets from log text", () => {
    expect(
      sanitizeAiLogText("Authorization: Bearer sk-test_secret_value failed"),
    ).toBe("Authorization: [redacted] failed");
  });
});
