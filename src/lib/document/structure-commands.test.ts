// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { useDocumentStore } from "@/stores/document-store";
import { useEditorUiStore } from "@/stores/editor-ui-store";
import { addObject, findObject, loadDocument, undo, updateObject } from "./commands";
import { createDocument, createShapeObject } from "./defaults";
import type { GroupObject, RectObject } from "./schema";
import {
  alignObjects,
  distributeObjects,
  groupObjects,
  ungroupObjects,
} from "./structure-commands";

function currentDoc() {
  const doc = useDocumentStore.getState().doc;
  if (!doc) throw new Error("no doc");
  return doc;
}

beforeEach(() => {
  useEditorUiStore.getState().clearSelection();
  loadDocument(createDocument()); // 73.969 × 26
});

describe("groupObjects / ungroupObjects", () => {
  it("groups two objects and preserves their absolute positions", () => {
    const doc = currentDoc();
    const a = createShapeObject(doc, "rect", { xMm: 10, yMm: 10, widthMm: 6, heightMm: 4 });
    const b = createShapeObject(doc, "rect", { xMm: 30, yMm: 18, widthMm: 10, heightMm: 8 });
    addObject(a);
    addObject(b);

    const groupId = groupObjects([a.id, b.id])!;
    const group = findObject(currentDoc(), groupId) as GroupObject;

    // Union box: x 7..35, y 8..22 → center (21, 15), size 28×14.
    expect(group.xMm).toBeCloseTo(21, 9);
    expect(group.yMm).toBeCloseTo(15, 9);
    expect(group.widthMm).toBeCloseTo(28, 9);
    expect(group.heightMm).toBeCloseTo(14, 9);

    // Child a sits at (10,10) absolute → group-local (relative to top-left 7,8) = (3,2).
    const childA = group.children.find((c) => c.id === a.id)!;
    expect(childA.xMm).toBeCloseTo(3, 9);
    expect(childA.yMm).toBeCloseTo(2, 9);

    expect(currentDoc().objects).toHaveLength(1);
    expect(useEditorUiStore.getState().selection).toEqual([groupId]);
  });

  it("ungroup restores absolute positions (round-trip)", () => {
    const doc = currentDoc();
    const a = createShapeObject(doc, "rect", { xMm: 10, yMm: 10, widthMm: 6, heightMm: 4 });
    const b = createShapeObject(doc, "rect", { xMm: 30, yMm: 18, widthMm: 10, heightMm: 8 });
    addObject(a);
    addObject(b);
    const groupId = groupObjects([a.id, b.id])!;

    ungroupObjects([groupId]);
    const docAfter = currentDoc();
    expect(docAfter.objects).toHaveLength(2);
    const restoredA = findObject(docAfter, a.id)!;
    expect(restoredA.xMm).toBeCloseTo(10, 9);
    expect(restoredA.yMm).toBeCloseTo(10, 9);
  });

  it("ungroup maps children through a rotated group transform", () => {
    const doc = currentDoc();
    const a = createShapeObject(doc, "rect", { xMm: 10, yMm: 10, widthMm: 4, heightMm: 4 });
    const b = createShapeObject(doc, "rect", { xMm: 20, yMm: 10, widthMm: 4, heightMm: 4 });
    addObject(a);
    addObject(b);
    const groupId = groupObjects([a.id, b.id])!;

    // Rotate the group 90° about its center (15, 10).
    updateObject(groupId, { rotationDeg: 90 });
    ungroupObjects([groupId]);

    // a was at (-5, 0) relative to the group center → rotated 90° → (0, -5)+(15,10) = (15, 5).
    const restoredA = findObject(currentDoc(), a.id)!;
    expect(restoredA.xMm).toBeCloseTo(15, 6);
    expect(restoredA.yMm).toBeCloseTo(5, 6);
    expect(restoredA.rotationDeg).toBeCloseTo(90, 9);
  });

  it("group + undo restores the original objects", () => {
    const doc = currentDoc();
    const a = createShapeObject(doc, "rect", { xMm: 10, yMm: 10, widthMm: 4, heightMm: 4 });
    const b = createShapeObject(doc, "rect", { xMm: 20, yMm: 10, widthMm: 4, heightMm: 4 });
    addObject(a);
    addObject(b);
    groupObjects([a.id, b.id]);
    expect(currentDoc().objects).toHaveLength(1);
    undo();
    expect(currentDoc().objects).toHaveLength(2);
  });
});

describe("alignObjects", () => {
  it("aligns a single object to the label frame", () => {
    const doc = currentDoc();
    const a = createShapeObject(doc, "rect", { xMm: 10, yMm: 10, widthMm: 6, heightMm: 4 });
    addObject(a);

    alignObjects([a.id], "left");
    expect((findObject(currentDoc(), a.id) as RectObject).xMm).toBeCloseTo(3, 9);

    alignObjects([a.id], "center-h");
    expect((findObject(currentDoc(), a.id) as RectObject).xMm).toBeCloseTo(
      doc.label.widthMm / 2,
      9,
    );

    alignObjects([a.id], "bottom");
    expect((findObject(currentDoc(), a.id) as RectObject).yMm).toBeCloseTo(
      doc.label.heightMm - 2,
      9,
    );
  });

  it("aligns multiple objects to the selection bounds", () => {
    const doc = currentDoc();
    const a = createShapeObject(doc, "rect", { xMm: 10, yMm: 10, widthMm: 6, heightMm: 4 });
    const b = createShapeObject(doc, "rect", { xMm: 30, yMm: 16, widthMm: 10, heightMm: 8 });
    addObject(a);
    addObject(b);

    alignObjects([a.id, b.id], "top");
    // Selection top = min(8, 12) = 8 → a center y = 8+2=10, b center y = 8+4=12.
    expect(findObject(currentDoc(), a.id)!.yMm).toBeCloseTo(10, 9);
    expect(findObject(currentDoc(), b.id)!.yMm).toBeCloseTo(12, 9);
  });

  it("skips locked objects", () => {
    const doc = currentDoc();
    const a = createShapeObject(doc, "rect", {
      xMm: 10,
      yMm: 10,
      widthMm: 6,
      heightMm: 4,
      locked: true,
    });
    addObject(a);
    alignObjects([a.id], "left");
    expect(findObject(currentDoc(), a.id)!.xMm).toBe(10);
  });
});

describe("distributeObjects", () => {
  it("evenly spaces three objects between the outermost pair", () => {
    const doc = currentDoc();
    const a = createShapeObject(doc, "rect", { xMm: 10, yMm: 10, widthMm: 4, heightMm: 4 });
    const b = createShapeObject(doc, "rect", { xMm: 14, yMm: 10, widthMm: 4, heightMm: 4 });
    const c = createShapeObject(doc, "rect", { xMm: 50, yMm: 10, widthMm: 4, heightMm: 4 });
    addObject(a);
    addObject(b);
    addObject(c);

    distributeObjects([a.id, b.id, c.id], "horizontal");
    expect(findObject(currentDoc(), a.id)!.xMm).toBeCloseTo(10, 9);
    expect(findObject(currentDoc(), b.id)!.xMm).toBeCloseTo(30, 9);
    expect(findObject(currentDoc(), c.id)!.xMm).toBeCloseTo(50, 9);
  });
});
