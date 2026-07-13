// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentStore } from "@/stores/document-store";
import { useEditorUiStore } from "@/stores/editor-ui-store";
import { loadDocument, undo } from "@/lib/document/commands";
import { createDocument, createShapeObject } from "@/lib/document/defaults";
import type { TextObject } from "@/lib/document/schema";
import { MAX_TOOL_ROUNDS, type WireBlock, type WireMessage } from "./protocol";
import { runAssistantTurn } from "./executor";

// Konva-free text metrics and no-op font loading for jsdom.
vi.mock("@/lib/render/text-measure", () => ({
  measureTextHeightMm: () => 8,
}));
vi.mock("@/lib/fonts/registry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/fonts/registry")>()),
  loadFont: vi.fn().mockResolvedValue(undefined),
}));

interface ScriptedRound {
  content: WireBlock[];
  stop_reason: string;
}

function fetchScript(
  rounds: Array<ScriptedRound | { httpStatus: number; error: string }>,
): typeof fetch {
  let call = 0;
  return vi.fn(async () => {
    const round = rounds[Math.min(call, rounds.length - 1)]!;
    call += 1;
    if ("httpStatus" in round) {
      return new Response(JSON.stringify({ error: round.error }), {
        status: round.httpStatus,
      });
    }
    return new Response(
      JSON.stringify({ role: "assistant", ...round }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;
}

function pastStates(): number {
  return useDocumentStore.temporal.getState().pastStates.length;
}

function currentDoc() {
  const doc = useDocumentStore.getState().doc;
  if (!doc) throw new Error("no doc");
  return doc;
}

beforeEach(() => {
  useEditorUiStore.getState().clearSelection();
  loadDocument(createDocument());
});

describe("runAssistantTurn", () => {
  it("executes a two-round tool turn as ONE undo entry", async () => {
    const fetchImpl = fetchScript([
      {
        content: [
          { type: "text", text: "Adding the pieces." },
          {
            type: "tool_use",
            id: "t1",
            name: "add_text_object",
            input: { text: "Retinol", xMm: 20, yMm: 8, fontSizePt: 12 },
          },
          {
            type: "tool_use",
            id: "t2",
            name: "add_shape_object",
            input: { shape: "rect", fillColorHex: "#112233", widthMm: 10, heightMm: 4 },
          },
        ],
        stop_reason: "tool_use",
      },
      { content: [{ type: "text", text: "Done." }], stop_reason: "end_turn" },
    ]);

    const texts: string[] = [];
    const toolNames: string[] = [];
    const result = await runAssistantTurn({
      history: [],
      userText: "Add a title and a box",
      fetchImpl,
      events: {
        onText: (t) => texts.push(t),
        onToolCall: (r) => toolNames.push(`${r.name}:${r.ok}`),
      },
    });

    // Both objects landed; text height came from the (mocked) metrics.
    const objects = currentDoc().objects;
    expect(objects).toHaveLength(2);
    const text = objects.find((o) => o.type === "text") as TextObject;
    expect(text.text).toBe("Retinol");
    expect(text.heightMm).toBe(8);

    // The WHOLE turn is exactly one undo entry.
    expect(pastStates()).toBe(1);
    undo();
    expect(currentDoc().objects).toHaveLength(0);

    expect(result.rounds).toBe(2);
    expect(result.finalText).toBe("Done.");
    expect(result.aborted).toBe(false);
    expect(texts).toEqual(["Adding the pieces.", "Done."]);
    expect(toolNames).toEqual(["add_text_object:true", "add_shape_object:true"]);

    // History: opening user msg (+state), assistant, ONE user msg with both
    // results, final assistant.
    expect(result.history).toHaveLength(4);
    const results = result.history[2]!;
    expect(results.role).toBe("user");
    const blocks = results.content as WireBlock[];
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.type === "tool_result")).toBe(true);
    expect(blocks.some((b) => "is_error" in b && b.is_error)).toBe(false);

    // The opening message carries the document state, never the raw doc.
    const opening = result.history[0]!.content as WireBlock[];
    expect(
      opening.some((b) => b.type === "text" && b.text.includes("<document_state>")),
    ).toBe(true);
  });

  it("feeds clamp violations back as is_error tool_results without mutating", async () => {
    const rect = createShapeObject(currentDoc(), "rect");
    loadDocument({ ...currentDoc(), objects: [rect] });

    const fetchImpl = fetchScript([
      {
        content: [
          {
            type: "tool_use",
            id: "t1",
            name: "update_object",
            input: { id: rect.id, patch: { xMm: 9999 } },
          },
        ],
        stop_reason: "tool_use",
      },
      { content: [{ type: "text", text: "That was too far." }], stop_reason: "end_turn" },
    ]);

    const reports: Array<{ ok: boolean; detail: string }> = [];
    await runAssistantTurn({
      history: [],
      userText: "Move it way off",
      fetchImpl,
      events: { onToolCall: (r) => reports.push(r) },
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]!.ok).toBe(false);
    expect(reports[0]!.detail).toMatch(/xMm must be between -500 and 500/);
    // Nothing changed, nothing on the undo stack.
    expect(currentDoc().objects[0]!.xMm).toBe(rect.xMm);
    expect(pastStates()).toBe(0);
  });

  it("rejects unknown patch fields with the valid field list", async () => {
    const rect = createShapeObject(currentDoc(), "rect");
    loadDocument({ ...currentDoc(), objects: [rect] });

    const fetchImpl = fetchScript([
      {
        content: [
          {
            type: "tool_use",
            id: "t1",
            name: "update_object",
            input: { id: rect.id, patch: { colour: "#ffffff" } },
          },
        ],
        stop_reason: "tool_use",
      },
      { content: [{ type: "text", text: "ok" }], stop_reason: "end_turn" },
    ]);

    const reports: Array<{ ok: boolean; detail: string }> = [];
    const result = await runAssistantTurn({
      history: [],
      userText: "recolor",
      fetchImpl,
      events: { onToolCall: (r) => reports.push(r) },
    });

    expect(reports[0]!.detail).toMatch(/Unknown field "colour" for rect objects/);
    expect(reports[0]!.detail).toMatch(/fill/);
    const errBlock = (result.history[2]!.content as WireBlock[])[0]!;
    expect(errBlock).toMatchObject({ type: "tool_result", is_error: true });
  });

  it("forces a no-tools summary round when the budget is exhausted", async () => {
    const readRound: ScriptedRound = {
      content: [
        { type: "tool_use", id: "tX", name: "get_document_state", input: {} },
      ],
      stop_reason: "tool_use",
    };
    const rounds: Array<ScriptedRound> = Array.from(
      { length: MAX_TOOL_ROUNDS },
      () => readRound,
    );
    rounds.push({
      content: [{ type: "text", text: "Summary: nothing left." }],
      stop_reason: "end_turn",
    });
    const fetchImpl = fetchScript(rounds);

    const result = await runAssistantTurn({
      history: [],
      userText: "loop forever",
      fetchImpl,
    });

    expect(result.rounds).toBe(MAX_TOOL_ROUNDS + 1);
    expect(result.finalText).toBe("Summary: nothing left.");
    const budgetNote = result.history.find(
      (m) =>
        m.role === "user" &&
        Array.isArray(m.content) &&
        m.content.some(
          (b) => b.type === "text" && b.text.includes("Tool budget for this turn is used up"),
        ),
    );
    expect(budgetNote).toBeTruthy();
  });

  it("closes out remaining tool calls when aborted mid-round", async () => {
    const controller = new AbortController();
    const fetchImpl = fetchScript([
      {
        content: [
          {
            type: "tool_use",
            id: "t1",
            name: "add_shape_object",
            input: { shape: "rect" },
          },
          {
            type: "tool_use",
            id: "t2",
            name: "add_shape_object",
            input: { shape: "ellipse" },
          },
        ],
        stop_reason: "tool_use",
      },
      { content: [{ type: "text", text: "never reached" }], stop_reason: "end_turn" },
    ]);

    const result = await runAssistantTurn({
      history: [],
      userText: "add stuff",
      fetchImpl,
      signal: controller.signal,
      events: {
        onToolCall: () => controller.abort(), // abort after the FIRST tool
      },
    });

    expect(result.aborted).toBe(true);
    // First tool ran; second was refused but still answered (no orphans).
    expect(currentDoc().objects).toHaveLength(1);
    const results = result.history.at(-1)!.content as WireBlock[];
    expect(results).toHaveLength(2);
    expect(results[1]).toMatchObject({
      type: "tool_result",
      tool_use_id: "t2",
      is_error: true,
    });
    // The partial work is still one clean undo entry.
    expect(pastStates()).toBe(1);
    undo();
    expect(currentDoc().objects).toHaveLength(0);
  });

  it("surfaces HTTP errors as AssistantRequestError with the server message", async () => {
    const fetchImpl = fetchScript([
      { httpStatus: 503, error: "The AI assistant isn't configured on this deployment." },
    ]);
    await expect(
      runAssistantTurn({ history: [], userText: "hi", fetchImpl }),
    ).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining("isn't configured"),
    });
    expect(pastStates()).toBe(0);
  });

  it("keeps prior history and passes it back to the server trimmed", async () => {
    const prior: WireMessage[] = [
      { role: "user", content: "earlier question" },
      { role: "assistant", content: [{ type: "text", text: "earlier answer" }] },
    ];
    const fetchImpl = fetchScript([
      { content: [{ type: "text", text: "hello again" }], stop_reason: "end_turn" },
    ]);
    const result = await runAssistantTurn({
      history: prior,
      userText: "follow-up",
      fetchImpl,
    });
    expect(result.history).toHaveLength(4);
    const posted = JSON.parse(
      (vi.mocked(fetchImpl).mock.calls[0]![1] as RequestInit).body as string,
    ) as { messages: WireMessage[] };
    expect(posted.messages[0]).toEqual(prior[0]);
    expect(posted.messages).toHaveLength(3);
  });
});
