import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  ASSISTANT_SYSTEM_PROMPT,
  assistantEffort,
  assistantModel,
  isAssistantConfigured,
} from "@/lib/assistant/server";
import { AssistantRequestSchema, MAX_BODY_BYTES } from "@/lib/assistant/protocol";
import { assistantToolWireDefs } from "@/lib/assistant/tools";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Assistant proxy: one model round per POST. The browser owns the
 * conversation and executes tools against the live document; this route
 * owns the API key, the system prompt, and the tool definitions (the
 * client can never inject either).
 *
 * Guard order: key configured → same-origin → auth (cloud mode only) →
 * rate limit → size cap → schema. Errors are honest and non-leaky.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const RATE_LIMIT = 20; // requests…
const RATE_WINDOW_MS = 60_000; // …per minute per user/IP

const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_WINDOW_MS;
  const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);
  if (recent.length >= RATE_LIMIT) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 1000) {
    // Drop stale buckets so the map can't grow unbounded.
    for (const [k, list] of hits) {
      if (list.every((t) => t <= windowStart)) hits.delete(k);
    }
  }
  return false;
}

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // non-browser clients carry no Origin
  try {
    return new URL(origin).host === (request.headers.get("host") ?? "");
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAssistantConfigured()) {
    return NextResponse.json(
      {
        error:
          "The AI assistant isn't configured on this deployment — set ANTHROPIC_API_KEY (see docs/SETUP.md).",
      },
      { status: 503 },
    );
  }

  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }

  // Cloud mode: the assistant spends the operator's API budget — require a
  // signed-in user. Local demo mode has no auth system; same-origin + key
  // possession is the boundary there.
  let rateKey =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const supabase = await getSupabaseServer();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Sign in to use the assistant." },
        { status: 401 },
      );
    }
    rateKey = user.id;
  }

  if (rateLimited(rateKey)) {
    return NextResponse.json(
      { error: "Too many assistant requests — try again in a minute." },
      { status: 429 },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Conversation is too large — clear the chat and try again." },
      { status: 413 },
    );
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Conversation is too large — clear the chat and try again." },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const parsed = AssistantRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Invalid request: ${parsed.error.issues[0]?.message ?? "malformed messages"}` },
      { status: 400 },
    );
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: assistantModel(),
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      output_config: { effort: assistantEffort() },
      system: [
        {
          type: "text",
          text: ASSISTANT_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: assistantToolWireDefs() as unknown as Anthropic.Messages.ToolUnion[],
      messages: parsed.data.messages as unknown as Anthropic.MessageParam[],
    });
    return NextResponse.json(
      {
        role: "assistant",
        content: response.content,
        stop_reason: response.stop_reason,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "The configured ANTHROPIC_API_KEY was rejected — check it in your deployment settings." },
        { status: 503 },
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "The Claude API rate limit was hit — try again shortly." },
        { status: 429 },
      );
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `The Claude API returned an error (${err.status ?? "unknown"}).` },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: "The assistant request failed unexpectedly." },
      { status: 502 },
    );
  }
}
