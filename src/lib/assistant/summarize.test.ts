import { describe, expect, it } from "vitest";
import { createDocument, createShapeObject, createTextObject } from "@/lib/document/defaults";
import type { LabelDocument } from "@/lib/document/schema";
import { MAX_SUMMARY_CHARS } from "./protocol";
import { MAX_SUMMARY_OBJECTS, summarizeDocument } from "./summarize";

function docWith(objects: LabelDocument["objects"]): LabelDocument {
  return { ...createDocument(), objects };
}

describe("summarizeDocument", () => {
  it("describes an empty document with geometry and conventions", () => {
    const doc = createDocument();
    const text = summarizeDocument(doc);
    expect(text).toContain("74×26mm rect");
    expect(text).toContain("bleed 2mm");
    expect(text).toContain("none (empty canvas)");
    expect(text).toContain("top-left TRIM corner");
  });

  it("lists objects with ids, 0.1mm-rounded geometry, and selection marks", () => {
    const doc = createDocument();
    const text = createTextObject(doc, { xMm: 10.234, yMm: 5.678, text: "Retinol Serum" });
    const rect = createShapeObject(doc, "rect");
    const summary = summarizeDocument(docWith([text, rect]), [rect.id]);

    expect(summary).toContain(`id=${text.id}`);
    expect(summary).toContain("(10.2, 5.7)");
    expect(summary).toContain('"Retinol Serum"');
    expect(summary).toMatch(new RegExp(`id=${rect.id}.*\\[SELECTED\\]`));
  });

  it("flags hidden/locked/layered objects and indents group children", () => {
    const doc = createDocument();
    const child = createTextObject(doc, { text: "inner" });
    const summary = summarizeDocument(
      docWith([
        {
          ...createShapeObject(doc, "rect"),
          locked: true,
          visible: false,
          printLayer: "foil-gold",
        },
        {
          id: "grp1",
          type: "group",
          name: "Badge",
          xMm: 10,
          yMm: 10,
          widthMm: 20,
          heightMm: 10,
          rotationDeg: 0,
          opacity: 1,
          locked: false,
          visible: true,
          printLayer: "artwork",
          children: [child],
        },
      ]),
    );
    expect(summary).toMatch(/\[hidden locked layer=foil-gold\]/);
    expect(summary).toContain("group (1 children)");
    expect(summary).toContain(`\n  - id=${child.id}`);
  });

  it("caps the object list at 60 and reports the overflow", () => {
    const doc = createDocument();
    const objects = Array.from({ length: 75 }, () => createShapeObject(doc, "rect"));
    const summary = summarizeDocument(docWith(objects));
    expect(summary).toContain(`Objects (75):`);
    expect(summary).toContain("…and 15 more objects");
    const lines = summary.split("\n").filter((l) => l.startsWith("- id="));
    expect(lines).toHaveLength(MAX_SUMMARY_OBJECTS);
  });

  it("never exceeds the hard character cap", () => {
    const doc = createDocument();
    const objects = Array.from({ length: 60 }, (_, i) =>
      createTextObject(doc, { name: `Very long object name ${"x".repeat(60)} ${i}` }),
    );
    const summary = summarizeDocument(docWith(objects));
    expect(summary.length).toBeLessThanOrEqual(MAX_SUMMARY_CHARS);
    expect(summary).toContain("…(truncated)");
  });

  it("truncates long text payloads inside descriptions", () => {
    const doc = createDocument();
    const text = createTextObject(doc, { text: "A".repeat(200) });
    const summary = summarizeDocument(docWith([text]));
    expect(summary).toContain("A".repeat(57) + "…");
    expect(summary).not.toContain("A".repeat(80));
  });
});
