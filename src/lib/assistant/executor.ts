"use client";

import { beginGesture, endGesture } from "@/lib/document/commands";
import { useDocumentStore } from "@/stores/document-store";
import { useEditorUiStore } from "@/stores/editor-ui-store";
import {
  MAX_TOOL_ROUNDS,
  trimHistory,
  type AssistantResponse,
  type WireBlock,
  type WireMessage,
} from "./protocol";
import { summarizeDocument } from "./summarize";
import { AssistantToolError, executeAssistantTool } from "./execute";
import { getAssistantTool } from "./tools";

/**
 * One assistant turn: POST the conversation, execute any tool calls against
 * the live document, feed the results back, repeat — at most MAX_TOOL_ROUNDS
 * model rounds per user message.
 *
 * Undo contract: the whole turn is ONE gesture (opened lazily before the
 * first mutating tool, closed in `finally`), so Cmd+Z after "make me a
 * skincare label" reverts the entire turn. Because the gesture spans awaits,
 * a manual edit made mid-turn merges into the same undo entry — the panel
 * shows an "Assistant is editing…" notice for exactly this reason.
 *
 * History hygiene: every assistant tool_use gets a matching tool_result
 * (real, error, or cancelled) before the turn ends — the API rejects
 * histories with orphaned tool calls, so an abort must still close them out.
 */

export interface ToolCallReport {
  name: string;
  ok: boolean;
  detail: string;
}

export interface AssistantTurnEvents {
  /** Fired per assistant text block, in order. */
  onText?: (text: string) => void;
  /** Fired after each tool call executes (or fails). */
  onToolCall?: (report: ToolCallReport) => void;
}

export interface AssistantTurnResult {
  /** Updated conversation to carry into the next turn. */
  history: WireMessage[];
  /** Concatenated assistant text of the final round. */
  finalText: string;
  rounds: number;
  aborted: boolean;
}

export class AssistantRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

function toolUsesOf(blocks: readonly WireBlock[]): ToolUseBlock[] {
  return blocks.filter((b): b is ToolUseBlock => b.type === "tool_use");
}

function textOf(blocks: readonly WireBlock[]): string {
  return blocks
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

async function requestRound(
  messages: WireMessage[],
  fetchImpl: typeof fetch,
  signal: AbortSignal | undefined,
): Promise<AssistantResponse> {
  const res = await fetchImpl("/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    signal,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new AssistantRequestError(
      body?.error ?? `Assistant request failed (${res.status}).`,
      res.status,
    );
  }
  return (await res.json()) as AssistantResponse;
}

export async function runAssistantTurn(options: {
  history: readonly WireMessage[];
  userText: string;
  signal?: AbortSignal;
  events?: AssistantTurnEvents;
  /** Test seam. */
  fetchImpl?: typeof fetch;
}): Promise<AssistantTurnResult> {
  const { doc } = useDocumentStore.getState();
  const selection = useEditorUiStore.getState().selection;
  const fetchImpl = options.fetchImpl ?? fetch;
  const events = options.events ?? {};

  const opening: WireMessage = {
    role: "user",
    content: [
      { type: "text", text: options.userText },
      {
        type: "text",
        text: `<document_state>\n${doc ? summarizeDocument(doc, selection) : "No document is open."}\n</document_state>`,
      },
    ],
  };
  let messages = trimHistory([...options.history, opening]);

  let gestureOpen = false;
  let finalText = "";
  let rounds = 0;
  let aborted = false;

  const closeOutToolUses = (toolUses: ToolUseBlock[], reason: string) => {
    messages = [
      ...messages,
      {
        role: "user",
        content: toolUses.map((tool) => ({
          type: "tool_result" as const,
          tool_use_id: tool.id,
          content: reason,
          is_error: true,
        })),
      },
    ];
  };

  try {
    let forcedSummary = false;
    for (;;) {
      let response: AssistantResponse;
      try {
        response = await requestRound(messages, fetchImpl, options.signal);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          aborted = true;
          break;
        }
        throw err;
      }
      rounds += 1;
      messages = [...messages, { role: "assistant", content: response.content }];

      const text = textOf(response.content);
      if (text) {
        finalText = text;
        events.onText?.(text);
      }

      const toolUses = toolUsesOf(response.content);
      if (response.stop_reason !== "tool_use" || toolUses.length === 0) break;

      if (forcedSummary) {
        // The summary round ignored instructions and asked for more tools:
        // close them out so the history stays valid, then stop.
        closeOutToolUses(toolUses, "Tool budget for this turn is exhausted.");
        break;
      }

      // Execute every requested tool, in order, collecting one result each.
      const results: WireBlock[] = [];
      for (const tool of toolUses) {
        if (options.signal?.aborted || aborted) {
          results.push({
            type: "tool_result",
            tool_use_id: tool.id,
            content: "Cancelled by the user.",
            is_error: true,
          });
          continue;
        }
        if (getAssistantTool(tool.name)?.mutating && !gestureOpen) {
          beginGesture();
          gestureOpen = true;
        }
        try {
          const content = await executeAssistantTool(tool.name, tool.input);
          results.push({ type: "tool_result", tool_use_id: tool.id, content });
          events.onToolCall?.({ name: tool.name, ok: true, detail: content });
        } catch (err) {
          const detail =
            err instanceof AssistantToolError
              ? err.message
              : `Tool failed unexpectedly: ${err instanceof Error ? err.message : String(err)}`;
          results.push({
            type: "tool_result",
            tool_use_id: tool.id,
            content: detail,
            is_error: true,
          });
          events.onToolCall?.({ name: tool.name, ok: false, detail });
        }
      }
      messages = [...messages, { role: "user", content: results }];

      if (options.signal?.aborted) {
        aborted = true;
        break;
      }

      if (rounds >= MAX_TOOL_ROUNDS) {
        // Budget spent: one final round, no more execution.
        messages = [
          ...messages,
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Tool budget for this turn is used up. Summarize what you changed and what (if anything) remains — do not call more tools.",
              },
            ],
          },
        ];
        forcedSummary = true;
      }
    }
  } finally {
    if (gestureOpen) endGesture();
  }

  return { history: messages, finalText, rounds, aborted };
}
