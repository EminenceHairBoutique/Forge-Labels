import { describe, expect, it } from "vitest";
import { createDocument, createQrObject, createShapeObject, createTextObject, createBarcodeObject, createImageObject } from "@/lib/document/defaults";
import type { LabelDocument } from "@/lib/document/schema";
import { runPreflight, preflightSummary } from "./rules";

function docWith(objects: LabelDocument["objects"], patch?: Partial<LabelDocument>): LabelDocument {
  const doc = createDocument(); // 73.969 × 26, bleed 2, safe 3
  return { ...doc, ...patch, objects };
}

function ruleIds(doc: LabelDocument): string[] {
  return runPreflight(doc).map((i) => i.ruleId);
}

describe("preflight rules", () => {
  it("flags tiny text as error and small text as warning", () => {
    const base = createDocument();
    const tiny = createTextObject(base, { fontSizePt: 3, yMm: 13 });
    const small = createTextObject(base, { fontSizePt: 4.5, yMm: 13 });
    expect(ruleIds(docWith([tiny]))).toContain("font-too-small");
    expect(ruleIds(docWith([small]))).toContain("font-small");
    const fine = createTextObject(base, { fontSizePt: 8 });
    expect(ruleIds(docWith([fine]))).not.toContain("font-small");
  });

  it("flags critical content outside the safe zone", () => {
    const base = createDocument();
    const nearEdge = createTextObject(base, { xMm: 5, yMm: 2, fontSizePt: 8 });
    expect(ruleIds(docWith([nearEdge]))).toContain("outside-safe");
  });

  it("flags objects crossing the bleed and fully outside the canvas", () => {
    const base = createDocument();
    const crossing = createShapeObject(base, "rect", {
      xMm: 0,
      yMm: 13,
      widthMm: 20,
      heightMm: 10,
    });
    expect(ruleIds(docWith([crossing]))).toContain("crosses-bleed");

    const outside = createShapeObject(base, "rect", {
      xMm: 200,
      yMm: 13,
      widthMm: 10,
      heightMm: 10,
    });
    expect(ruleIds(docWith([outside]))).toContain("outside-canvas");
  });

  it("computes effective image DPI from source pixels and printed size", () => {
    const base = createDocument();
    // 300 px across 60 mm ≈ 127 DPI → error.
    const lowRes = createImageObject(base, { kind: "url", url: "/x.png" }, 300, 300);
    lowRes.widthMm = 60;
    lowRes.heightMm = 20;
    lowRes.xMm = 37;
    lowRes.yMm = 13;
    expect(ruleIds(docWith([lowRes]))).toContain("image-low-dpi");

    // 1400 px across 60 mm ≈ 592 DPI → clean.
    const highRes = createImageObject(base, { kind: "url", url: "/x.png" }, 1400, 1400);
    highRes.widthMm = 60;
    highRes.heightMm = 20;
    highRes.xMm = 37;
    highRes.yMm = 13;
    const ids = ruleIds(docWith([highRes]));
    expect(ids).not.toContain("image-low-dpi");
    expect(ids).not.toContain("image-soft-dpi");
  });

  it("flags QR modules below 0.4 mm and thin quiet zones", () => {
    const base = createDocument();
    const smallQr = createQrObject(base, {
      widthMm: 8,
      heightMm: 8,
      value: "https://example.com/a/very/long/path/that/adds/many/modules/to/the/code",
      yMm: 13,
      xMm: 37,
    });
    expect(ruleIds(docWith([smallQr]))).toContain("qr-module-small");

    const noQuiet = createQrObject(base, { quietModules: 2, yMm: 13, xMm: 37 });
    expect(ruleIds(docWith([noQuiet]))).toContain("qr-quiet-zone");

    const emptyQr = createQrObject(base, { value: " " });
    expect(ruleIds(docWith([emptyQr]))).toContain("qr-empty");
  });

  it("flags invalid barcode payloads", () => {
    const base = createDocument();
    const bad = createBarcodeObject(base, {
      symbology: "ean13",
      value: "12345",
      yMm: 13,
      xMm: 37,
    });
    expect(ruleIds(docWith([bad]))).toContain("barcode-invalid");
  });

  it("flags low text contrast against a solid background", () => {
    const base = createDocument();
    const faint = createTextObject(base, {
      fill: { type: "solid", color: "#e8e8e8" },
      fontSizePt: 8,
      yMm: 13,
    });
    expect(
      ruleIds(docWith([faint], { background: { type: "solid", color: "#ffffff" } })),
    ).toContain("low-contrast");
  });

  it("advises a white-ink layer for near-white art on clear stock", () => {
    const base = createDocument();
    const white = createShapeObject(base, "rect", {
      xMm: 37,
      yMm: 13,
      widthMm: 20,
      heightMm: 10,
      fill: { type: "solid", color: "#ffffff" },
    });
    const ids = ruleIds(
      docWith([white], { substrateId: "clear-pp", background: { type: "none" } }),
    );
    expect(ids).toContain("white-ink-needed");

    // Same art on white stock: no advisory.
    const onWhite = ruleIds(docWith([white], { substrateId: "white-pp" }));
    expect(onWhite).not.toContain("white-ink-needed");
  });

  it("warns about missing bleed and summarizes severities", () => {
    const doc = docWith([], {});
    doc.label.bleedMm = 0;
    const issues = runPreflight(doc);
    expect(issues.some((i) => i.ruleId === "no-bleed")).toBe(true);
    const summary = preflightSummary(issues);
    expect(summary.errors + summary.warnings + summary.infos).toBe(issues.length);
  });

  it("skips hidden objects", () => {
    const base = createDocument();
    const hidden = createTextObject(base, { fontSizePt: 2, visible: false });
    expect(ruleIds(docWith([hidden]))).not.toContain("font-too-small");
  });

  it("notes white-ink assignments on opaque stock, honoring group inheritance", () => {
    const base = createDocument();
    const assigned = createShapeObject(base, "rect", {
      xMm: 37,
      yMm: 13,
      widthMm: 10,
      heightMm: 6,
      printLayer: "white-ink",
    });
    // Default substrate is opaque → advisory fires.
    expect(ruleIds(docWith([assigned]))).toContain("white-ink-on-opaque");
    // On clear film the assignment is exactly right → no advisory.
    expect(
      ruleIds(docWith([assigned], { substrateId: "clear-pp" })),
    ).not.toContain("white-ink-on-opaque");
  });

  it("downgrades tokenized code values to a batch info note", () => {
    const base = createDocument();
    const tokenBarcode = createBarcodeObject(base, {
      symbology: "ean13",
      value: "{{ean}}",
      yMm: 13,
    });
    const ids = ruleIds(docWith([tokenBarcode]));
    expect(ids).toContain("batch-token");
    expect(ids).not.toContain("barcode-invalid");

    const literalBad = createBarcodeObject(base, {
      symbology: "ean13",
      value: "not-a-number",
      yMm: 13,
    });
    expect(ruleIds(docWith([literalBad]))).toContain("barcode-invalid");

    const tokenQr = createQrObject(base, { value: "https://x.example/{{sku}}", yMm: 13 });
    expect(ruleIds(docWith([tokenQr]))).toContain("batch-token");
  });

  it("warns when text or codes land on the die-cut layer", () => {
    const base = createDocument();
    const cutText = createTextObject(base, {
      fontSizePt: 10,
      yMm: 13,
      printLayer: "die-cut",
    });
    const cutShape = createShapeObject(base, "ellipse", {
      xMm: 37,
      yMm: 13,
      widthMm: 20,
      heightMm: 20,
      printLayer: "die-cut",
    });
    const ids = ruleIds(docWith([cutText, cutShape]));
    // Text on die-cut warns; a plain shape outline is the intended use.
    expect(ids.filter((r) => r === "die-cut-content")).toHaveLength(1);
  });
});
