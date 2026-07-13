import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { MAX_BODY_BYTES } from "@/lib/assistant/protocol";

/**
 * Route contract tests — no live API key. The SDK is mocked at the module
 * boundary; everything up to the SDK call (guards, auth, limits, schema)
 * runs for real.
 */

const { createMock, supabaseMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  supabaseMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status: number | undefined;
    constructor(message = "api error", status: number | undefined = 500) {
      super(message);
      this.status = status;
    }
  }
  class AuthenticationError extends APIError {
    constructor() {
      super("invalid x-api-key", 401);
    }
  }
  class RateLimitError extends APIError {
    constructor() {
      super("rate limited", 429);
    }
  }
  class MockAnthropic {
    static APIError = APIError;
    static AuthenticationError = AuthenticationError;
    static RateLimitError = RateLimitError;
    messages = { create: createMock };
  }
  return { default: MockAnthropic };
});

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: supabaseMock,
}));

import { POST } from "./route";
import { GET } from "./status/route";

const sdkErrors = Anthropic as unknown as {
  AuthenticationError: new () => Error;
  RateLimitError: new () => Error;
  APIError: new (message?: string, status?: number) => Error;
};

function post(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:3100/api/assistant", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
}

const VALID_BODY = { messages: [{ role: "user", content: "hello" }] };
const MODEL_REPLY = {
  content: [{ type: "text", text: "Hi!" }],
  stop_reason: "end_turn",
};

beforeEach(() => {
  vi.unstubAllEnvs();
  createMock.mockReset().mockResolvedValue(MODEL_REPLY);
  supabaseMock.mockReset().mockResolvedValue(null); // local mode by default
});

describe("GET /api/assistant/status", () => {
  it("reports unconfigured + local without env", async () => {
    const res = GET();
    expect(await res.json()).toEqual({ configured: false, mode: "local" });
  });

  it("reports configured once the key is set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const res = GET();
    expect(await res.json()).toEqual({ configured: true, mode: "local" });
  });
});

describe("POST /api/assistant", () => {
  it("503s honestly when no API key is configured", async () => {
    const res = await POST(post(VALID_BODY));
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/ANTHROPIC_API_KEY/);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("403s cross-origin browser requests", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const res = await POST(
      post(VALID_BODY, { origin: "https://evil.example", host: "localhost:3100" }),
    );
    expect(res.status).toBe(403);
  });

  it("accepts same-origin browser requests", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const res = await POST(
      post(VALID_BODY, { origin: "http://localhost:3100", host: "localhost:3100" }),
    );
    expect(res.status).toBe(200);
  });

  it("401s in cloud mode without a signed-in user", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    supabaseMock.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null } }) },
    });
    const res = await POST(post(VALID_BODY));
    expect(res.status).toBe(401);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("proceeds in cloud mode for a signed-in user", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    supabaseMock.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    });
    const res = await POST(post(VALID_BODY));
    expect(res.status).toBe(200);
  });

  it("413s oversized conversations", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const res = await POST(
      post(VALID_BODY, { "content-length": String(MAX_BODY_BYTES + 1) }),
    );
    expect(res.status).toBe(413);
  });

  it("400s malformed JSON and schema violations", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    expect((await POST(post("{not json"))).status).toBe(400);
    expect((await POST(post({ messages: [] }))).status).toBe(400);
    expect(
      (await POST(post({ messages: VALID_BODY.messages, tools: [] }))).status,
    ).toBe(400); // tools are server-owned — clients can't inject them
  });

  it("passes messages through and returns the assistant blocks verbatim", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const res = await POST(post(VALID_BODY));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ role: "assistant", ...MODEL_REPLY });

    const params = createMock.mock.calls[0]![0] as {
      model: string;
      max_tokens: number;
      thinking: unknown;
      system: Array<{ cache_control?: unknown }>;
      tools: unknown[];
      messages: unknown[];
    };
    expect(params.model).toBe("claude-opus-4-8");
    expect(params.thinking).toEqual({ type: "adaptive" });
    expect(params.tools).toHaveLength(16);
    expect(params.system[0]!.cache_control).toEqual({ type: "ephemeral" });
    expect(params.messages).toEqual(VALID_BODY.messages);
  });

  it("honors the ASSISTANT_MODEL override", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    vi.stubEnv("ASSISTANT_MODEL", "claude-sonnet-5");
    await POST(post(VALID_BODY));
    expect(createMock.mock.calls[0]![0]).toMatchObject({ model: "claude-sonnet-5" });
  });

  it("maps SDK errors to honest statuses without leaking internals", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");

    createMock.mockRejectedValueOnce(new sdkErrors.AuthenticationError());
    expect((await POST(post(VALID_BODY))).status).toBe(503);

    createMock.mockRejectedValueOnce(new sdkErrors.RateLimitError());
    expect((await POST(post(VALID_BODY))).status).toBe(429);

    createMock.mockRejectedValueOnce(new sdkErrors.APIError("overloaded", 529));
    const res = await POST(post(VALID_BODY));
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).not.toMatch(/overloaded/); // upstream text stays server-side
  });

  it("rate limits per client after 20 requests in a minute", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const headers = { "x-forwarded-for": "203.0.113.7" };
    for (let i = 0; i < 20; i++) {
      expect((await POST(post(VALID_BODY, headers))).status).toBe(200);
    }
    const res = await POST(post(VALID_BODY, headers));
    expect(res.status).toBe(429);
  });
});
