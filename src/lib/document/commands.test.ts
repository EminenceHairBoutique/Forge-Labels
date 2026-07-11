// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { useDocumentStore } from "@/stores/document-store";
import { useEditorUiStore } from "@/stores/editor-ui-store";
import {
  addObject,
  beginGesture,
  duplicateObjects,
  endGesture,
  findObject,
  loadDocument,
  redo,
  removeObjects,
  reorderObjects,
  undo,
  updateObject,
  withGesture,
} from "./commands";
import { createDocument, createShapeObject, createTextObject } from "./defaults";
import { migrateDocument } from "./migrate";
import { parseLabelDocument, type RectObject, type TextObject } from "./schema";

function freshDoc() {
  const doc = createDocument();
  loadDocument(doc);
  return doc;
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

describe("document schema", () => {
  it("createDocument produces a valid document sized by the calculator", () => {
    const doc = createDocument();
    const parsed = parseLabelDocument(doc);
    // 10 mL serum: ⌀24.5 → width = 76.969 − 3 = 73.969, height = 30 − 4 = 26.
    expect(parsed.label.widthMm).toBeCloseTo(73.969, 3);
    expect(parsed.label.heightMm).toBe(26);
    expect(parsed.vial.presetId).toBe("10ml-serum");
  });

  it("migrateDocument round-trips a current document", () => {
    const doc = createDocument();
    const restored = migrateDocument(JSON.parse(JSON.stringify(doc)));
    expect(restored).toEqual(doc);
  });

  it("migrateDocument rejects documents from a newer schema", () => {
    const doc = { ...createDocument(), schemaVersion: 999 };
    expect(() => migrateDocument(doc)).toThrow(/newer version/i);
  });

  it("rejects invalid objects", () => {
    const doc = createDocument();
    const bad = {
      ...doc,
      objects: [{ id: "x", type: "text", xMm: 0 }],
    };
    expect(() => parseLabelDocument(bad)).toThrow();
  });
});

describe("object commands and undo", () => {
  it("addObject appends and selects; undo removes and prunes selection", () => {
    const doc = freshDoc();
    const text = createTextObject(doc);
    addObject(text);

    expect(currentDoc().objects).toHaveLength(1);
    expect(useEditorUiStore.getState().selection).toEqual([text.id]);

    undo();
    expect(currentDoc().objects).toHaveLength(0);
    expect(useEditorUiStore.getState().selection).toEqual([]);

    redo();
    expect(currentDoc().objects).toHaveLength(1);
  });

  it("updateObject patches any depth and keeps sibling references", () => {
    const doc = freshDoc();
    const a = createShapeObject(doc, "rect");
    const b = createShapeObject(doc, "ellipse");
    addObject(a);
    addObject(b);

    const before = currentDoc();
    updateObject<RectObject>(a.id, { xMm: 10 });
    const after = currentDoc();

    expect((findObject(after, a.id) as RectObject).xMm).toBe(10);
    // Untouched sibling keeps its reference (structural sharing).
    expect(findObject(after, b.id)).toBe(findObject(before, b.id));
  });

  it("a gesture with many updates costs exactly one undo entry", () => {
    const doc = freshDoc();
    const text = createTextObject(doc, { fontSizePt: 10 });
    addObject(text);
    const entriesBefore =
      useDocumentStore.temporal.getState().pastStates.length;

    beginGesture();
    for (let size = 11; size <= 30; size++) {
      updateObject<TextObject>(text.id, { fontSizePt: size });
    }
    endGesture();

    const temporal = useDocumentStore.temporal.getState();
    expect((findObject(currentDoc(), text.id) as TextObject).fontSizePt).toBe(30);
    expect(temporal.pastStates.length).toBe(entriesBefore + 1);

    undo();
    // One undo returns to the pre-gesture value, not an intermediate one.
    expect((findObject(currentDoc(), text.id) as TextObject).fontSizePt).toBe(10);
  });

  it("withGesture batches nested mutations", () => {
    const doc = freshDoc();
    const a = createShapeObject(doc, "rect");
    addObject(a);
    const before = useDocumentStore.temporal.getState().pastStates.length;

    withGesture(() => {
      updateObject(a.id, { xMm: 1 });
      updateObject(a.id, { yMm: 2 });
      updateObject(a.id, { rotationDeg: 45 });
    });

    expect(useDocumentStore.temporal.getState().pastStates.length).toBe(before + 1);
    undo();
    const restored = findObject(currentDoc(), a.id)!;
    expect(restored.xMm).toBe(a.xMm);
    expect(restored.rotationDeg).toBe(0);
  });

  it("an aborted gesture (no mutations) writes no history", () => {
    freshDoc();
    const before = useDocumentStore.temporal.getState().pastStates.length;
    beginGesture();
    endGesture();
    expect(useDocumentStore.temporal.getState().pastStates.length).toBe(before);
  });

  it("removeObjects deletes and prunes selection", () => {
    const doc = freshDoc();
    const a = createShapeObject(doc, "rect");
    addObject(a);
    removeObjects([a.id]);
    expect(currentDoc().objects).toHaveLength(0);
    expect(useEditorUiStore.getState().selection).toEqual([]);
  });

  it("duplicateObjects clones with fresh ids and an offset", () => {
    const doc = freshDoc();
    const a = createShapeObject(doc, "rect");
    addObject(a);
    const [cloneId] = duplicateObjects([a.id]);
    const clone = findObject(currentDoc(), cloneId!)!;
    expect(clone.id).not.toBe(a.id);
    expect(clone.xMm).toBeCloseTo(a.xMm + 2, 9);
    expect(currentDoc().objects).toHaveLength(2);
  });

  it("reorderObjects moves selection through the z stack", () => {
    const doc = freshDoc();
    const a = createShapeObject(doc, "rect");
    const b = createShapeObject(doc, "ellipse");
    const c = createShapeObject(doc, "star");
    addObject(a);
    addObject(b);
    addObject(c);

    const order = () => currentDoc().objects.map((o) => o.id);
    expect(order()).toEqual([a.id, b.id, c.id]);

    reorderObjects([a.id], "forward");
    expect(order()).toEqual([b.id, a.id, c.id]);

    reorderObjects([a.id], "front");
    expect(order()).toEqual([b.id, c.id, a.id]);

    reorderObjects([a.id], "backward");
    expect(order()).toEqual([b.id, a.id, c.id]);

    reorderObjects([a.id], "back");
    expect(order()).toEqual([a.id, b.id, c.id]);
  });

  it("loadDocument clears undo history", () => {
    const doc = freshDoc();
    addObject(createShapeObject(doc, "rect"));
    expect(useDocumentStore.temporal.getState().pastStates.length).toBeGreaterThan(0);
    loadDocument(createDocument());
    expect(useDocumentStore.temporal.getState().pastStates.length).toBe(0);
  });
});
