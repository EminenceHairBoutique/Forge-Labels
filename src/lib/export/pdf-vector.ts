import {
  LineCapStyle,
  PDFDocument,
  rgb,
  type Color,
  type PDFPage,
  type TransformationMatrix,
} from "@cantoo/pdf-lib";
import { mmToPt } from "@/lib/geometry/units";
import type { VectorDocPlan, VectorPathElement } from "./vector-doc";
import { drawCropMarks, setupLabelPage } from "./pdf";

/**
 * Vector-art PDF composition: path elements from the vector-doc planner are
 * drawn with pdf-lib's drawSvgPath; raster-fallback tiles arrive as PNG bytes
 * and embed at their planned AABBs. All direct pdf-lib usage stays inside
 * this module + pdf.ts.
 *
 * drawSvgPath facts this code relies on (verified against @cantoo/pdf-lib
 * 2.7.1 sources): the supplied `matrix` composes OUTERMOST — the implicit
 * y-down→y-up flip scale(1,−1) still applies innermost, so we always pass a
 * full matrix (x/y/rotate/scale omitted) computed as M = A_pageFlip · A_doc,
 * cancelling the implicit flip by folding scale(1,−1) into A. Line widths and
 * dash arrays are in PATH units and are scaled by the CTM — with mm path
 * units and a mm→pt matrix that makes borderWidth values plain millimeters.
 */

export interface VectorPdfEntry {
  element:
    | { kind: "path"; path: VectorPathElement }
    | {
        kind: "raster";
        aabbMm: { x: number; y: number; width: number; height: number };
        pngBytes: Uint8Array;
      };
}

export interface VectorLabelPdfOptions {
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  cropMarks: boolean;
  title?: string;
  background:
    | { kind: "none" }
    | { kind: "solid"; color: string }
    | { kind: "raster"; pngBytes: Uint8Array };
  /** In z-order (bottom first). */
  entries: VectorPdfEntry[];
}

// --- 2×3 affine helpers (column form [a b c d e f]: x' = a·x + c·y + e) ----

type Affine = [number, number, number, number, number, number];

function multiply(m: Affine, n: Affine): Affine {
  // Returns m ∘ n (apply n first, then m).
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function translate(x: number, y: number): Affine {
  return [1, 0, 0, 1, x, y];
}

function scale(x: number, y: number): Affine {
  return [x, 0, 0, y, 0, 0];
}

/** Rotation by deg, positive = clockwise in y-down space. */
function rotateYDown(deg: number): Affine {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [c, s, -s, c, 0, 0];
}

function hexToRgb(hex: string): Color {
  let value = hex.replace("#", "");
  if (value.length === 3) {
    value = value
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  const num = Number.parseInt(value, 16);
  if (!Number.isFinite(num)) return rgb(0, 0, 0);
  return rgb(((num >> 16) & 0xff) / 255, ((num >> 8) & 0xff) / 255, (num & 0xff) / 255);
}

export async function createVectorLabelPdf(
  options: VectorLabelPdfOptions,
): Promise<Uint8Array> {
  const { widthMm, heightMm, bleedMm, cropMarks } = options;

  const pdf = await PDFDocument.create();
  const { page, marginMm, pageHmm } = setupLabelPage(pdf, options);

  // Doc mm (y-down, origin at trim top-left) → page pt (y-up, origin at
  // bottom-left): translate to the artwork corner, flip y at the page height.
  const s = mmToPt(1);
  const docToPage: Affine = multiply(
    translate(mmToPt(marginMm + bleedMm), mmToPt(pageHmm - marginMm - bleedMm)),
    scale(s, -s),
  );

  const artX = mmToPt(marginMm);
  const artY = mmToPt(marginMm);
  const artW = mmToPt(widthMm + 2 * bleedMm);
  const artH = mmToPt(heightMm + 2 * bleedMm);

  // Background across the full bleed rect.
  if (options.background.kind === "solid") {
    page.drawRectangle({
      x: artX,
      y: artY,
      width: artW,
      height: artH,
      color: hexToRgb(options.background.color),
    });
  } else if (options.background.kind === "raster") {
    const png = await pdf.embedPng(options.background.pngBytes);
    page.drawImage(png, { x: artX, y: artY, width: artW, height: artH });
  }

  for (const entry of options.entries) {
    if (entry.element.kind === "raster") {
      const { aabbMm, pngBytes } = entry.element;
      const png = await pdf.embedPng(pngBytes);
      page.drawImage(png, {
        x: mmToPt(marginMm + bleedMm + aabbMm.x),
        y: mmToPt(pageHmm - marginMm - bleedMm - aabbMm.y - aabbMm.height),
        width: mmToPt(aabbMm.width),
        height: mmToPt(aabbMm.height),
      });
    } else {
      drawPathElement(page, entry.element.path, docToPage);
    }
  }

  if (cropMarks) {
    drawCropMarks(page, {
      trimX: marginMm + bleedMm,
      trimY: marginMm + bleedMm,
      trimW: widthMm,
      trimH: heightMm,
      bleedMm,
    });
  }

  return pdf.save();
}

function drawPathElement(
  page: PDFPage,
  el: VectorPathElement,
  docToPage: Affine,
): void {
  // Local path → doc mm: postTranslate ∘ scale, placed at the object center
  // with its clockwise rotation.
  let local: Affine = scale(el.scaleX, el.scaleY);
  if (el.postTranslateMm) {
    local = multiply(translate(el.postTranslateMm.x, el.postTranslateMm.y), local);
  }
  const docSpace = multiply(
    translate(el.centerXMm, el.centerYMm),
    multiply(rotateYDown(el.rotationDeg), local),
  );
  // drawSvgPath applies an implicit scale(1,−1) innermost (SVG y-down → PDF
  // y-up); cancel it so our y-down math passes through unchanged.
  const matrix = multiply(
    multiply(docToPage, docSpace),
    scale(1, -1),
  ) as TransformationMatrix;

  const common = {
    x: 0,
    y: 0,
    matrix,
    opacity: el.opacity,
    borderOpacity: el.opacity,
  };

  const stroke = el.stroke;
  const strokeOptions = stroke
    ? {
        borderColor: hexToRgb(stroke.color),
        borderWidth: stroke.widthMm,
        ...(stroke.dashMm ? { borderDashArray: stroke.dashMm } : {}),
        ...(stroke.cap === "round"
          ? { borderLineCap: LineCapStyle.Round }
          : { borderLineCap: LineCapStyle.Butt }),
      }
    : {};

  if (el.strokeOrder === "under-fill" && stroke && el.fillColor) {
    // Konva text renders with fillAfterStrokeEnabled: stroke sits under the
    // fill. PDF's fill-and-stroke operator paints stroke on top, so emit two
    // passes: stroke first, then fill.
    page.drawSvgPath(el.dMm, { ...common, ...strokeOptions });
    page.drawSvgPath(el.dMm, { ...common, color: hexToRgb(el.fillColor) });
    return;
  }

  page.drawSvgPath(el.dMm, {
    ...common,
    ...(el.fillColor ? { color: hexToRgb(el.fillColor) } : {}),
    ...strokeOptions,
  });
}

/** Exposed for tests: the plan→entries mapping is 1:1 on element order. */
export type { VectorDocPlan };
