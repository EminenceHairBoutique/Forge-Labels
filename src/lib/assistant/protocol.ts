import { z } from "zod";

/**
 * Assistant wire protocol — shared between the browser executor and the
 * server route, with NO dependency on the Anthropic SDK (the client bundle
 * never includes it) and none on the DOM (the route can import this).
 *
 * The client keeps the whole conversation (the API is stateless) and sends
 * it on every round; the server owns the system prompt, the tool
 * definitions, and the API key. Content blocks it doesn't understand
 * (thinking, redacted_thinking…) must round-trip verbatim — the API rejects
 * histories whose thinking blocks were stripped or reworded.
 */

export const MAX_TOOL_ROUNDS = 8;
export const MAX_WIRE_MESSAGES = 40;
export const MAX_BODY_BYTES = 256 * 1024;
export const MAX_TEXT_BLOCK_CHARS = 16_000;
export const MAX_SUMMARY_CHARS = 8_000;

/** Confirmed against the claude-api docs — never guess model ids. */
export const DEFAULT_ASSISTANT_MODEL = "claude-opus-4-8";

const TextBlockSchema = z.object({
  type: z.literal("text"),
  text: z.string().max(MAX_TEXT_BLOCK_CHARS),
});

const ToolUseBlockSchema = z.object({
  type: z.literal("tool_use"),
  id: z.string().min(1),
  name: z.string().min(1),
  input: z.unknown(),
});

const ToolResultBlockSchema = z.object({
  type: z.literal("tool_result"),
  tool_use_id: z.string().min(1),
  content: z.string().max(MAX_TEXT_BLOCK_CHARS),
  is_error: z.boolean().optional(),
});

/** Opaque passthrough: signatures and internals must survive untouched. */
const ThinkingBlockSchema = z.looseObject({ type: z.literal("thinking") });
const RedactedThinkingBlockSchema = z.looseObject({
  type: z.literal("redacted_thinking"),
});

export const BlockSchema = z.union([
  TextBlockSchema,
  ToolUseBlockSchema,
  ToolResultBlockSchema,
  ThinkingBlockSchema,
  RedactedThinkingBlockSchema,
]);
export type WireBlock = z.infer<typeof BlockSchema>;

export const WireMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.union([
    z.string().max(MAX_TEXT_BLOCK_CHARS),
    z.array(BlockSchema).min(1).max(64),
  ]),
});
export type WireMessage = z.infer<typeof WireMessageSchema>;

/** POST /api/assistant body. Tools and system prompt are server-owned. */
export const AssistantRequestSchema = z.strictObject({
  messages: z.array(WireMessageSchema).min(1).max(MAX_WIRE_MESSAGES),
});
export type AssistantRequest = z.infer<typeof AssistantRequestSchema>;

/** POST /api/assistant 200 response (assistant message passthrough). */
export interface AssistantResponse {
  role: "assistant";
  /** Content blocks verbatim from the model (round-trip these). */
  content: WireBlock[];
  stop_reason: string | null;
}

/** GET /api/assistant/status response. */
export interface AssistantStatus {
  configured: boolean;
  mode: "cloud" | "local";
}

/**
 * Trim a history to the wire cap without orphaning tool_use/tool_result
 * pairs: drop oldest-first, then keep dropping until the window starts on a
 * plain user message (the API rejects tool_results whose tool_use fell out).
 */
export function trimHistory(messages: WireMessage[]): WireMessage[] {
  let start = Math.max(0, messages.length - MAX_WIRE_MESSAGES);
  while (start < messages.length && !startsConversation(messages[start]!)) {
    start += 1;
  }
  return start === 0 ? messages : messages.slice(start);
}

function startsConversation(message: WireMessage): boolean {
  if (message.role !== "user") return false;
  if (typeof message.content === "string") return true;
  return message.content.every((block) => block.type !== "tool_result");
}
