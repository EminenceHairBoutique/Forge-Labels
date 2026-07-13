"use client";

import { create } from "zustand";
import type { WireMessage } from "@/lib/assistant/protocol";
import {
  AssistantRequestError,
  runAssistantTurn,
  type ToolCallReport,
} from "@/lib/assistant/executor";

/**
 * Editor-session assistant chat. Lives in a store (not panel state) so
 * switching sidebar tabs — which unmounts the panel — neither wipes the
 * transcript nor detaches an in-flight turn. Never persisted; reset when a
 * project loads.
 */

export interface AssistantChatItem {
  id: number;
  kind: "user" | "assistant" | "tools" | "error" | "stopped";
  text: string;
  tools: ToolCallReport[];
}

interface AssistantChatState {
  items: AssistantChatItem[];
  wire: WireMessage[];
  running: boolean;
  send: (text: string) => Promise<void>;
  stop: () => void;
  reset: () => void;
}

let nextId = 1;
let controller: AbortController | null = null;

export const useAssistantStore = create<AssistantChatState>()((set, get) => {
  const push = (item: Omit<AssistantChatItem, "id">): number => {
    const id = nextId++;
    set((s) => ({ items: [...s.items, { ...item, id }] }));
    return id;
  };

  return {
    items: [],
    wire: [],
    running: false,

    send: async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || get().running) return;

      push({ kind: "user", text: trimmed, tools: [] });
      set({ running: true });
      controller = new AbortController();

      let openToolsId: number | null = null;
      try {
        const result = await runAssistantTurn({
          history: get().wire,
          userText: trimmed,
          signal: controller.signal,
          events: {
            onText: (t) => {
              openToolsId = null;
              push({ kind: "assistant", text: t, tools: [] });
            },
            onToolCall: (report) => {
              if (openToolsId === null) {
                openToolsId = push({ kind: "tools", text: "", tools: [report] });
              } else {
                const id = openToolsId;
                set((s) => ({
                  items: s.items.map((item) =>
                    item.id === id ? { ...item, tools: [...item.tools, report] } : item,
                  ),
                }));
              }
            },
          },
        });
        set({ wire: result.history });
        if (result.aborted) {
          push({ kind: "stopped", text: "Stopped — changes so far are one undo step.", tools: [] });
        }
      } catch (err) {
        const message =
          err instanceof AssistantRequestError
            ? err.message
            : "The assistant request failed — check your connection and try again.";
        push({ kind: "error", text: message, tools: [] });
      } finally {
        controller = null;
        set({ running: false });
      }
    },

    stop: () => {
      controller?.abort();
    },

    reset: () => {
      controller?.abort();
      controller = null;
      set({ items: [], wire: [], running: false });
    },
  };
});
