import { describe, expect, it } from "vitest";
import { PDFDict, PDFDocument, PDFName } from "@cantoo/pdf-lib";
import { mmToPt } from "@/lib/geometry/units";
import { createSingleLabelPdf } from "./pdf";
import { createVectorLabelPdf } from "./pdf-vector";
import type { VectorPathElement } from "./vector-doc";

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function tinyPng(): Uint8Array {
  return Uint8Array.from(Buffer.from(TINY_PNG_BASE64, "base64"));
}

const LABEL = { widthMm: 73.969, heightMm: 26, bleedMm: 2 };

function pathElement(overrides: Partial<VectorPathElement> = {}): VectorPathElement {
  return {
    kind: "path",
    dMm: "M-15 -5H15V5H-15Z",
    centerXMm: 37,
    centerYMm: 13,
    rotationDeg: 0,
    scaleX: 1,
    scaleY: 1,
    fillColor: "#4c3d8f",
    opacity: 1,
    sourceId: "test",
    ...overrides,
  };
}

/** Number of XObjects referenced by page 1 (each embedded PNG is one; its
 *  alpha SMask, if any, is nested inside the image and not counted here). */
async function countImageXObjects(bytes: Uint8Array): Promise<number> {
  const pdf = await PDFDocument.load(bytes);
  const resources = pdf.getPage(0).node.Resources();
  const xobjects = resources?.lookupMaybe(PDFName.of("XObject"), PDFDict);
  return xobjects ? xobjects.keys().length : 0;
}

describe("createVectorLabelPdf", () => {
  it("produces the same print boxes as the raster PDF", async () => {
    const vector = await createVectorLabelPdf({
      ...LABEL,
      cropMarks: true,
      title: "Vector",
      background: { kind: "solid", color: "#ffffff" },
      entries: [{ element: { kind: "path", path: pathElement() } }],
    });
    const raster = await createSingleLabelPdf({
      ...LABEL,
      pngBytes: tinyPng(),
      cropMarks: true,
      title: "Raster",
    });

    const [vPdf, rPdf] = await Promise.all([
      PDFDocument.load(vector),
      PDFDocument.load(raster),
    ]);
    const vPage = vPdf.getPage(0);
    const rPage = rPdf.getPage(0);

    for (const box of ["getTrimBox", "getBleedBox", "getMediaBox"] as const) {
      const v = vPage[box]();
      const r = rPage[box]();
      expect(v.x).toBeCloseTo(r.x, 6);
      expect(v.y).toBeCloseTo(r.y, 6);
      expect(v.width).toBeCloseTo(r.width, 6);
      expect(v.height).toBeCloseTo(r.height, 6);
    }
    expect(vPage.getTrimBox().width).toBeCloseTo(mmToPt(73.969), 6);
  });

  it("embeds zero images for an all-vector document", async () => {
    const bytes = await createVectorLabelPdf({
      ...LABEL,
      cropMarks: true,
      background: { kind: "solid", color: "#ffffff" },
      entries: [
        { element: { kind: "path", path: pathElement() } },
        {
          element: {
            kind: "path",
            path: pathElement({ dMm: "M-5 0A5 3 0 1 0 5 0A5 3 0 1 0 -5 0Z", sourceId: "e" }),
          },
        },
      ],
    });
    expect(await countImageXObjects(bytes)).toBe(0);
  });

  it("embeds exactly one image per raster tile", async () => {
    const bytes = await createVectorLabelPdf({
      ...LABEL,
      cropMarks: false,
      background: { kind: "none" },
      entries: [
        { element: { kind: "path", path: pathElement() } },
        {
          element: {
            kind: "raster",
            aabbMm: { x: 10, y: 5, width: 20, height: 10 },
            pngBytes: tinyPng(),
          },
        },
      ],
    });
    expect(await countImageXObjects(bytes)).toBe(1);
  });

  it("counts the raster background as an image", async () => {
    const bytes = await createVectorLabelPdf({
      ...LABEL,
      cropMarks: false,
      background: { kind: "raster", pngBytes: tinyPng() },
      entries: [{ element: { kind: "path", path: pathElement() } }],
    });
    expect(await countImageXObjects(bytes)).toBe(1);
  });

  it("stroke-only elements draw without a fill", async () => {
    const bytes = await createVectorLabelPdf({
      ...LABEL,
      cropMarks: false,
      background: { kind: "none" },
      entries: [
        {
          element: {
            kind: "path",
            path: pathElement({
              fillColor: undefined,
              stroke: { color: "#ff0000", widthMm: 0.5, cap: "round" },
            }),
          },
        },
      ],
    });
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
    expect(await countImageXObjects(bytes)).toBe(0);
  });
});
