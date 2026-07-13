"use client";

import * as React from "react";
import { CircleAlert, Eraser, Send, Sparkles, Square, Wrench } from "lucide-react";
import type { AssistantStatus } from "@/lib/assistant/protocol";
import { useAssistantStore, type AssistantChatItem } from "@/stores/assistant-store";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * AI assistant tab. Key-gated: without ANTHROPIC_API_KEY on the server the
 * panel explains exactly what's missing (capability gating — never a dead
 * button). The chat itself lives in assistant-store so tab switches don't
 * drop the transcript or an in-flight turn.
 */

const SUGGESTIONS = [
  "Add the product name in a bold serif at the top",
  "Give it a dark background and make the text light",
  "Add a QR code to example.com in the bottom-right corner",
  "Tidy up the alignment",
];

export function AssistantPanel() {
  const [status, setStatus] = React.useState<AssistantStatus | null | "error">(null);

  React.useEffect(() => {
    let alive = true;
    fetch("/api/assistant/status")
      .then((res) => (res.ok ? (res.json() as Promise<AssistantStatus>) : Promise.reject()))
      .then((s) => {
        if (alive) setStatus(s);
      })
      .catch(() => {
        if (alive) setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  if (status === null) {
    return (
      <div className="space-y-3 p-4" aria-busy>
        <Skeleton className="h-16" />
        <Skeleton className="h-8" />
      </div>
    );
  }

  if (status === "error" || !status.configured) {
    return (
      <div className="p-4">
        <Callout variant="info" title="Assistant not configured">
          <p>
            The AI design assistant activates when the deployment sets an{" "}
            <code className="text-xs">ANTHROPIC_API_KEY</code> — it then edits your
            label through the same undoable commands as the editor.
          </p>
          <p className="mt-2">
            Setup lives in <code className="text-xs">docs/SETUP.md</code>. Nothing
            else changes: every editor feature works without it.
          </p>
        </Callout>
      </div>
    );
  }

  return <AssistantChat />;
}

function AssistantChat() {
  const items = useAssistantStore((s) => s.items);
  const running = useAssistantStore((s) => s.running);
  const send = useAssistantStore((s) => s.send);
  const stop = useAssistantStore((s) => s.stop);
  const reset = useAssistantStore((s) => s.reset);
  const [draft, setDraft] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items, running]);

  const submit = () => {
    const text = draft.trim();
    if (!text || running) return;
    setDraft("");
    void send(text);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
        aria-label="Assistant conversation"
      >
        {items.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Describe a change and the assistant edits the canvas directly —
              every reply is a single undo step.
            </p>
            <div className="space-y-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {items.map((item) => (
          <ChatItem key={item.id} item={item} />
        ))}
        {running && (
          <p
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
            role="status"
          >
            <Sparkles className="size-3.5 animate-pulse text-primary" aria-hidden />
            Assistant is editing… manual edits made now merge into its undo step.
          </p>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-border p-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="e.g. Move the title up 2mm and make it gold"
          rows={2}
          disabled={running}
          aria-label="Message the assistant"
          className="resize-none text-sm"
        />
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            disabled={items.length === 0 && !running}
            className="text-xs text-muted-foreground"
          >
            <Eraser className="size-3.5" aria-hidden /> Clear
          </Button>
          {running ? (
            <Button variant="outline" size="sm" onClick={stop}>
              <Square className="size-3.5" aria-hidden /> Stop
            </Button>
          ) : (
            <Button size="sm" onClick={submit} disabled={!draft.trim()}>
              <Send className="size-3.5" aria-hidden /> Send
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChatItem({ item }: { item: AssistantChatItem }) {
  switch (item.kind) {
    case "user":
      return (
        <div className="ml-6 rounded-lg rounded-br-sm bg-primary-subtle px-3 py-2 text-sm">
          {item.text}
        </div>
      );
    case "assistant":
      return (
        <div className="mr-2 whitespace-pre-wrap text-sm text-foreground">{item.text}</div>
      );
    case "tools":
      return (
        <div className="flex flex-wrap gap-1">
          {item.tools.map((tool, i) => (
            <span
              key={i}
              title={tool.detail}
              className={cn(
                "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium",
                tool.ok
                  ? "border-border bg-muted text-muted-foreground"
                  : "border-destructive/40 bg-destructive/10 text-destructive",
              )}
            >
              <Wrench className="size-2.5" aria-hidden />
              {tool.name}
            </span>
          ))}
        </div>
      );
    case "error":
      return (
        <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {item.text}
        </p>
      );
    case "stopped":
      return <p className="text-xs italic text-muted-foreground">{item.text}</p>;
  }
}
