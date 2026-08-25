import type { OpenAiClient, OpenAiCompletionResult } from "./types";

/** Used only when OPENAI_MODEL is unset. Set OPENAI_MODEL in .env.local. */
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export const OPENAI_TIMEOUT_MS = 30_000;

const SECRET_RE =
  /sk-[A-Za-z0-9_\-]+|Bearer\s+\S+|sb_secret_[A-Za-z0-9_\-]+|eyJ[A-Za-z0-9_\-]{20,}/gi;

export function resolveOpenAiModel(
  env: Record<string, string | undefined> = process.env,
): string {
  const configured = env.OPENAI_MODEL?.trim();
  return configured && configured.length > 0 ? configured : DEFAULT_OPENAI_MODEL;
}

export function sanitizeAiLogText(value: string): string {
  return value.replace(SECRET_RE, "[redacted]");
}

export type OpenAiHttpError = {
  httpStatus: number;
  errorType: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export function parseOpenAiHttpError(
  payload: unknown,
  httpStatus: number,
): OpenAiHttpError {
  if (typeof payload !== "object" || payload === null) {
    return { httpStatus, errorType: null, errorCode: null, errorMessage: null };
  }
  const error = (payload as { error?: unknown }).error;
  if (typeof error === "string") {
    return {
      httpStatus,
      errorType: null,
      errorCode: null,
      errorMessage: sanitizeAiLogText(error),
    };
  }
  if (typeof error !== "object" || error === null) {
    return { httpStatus, errorType: null, errorCode: null, errorMessage: null };
  }
  const row = error as { type?: unknown; code?: unknown; message?: unknown };
  return {
    httpStatus,
    errorType: typeof row.type === "string" ? row.type : null,
    errorCode: typeof row.code === "string" ? row.code : null,
    errorMessage:
      typeof row.message === "string" ? sanitizeAiLogText(row.message) : null,
  };
}

export function userFacingOpenAiError(error: OpenAiHttpError): string {
  const code = `${error.errorCode ?? ""} ${error.errorType ?? ""}`.toLowerCase();
  const message = error.errorMessage?.toLowerCase() ?? "";
  if (code.includes("insufficient_quota") || message.includes("quota")) {
    return "OpenAI quota exceeded";
  }
  if (error.httpStatus === 401 || code.includes("invalid_api_key")) {
    return "OpenAI authentication failed";
  }
  if (error.httpStatus === 429) {
    return "OpenAI rate limit exceeded";
  }
  if (error.errorType === "invalid_request_error" && error.errorMessage) {
    return error.errorMessage.slice(0, 240);
  }
  return "OpenAI is unavailable";
}

function logOpenAiFailure(info: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }
  console.warn("[ai] openai request failed", info);
}

export class HttpOpenAiClient implements OpenAiClient {
  readonly isMock = false;

  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly timeoutMs: number = OPENAI_TIMEOUT_MS,
  ) {}

  async completeStructured(input: {
    system: string;
    user: string;
    schemaName: string;
    schema: Record<string, unknown>;
  }): Promise<OpenAiCompletionResult> {
    let response: Response;
    try {
      response = await this.fetchFn("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: input.schemaName,
              strict: true,
              schema: input.schema,
            },
          },
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: input.user },
          ],
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      ) {
        return { status: "AI_TIMEOUT" };
      }
      logOpenAiFailure({
        model: this.model,
        thrownName: error instanceof Error ? error.name : "Error",
        thrownMessage: sanitizeAiLogText(
          error instanceof Error ? error.message : "request failed",
        ),
      });
      return { status: "AI_UNAVAILABLE", detail: "OpenAI is unavailable" };
    }

    if (!response.ok) {
      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      const parsed = parseOpenAiHttpError(payload, response.status);
      logOpenAiFailure({
        model: this.model,
        httpStatus: parsed.httpStatus,
        errorType: parsed.errorType,
        errorCode: parsed.errorCode,
        errorMessage: parsed.errorMessage,
      });
      return {
        status: "AI_UNAVAILABLE",
        detail: userFacingOpenAiError(parsed),
      };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return { status: "AI_ANALYSIS_INVALID" };
    }

    const content = extractMessageContent(payload);
    if (!content) {
      return { status: "AI_ANALYSIS_INVALID" };
    }

    try {
      return { status: "ok", value: JSON.parse(content) };
    } catch {
      return { status: "AI_ANALYSIS_INVALID" };
    }
  }
}

export class MockOpenAiClient implements OpenAiClient {
  readonly isMock = true;

  constructor(
    private readonly fixture: unknown,
    readonly model: string = "mock-analysis",
  ) {}

  async completeStructured(): Promise<OpenAiCompletionResult> {
    return { status: "ok", value: this.fixture };
  }
}

export function extractMessageContent(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }
  const first = choices[0] as { message?: { content?: unknown } };
  return typeof first.message?.content === "string" ? first.message.content : null;
}
