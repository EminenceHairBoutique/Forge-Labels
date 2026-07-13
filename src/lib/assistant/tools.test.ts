import { describe, expect, it } from "vitest";
import {
  AddTextObjectInput,
  ASSISTANT_TOOLS,
  assistantToolWireDefs,
  DistributeObjectsInput,
  GroupObjectsInput,
  RemoveObjectsInput,
  SetBackgroundInput,
} from "./tools";
import { trimHistory, MAX_WIRE_MESSAGES, type WireMessage } from "./protocol";

describe("assistant tool registry", () => {
  it("exposes the full editing toolset with unique snake_case names", () => {
    const names = ASSISTANT_TOOLS.map((t) => t.name);
    expect(names).toHaveLength(16);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it("marks only the read/highlight tools as non-mutating", () => {
    const nonMutating = ASSISTANT_TOOLS.filter((t) => !t.mutating).map((t) => t.name);
    expect(nonMutating.sort()).toEqual(["get_document_state", "select_objects"]);
  });

  it("generates JSON-schema wire defs the Messages API accepts", () => {
    const defs = assistantToolWireDefs();
    expect(defs).toHaveLength(ASSISTANT_TOOLS.length);
    for (const def of defs) {
      expect(def.description.length).toBeGreaterThan(20);
      expect(def.input_schema.type).toBe("object");
      expect(def.input_schema).not.toHaveProperty("$schema");
      // Round-trippable through JSON (no functions, no undefined).
      expect(JSON.parse(JSON.stringify(def))).toEqual(def);
    }
  });

  it("keeps numeric rails in the wire schema so the model self-clamps", () => {
    const add = assistantToolWireDefs().find((d) => d.name === "add_text_object")!;
    const props = add.input_schema.properties as Record<
      string,
      { minimum?: number; maximum?: number }
    >;
    expect(props.xMm).toMatchObject({ minimum: -500, maximum: 500 });
    expect(props.fontSizePt).toMatchObject({ minimum: 2, maximum: 200 });
  });
});

describe("tool input validation", () => {
  it("rejects out-of-range coordinates and empty text", () => {
    expect(AddTextObjectInput.safeParse({ text: "", xMm: 0 }).success).toBe(false);
    expect(AddTextObjectInput.safeParse({ text: "ok", xMm: 9999 }).success).toBe(false);
    expect(AddTextObjectInput.safeParse({ text: "ok", xMm: 20.5 }).success).toBe(true);
  });

  it("rejects unknown top-level fields (strict objects)", () => {
    expect(AddTextObjectInput.safeParse({ text: "ok", bogus: 1 }).success).toBe(false);
  });

  it("caps id lists at 50 and enforces minimums", () => {
    const many = Array.from({ length: 51 }, (_, i) => `id${i}`);
    expect(RemoveObjectsInput.safeParse({ ids: many }).success).toBe(false);
    expect(RemoveObjectsInput.safeParse({ ids: [] }).success).toBe(false);
    expect(GroupObjectsInput.safeParse({ ids: ["a"] }).success).toBe(false);
    expect(DistributeObjectsInput.safeParse({ ids: ["a", "b"], axis: "horizontal" }).success).toBe(
      false,
    );
  });

  it("rejects malformed hex colors and bad gradient stops", () => {
    expect(SetBackgroundInput.safeParse({ type: "solid", color: "red" }).success).toBe(false);
    expect(SetBackgroundInput.safeParse({ type: "solid", color: "#12x" }).success).toBe(false);
    expect(SetBackgroundInput.safeParse({ type: "solid", color: "#1a2b3c" }).success).toBe(true);
    expect(
      SetBackgroundInput.safeParse({
        type: "linear-gradient",
        stops: [{ offset: 0, color: "#000000" }],
      }).success,
    ).toBe(false);
  });
});

describe("trimHistory", () => {
  const user = (i: number): WireMessage => ({ role: "user", content: `q${i}` });
  const assistant = (i: number): WireMessage => ({ role: "assistant", content: `a${i}` });
  const toolResults: WireMessage = {
    role: "user",
    content: [{ type: "tool_result", tool_use_id: "t1", content: "ok" }],
  };

  it("keeps short histories untouched", () => {
    const history = [user(1), assistant(1)];
    expect(trimHistory(history)).toBe(history);
  });

  it("caps at the wire limit and starts on a plain user message", () => {
    const long: WireMessage[] = [];
    for (let i = 0; i < 30; i++) long.push(user(i), assistant(i));
    const trimmed = trimHistory(long);
    expect(trimmed.length).toBeLessThanOrEqual(MAX_WIRE_MESSAGES);
    expect(trimmed[0]!.role).toBe("user");
  });

  it("never starts the window on an orphaned tool_result", () => {
    const long: WireMessage[] = [];
    for (let i = 0; i < 21; i++) long.push(user(i), assistant(i), toolResults, assistant(i));
    const trimmed = trimHistory(long);
    const first = trimmed[0]!;
    expect(first.role).toBe("user");
    expect(typeof first.content === "string").toBe(true);
  });
});
