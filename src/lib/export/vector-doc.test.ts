import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { GroupObject, LabelDocument, LabelObject } from "@/lib/document/schema";
import { createDocument } from "@/lib/document/defaults";
import { fontFileUrl } from "@/lib/fonts/registry";
import { barcode, ellipse, qr, rect, star, text } from "@/lib/templates/authoring";
import {
  classifyVectorability,
  composeChildTransform,
  expandedAabbMm,
  planVectorDoc,
  type VectorPathElement,
  type VectorRasterElement,
} from "./vector-doc";

/** Node test loader: read font bytes straight from public/fonts via fs. */
async function loadFontBytes(familyId: string, weight: number): Promise<ArrayBuffer> {
  const rel = fontFileUrl(familyId, weight);
  const buf = await fs.promises.readFile(path.join(process.cwd(), "public", rel));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function makeDoc(objects: LabelObject[]): LabelDocument {
  return { ...createDocument(), objects };
}

async function plan(objects: LabelObject[]) {
  return planVectorDoc(makeDoc(objects), { loadFontBytes });
}

const GRADIENT = {
  type: "linear-gradient" as const,
  angleDeg: 0,
  stops: [
    { offset: 0, color: "#000000" },
    { offset: 1, color: "#ffffff" },
  ],
};

describe("classifyVectorability", () => {
  it("keeps solid shapes vector and flags gradient/shadow/image objects", () => {
    const doc = makeDoc([
      rect({ id: "a", xMm: 10, yMm: 10, widthMm: 10, heightMm: 5 }),
      rect({ id: "b", xMm: 30, yMm: 10, widthMm: 10, heightMm: 5, fill: GRADIENT }),
      star({
        id: "c",
        xMm: 50,
        yMm: 10,
        widthMm: 8,
        heightMm: 8,
        shadow: { color: "#000000", opacity: 0.5, blurPt: 2, offsetXPt: 1, offsetYPt: 1 },
      }),
    ]);
    const { rasterFallbacks } = classifyVectorability(doc);
    expect(rasterFallbacks.map((f) => `${f.id}:${f.reason}`)).toEqual([
      "b:gradient-fill",
      "c:shadow",
    ]);
  });

  it("flags semi-transparent multi-child groups but recurses opaque ones", () => {
    const child = rect({ id: "r1", xMm: 5, yMm: 5, widthMm: 4, heightMm: 4, fill: GRADIENT });
    const group = (opacity: number): GroupObject => ({
      id: "g",
      type: "group",
      name: "Group",
      xMm: 20,
      yMm: 10,
      widthMm: 20,
      heightMm: 10,
      rotationDeg: 0,
      opacity,
      locked: false,
      visible: true,
      printLayer: "artwork",
      children: [
        child,
        rect({ id: "r2", xMm: 15, yMm: 5, widthMm: 4, heightMm: 4 }),
      ],
    });
    expect(classifyVectorability(makeDoc([group(0.5)])).rasterFallbacks).toEqual([
      { id: "g", name: "Group", reason: "group-opacity" },
    ]);
    expect(
      classifyVectorability(makeDoc([group(1)])).rasterFallbacks.map((f) => f.id),
    ).toEqual(["r1"]);
  });
});

describe("composeChildTransform", () => {
  it("matches the ungroup math: rotate about the group center, add rotations", () => {
    const group = {
      xMm: 30,
      yMm: 20,
      widthMm: 20,
      heightMm: 10,
      rotationDeg: 90,
      opacity: 0.8,
    };
    // Child centered at the group's local top-left quadrant.
    const child = rect({ id: "c", xMm: 5, yMm: 5, widthMm: 4, heightMm: 4, opacity: 0.5 });
    const out = composeChildTransform(group, child);
    // rel = (5-10, 5-5) = (-5, 0); rotated 90° cw → (0, -5); + center.
    expect(out.xMm).toBeCloseTo(30, 10);
    expect(out.yMm).toBeCloseTo(15, 10);
    expect(out.rotationDeg).toBe(90);
    expect(out.opacity).toBeCloseTo(0.4, 10);
  });
});

describe("planVectorDoc", () => {
  it("plans solid shapes as centered path elements", async () => {
    const { elements, background, warnings } = await plan([
      rect({ id: "a", xMm: 20, yMm: 13, widthMm: 30, heightMm: 10, cornerRadiusMm: 2 }),
      ellipse({ id: "b", xMm: 55, yMm: 13, widthMm: 12, heightMm: 8 }),
    ]);
    expect(warnings).toEqual([]);
    expect(background).toEqual({ kind: "solid", color: expect.any(String) });
    expect(elements).toHaveLength(2);
    const [a, b] = elements as VectorPathElement[];
    expect(a!.kind).toBe("path");
    expect(a!.centerXMm).toBe(20);
    expect(a!.dMm).toContain("A2 2 0 0 1");
    expect(b!.dMm.startsWith("M-6 0")).toBe(true);
  });

  it("falls back to raster tiles for gradient fills, clamped to the bleed rect", async () => {
    const { elements, warnings } = await plan([
      rect({ id: "g", xMm: 0, yMm: 0, widthMm: 20, heightMm: 10, fill: GRADIENT }),
    ]);
    expect(elements).toHaveLength(1);
    const el = elements[0] as VectorRasterElement;
    expect(el.kind).toBe("raster");
    expect(el.reason).toBe("gradient-fill");
    // Half the rect hangs outside the bleed rect (-2 mm) and is clamped.
    expect(el.aabbMm.x).toBeCloseTo(-2, 10);
    expect(el.aabbMm.y).toBeCloseTo(-2, 10);
    expect(warnings.some((w) => w.includes("gradient fill"))).toBe(true);
  });

  it("omits raster fallbacks entirely outside the artwork", async () => {
    const { elements, warnings } = await plan([
      rect({ id: "far", xMm: 500, yMm: 500, widthMm: 10, heightMm: 10, fill: GRADIENT }),
    ]);
    expect(elements).toHaveLength(0);
    expect(warnings.some((w) => w.includes("outside the artwork"))).toBe(true);
  });

  it("flattens groups into doc space and preserves z-order", async () => {
    const group: GroupObject = {
      id: "g",
      type: "group",
      name: "Group",
      xMm: 30,
      yMm: 13,
      widthMm: 20,
      heightMm: 10,
      rotationDeg: 90,
      opacity: 1,
      locked: false,
      visible: true,
      printLayer: "artwork",
      children: [
        rect({ id: "c1", xMm: 5, yMm: 5, widthMm: 4, heightMm: 4 }),
        rect({ id: "c2", xMm: 15, yMm: 5, widthMm: 4, heightMm: 4, rotationDeg: 15 }),
      ],
    };
    const { elements } = await plan([group]);
    expect(elements.map((e) => e.sourceId)).toEqual(["c1", "c2"]);
    const [c1, c2] = elements as VectorPathElement[];
    expect(c1!.centerXMm).toBeCloseTo(30, 10);
    expect(c1!.centerYMm).toBeCloseTo(8, 10);
    expect(c1!.rotationDeg).toBe(90);
    expect(c2!.rotationDeg).toBe(105);
  });

  it("outlines text into path data (fill only, under-fill with stroke)", async () => {
    const { elements } = await plan([
      text({ id: "t", xMm: 37, yMm: 13, widthMm: 60, heightMm: 8, text: "AURELIS", fontSizePt: 12 }),
      text({
        id: "s",
        xMm: 37,
        yMm: 20,
        widthMm: 60,
        heightMm: 8,
        text: "LAB",
        fontSizePt: 12,
        stroke: { color: "#ff0000", widthPt: 1 },
      }),
    ]);
    const [t, s] = elements as VectorPathElement[];
    expect(t!.kind).toBe("path");
    expect(t!.dMm.length).toBeGreaterThan(50);
    expect(t!.strokeOrder).toBeUndefined();
    expect(s!.strokeOrder).toBe("under-fill");
    expect(s!.stroke?.color).toBe("#ff0000");
  });

  it("plans QR codes as scaled module paths", async () => {
    const { elements } = await plan([
      qr({ id: "q", xMm: 20, yMm: 13, widthMm: 16, value: "https://forge.example" }),
    ]);
    expect(elements).toHaveLength(1);
    const el = elements[0] as VectorPathElement;
    expect(el.scaleX).toBeGreaterThan(0);
    expect(el.scaleX).toBe(el.scaleY);
    expect(el.postTranslateMm).toEqual({ x: -8, y: -8 });
  });

  it("plans barcodes from bwip-js vector output", async () => {
    const { elements, warnings } = await plan([
      barcode({
        id: "b",
        xMm: 37,
        yMm: 13,
        widthMm: 40,
        heightMm: 12,
        symbology: "code128",
        value: "FORGE-001",
      }),
    ]);
    expect(warnings).toEqual([]);
    expect(elements.length).toBeGreaterThanOrEqual(1);
    for (const el of elements) {
      expect(el.kind).toBe("path");
      expect((el as VectorPathElement).postTranslateMm).toBeDefined();
    }
  });

  it("maps gradient backgrounds to raster with a warning", async () => {
    const doc = { ...makeDoc([]), background: GRADIENT };
    const result = await planVectorDoc(doc, { loadFontBytes });
    expect(result.background).toEqual({ kind: "raster" });
    expect(result.warnings.some((w) => w.includes("Gradient backgrounds"))).toBe(true);
  });
});

describe("expandedAabbMm", () => {
  it("grows the box by stroke and shadow extents", () => {
    const plain = expandedAabbMm(
      rect({ id: "p", xMm: 10, yMm: 10, widthMm: 10, heightMm: 10 }),
    );
    // 0.25 mm safety pad only.
    expect(plain.width).toBeCloseTo(10.5, 10);

    const shadowed = expandedAabbMm(
      rect({
        id: "s",
        xMm: 10,
        yMm: 10,
        widthMm: 10,
        heightMm: 10,
        shadow: { color: "#000000", opacity: 0.5, blurPt: 4, offsetXPt: 2, offsetYPt: 0 },
      }),
    );
    expect(shadowed.width).toBeGreaterThan(plain.width + 2);
  });
});
