import type { Font } from "fontkit";
import bwipjs from "bwip-js/browser";
import type {
  BarcodeObject,
  Fill,
  GroupObject,
  LabelDocument,
  LabelObject,
  QrObject,
  Stroke,
  TextObject,
} from "@/lib/document/schema";
import { fontPtToMm } from "@/lib/geometry/units";
import { applyTextTransform } from "@/lib/render/node-configs";
import { bleedRect, objectAabb } from "@/lib/render/geometry";
import { createQrMatrix, qrTotalModules } from "@/lib/codes/qr";
import { validateBarcodeValue } from "@/lib/codes/validate";
import { FontStore, fetchFontBytes } from "./font-store";
import {
  barcodeBoxTransform,
  curvedGlyphRawPlacements,
  ellipsePathData,
  parseSvgPaths,
  pointsPathData,
  polygonPointsMm,
  qrDotModulesPathData,
  qrRoundedModulesPathData,
  qrSquareRunsPathData,
  rectPathData,
  starPointsMm,
  straightTextLineData,
  transformedGlyphPathData,
} from "./vector-paths";

/**
 * Vector-PDF planning: walk the document and classify every object into
 * either vector path elements (solid fills/strokes only — pdf-lib has no
 * gradient or pattern API) or raster-fallback tiles rendered in place by the
 * browser orchestrator. Pure module: no pdf-lib, no canvas — node-testable.
 */

export interface VectorPathElement {
  kind: "path";
  /**
   * SVG path data in object-local units, y-down. For text and plain shapes
   * the units are mm with the origin at the object CENTER; QR/barcode paths
   * are in their native grid units and carry scaleX/scaleY +
   * postTranslateMm to land in the same center-origin mm space:
   * localMm = postTranslate ∘ scale(scaleX, scaleY) · pathPoint.
   */
  dMm: string;
  /** Absolute (group-flattened) center in doc mm and clockwise rotation. */
  centerXMm: number;
  centerYMm: number;
  rotationDeg: number;
  scaleX: number;
  scaleY: number;
  postTranslateMm?: { x: number; y: number };
  /** Solid fill hex; undefined = no fill (stroke-only). */
  fillColor?: string;
  stroke?: { color: string; widthMm: number; dashMm?: number[]; cap?: "butt" | "round" };
  /** "under-fill" = Konva fillAfterStrokeEnabled (text): stroke pass first. */
  strokeOrder?: "over-fill" | "under-fill";
  opacity: number;
  sourceId: string;
}

export interface VectorRasterElement {
  kind: "raster";
  /** Objects to render in place (already in doc space). */
  objects: LabelObject[];
  /** Expanded AABB in doc mm, clamped to the bleed rect. */
  aabbMm: { x: number; y: number; width: number; height: number };
  reason: RasterReason;
  sourceId: string;
  sourceName: string;
}

export type VectorElement = VectorPathElement | VectorRasterElement;

export type RasterReason =
  | "gradient-fill"
  | "finish-fill"
  | "shadow"
  | "image"
  | "qr-logo"
  | "group-opacity"
  | "barcode-parse"
  | "font-load";

export interface VectorDocPlan {
  /** In z-order; background handled separately. */
  elements: VectorElement[];
  background: { kind: "none" } | { kind: "solid"; color: string } | { kind: "raster" };
  warnings: string[];
}

export interface VectorDocOptions {
  /** Byte loader for font files (defaults to fetch; tests inject fs). */
  loadFontBytes?: (familyId: string, weight: number) => Promise<ArrayBuffer>;
}

const RASTER_REASON_LABEL: Record<RasterReason, string> = {
  "gradient-fill": "uses a gradient fill",
  "finish-fill": "uses a simulated finish fill",
  shadow: "has a drop shadow",
  image: "is a raster image",
  "qr-logo": "has a QR logo overlay",
  "group-opacity": "is a semi-transparent group",
  "barcode-parse": "could not be vectorized",
  "font-load": "needs a font that could not be loaded",
};

function rasterWarning(name: string, reason: RasterReason): string {
  return `“${name}” ${RASTER_REASON_LABEL[reason]} — embedded as a 600 DPI raster tile in the vector PDF.`;
}

function objectLabel(obj: LabelObject): string {
  return obj.name || obj.id;
}

// ---------------------------------------------------------------------------
// Classification helpers
// ---------------------------------------------------------------------------

function fillNeedsRaster(fill: Fill | undefined): RasterReason | null {
  if (!fill) return null;
  if (fill.type === "linear-gradient" || fill.type === "radial-gradient") {
    return "gradient-fill";
  }
  if (fill.type === "finish") return "finish-fill";
  return null;
}

/** Sync reason an object (in isolation) cannot be drawn as vector paths. */
function objectRasterReason(obj: LabelObject): RasterReason | null {
  switch (obj.type) {
    case "image":
      return "image";
    case "text":
      if (obj.shadow) return "shadow";
      return fillNeedsRaster(obj.fill);
    case "rect":
    case "ellipse":
    case "polygon":
    case "star":
      if (obj.shadow) return "shadow";
      return fillNeedsRaster(obj.fill);
    case "line":
      return null;
    case "qrcode":
      return obj.logo ? "qr-logo" : null;
    case "barcode":
      return null; // determined at plan time (bwip-js parse)
    case "group":
      return obj.opacity < 1 && obj.children.length > 1 ? "group-opacity" : null;
  }
}

/**
 * Cheap synchronous pass for UI copy: which objects will fall back to raster
 * tiles (font-load failures can only be discovered async and are excluded).
 */
export function classifyVectorability(doc: LabelDocument): {
  rasterFallbacks: { id: string; name: string; reason: RasterReason }[];
} {
  const rasterFallbacks: { id: string; name: string; reason: RasterReason }[] = [];
  const walk = (objects: readonly LabelObject[]) => {
    for (const obj of objects) {
      if (!obj.visible) continue;
      const reason = objectRasterReason(obj);
      if (reason) {
        rasterFallbacks.push({ id: obj.id, name: objectLabel(obj), reason });
        continue;
      }
      if (obj.type === "group") walk(obj.children);
    }
  };
  walk(doc.objects);
  return { rasterFallbacks };
}

// ---------------------------------------------------------------------------
// Group flattening
// ---------------------------------------------------------------------------

/**
 * Map a group child into document space: children live in the group's
 * unrotated local space with (0,0) at the group box's top-left, positioned by
 * their centers. Same math as structure-commands' childToDocSpace.
 */
export function composeChildTransform<T extends LabelObject>(
  group: Pick<GroupObject, "xMm" | "yMm" | "widthMm" | "heightMm" | "rotationDeg" | "opacity">,
  child: T,
): T {
  const rad = (group.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const relX = child.xMm - group.widthMm / 2;
  const relY = child.yMm - group.heightMm / 2;
  return {
    ...child,
    xMm: group.xMm + relX * cos - relY * sin,
    yMm: group.yMm + relX * sin + relY * cos,
    rotationDeg: child.rotationDeg + group.rotationDeg,
    opacity: child.opacity * group.opacity,
  };
}

// ---------------------------------------------------------------------------
// AABB expansion for raster tiles
// ---------------------------------------------------------------------------

function shadowPadMm(obj: LabelObject): number {
  const shadow = "shadow" in obj ? obj.shadow : undefined;
  if (!shadow) return 0;
  const blurMm = fontPtToMm(shadow.blurPt);
  const offMm = Math.max(
    Math.abs(fontPtToMm(shadow.offsetXPt)),
    Math.abs(fontPtToMm(shadow.offsetYPt)),
  );
  return blurMm * 2 + offMm;
}

function strokePadMm(obj: LabelObject): number {
  const stroke: Stroke | undefined =
    "stroke" in obj ? (obj.stroke as Stroke | undefined) : undefined;
  if (stroke && stroke.widthPt > 0) return fontPtToMm(stroke.widthPt) / 2;
  if (obj.type === "line") return fontPtToMm(obj.strokePt) / 2;
  return 0;
}

/** Rotated AABB grown by stroke overhang, shadow spread, and a safety pad. */
export function expandedAabbMm(obj: LabelObject): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (obj.type === "group") {
    // Union of the children's expanded boxes mapped into doc space.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const child of obj.children) {
      const docChild = composeChildTransform(obj, child);
      const box = expandedAabbMm(docChild);
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
    }
    if (!Number.isFinite(minX)) return objectAabb(obj);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  const box = objectAabb(obj);
  const pad = strokePadMm(obj) + shadowPadMm(obj) + 0.25;
  return {
    x: box.x - pad,
    y: box.y - pad,
    width: box.width + 2 * pad,
    height: box.height + 2 * pad,
  };
}

function clampToRect(
  box: { x: number; y: number; width: number; height: number },
  bounds: { x: number; y: number; width: number; height: number },
): { x: number; y: number; width: number; height: number } | null {
  const x0 = Math.max(box.x, bounds.x);
  const y0 = Math.max(box.y, bounds.y);
  const x1 = Math.min(box.x + box.width, bounds.x + bounds.width);
  const y1 = Math.min(box.y + box.height, bounds.y + bounds.height);
  if (x1 - x0 <= 0.01 || y1 - y0 <= 0.01) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

// ---------------------------------------------------------------------------
// Per-type vector emitters (center-origin path elements)
// ---------------------------------------------------------------------------

function strokeToElement(
  stroke: Stroke | undefined,
): VectorPathElement["stroke"] | undefined {
  if (!stroke || stroke.widthPt <= 0) return undefined;
  return {
    color: stroke.color,
    widthMm: fontPtToMm(stroke.widthPt),
    dashMm:
      stroke.dash && stroke.dash.length > 0
        ? stroke.dash.map((d) => fontPtToMm(d))
        : undefined,
  };
}

function solidColor(fill: Fill | undefined): string | undefined {
  return fill && fill.type === "solid" ? fill.color : undefined;
}

function pathElement(
  obj: LabelObject,
  dMm: string,
  extras: Partial<VectorPathElement> = {},
): VectorPathElement {
  return {
    kind: "path",
    dMm,
    centerXMm: obj.xMm,
    centerYMm: obj.yMm,
    rotationDeg: obj.rotationDeg,
    scaleX: 1,
    scaleY: 1,
    opacity: obj.opacity,
    sourceId: obj.id,
    ...extras,
  };
}

async function planText(
  obj: TextObject,
  fonts: FontStore,
  push: (el: VectorElement) => void,
  warn: (message: string) => void,
): Promise<void> {
  const font: Font | null = await fonts.get(obj.fontFamilyId, obj.fontWeight);
  if (!font) {
    push(rasterElement(obj, "font-load"));
    warn(rasterWarning(objectLabel(obj), "font-load"));
    return;
  }

  const fontSizeMm = fontPtToMm(obj.fontSizePt);
  const scale = fontSizeMm / font.unitsPerEm;
  const letterSpacingMm = obj.letterSpacingEm * fontSizeMm;
  const text = applyTextTransform(obj.text, obj.textTransform);

  let d = "";
  if (obj.curve) {
    for (const g of curvedGlyphRawPlacements(font, obj.curve, text, scale, letterSpacingMm)) {
      d += transformedGlyphPathData(
        g.commands,
        scale,
        g.xOffset,
        -g.yOffset,
        g.rotateDeg,
        g.gxMm,
        g.gyMm,
      );
    }
  } else {
    const lines = straightTextLineData(
      font,
      obj,
      text,
      fontSizeMm,
      scale,
      letterSpacingMm,
      -obj.widthMm / 2,
      -obj.heightMm / 2,
    );
    d = lines.join("");
  }
  if (!d) return;

  push(
    pathElement(obj, d, {
      fillColor: solidColor(obj.fill) ?? "#000000",
      stroke: strokeToElement(obj.stroke),
      strokeOrder: obj.stroke && obj.stroke.widthPt > 0 ? "under-fill" : undefined,
    }),
  );
}

function planQr(
  obj: QrObject,
  push: (el: VectorElement) => void,
  warn: (message: string) => void,
): void {
  let matrix: ReturnType<typeof createQrMatrix>;
  try {
    matrix = createQrMatrix(obj.value, obj.ecLevel);
  } catch (err) {
    warn(
      `QR code "${objectLabel(obj)}" skipped: ${err instanceof Error ? err.message : "could not be encoded"}`,
    );
    return;
  }
  const total = qrTotalModules(matrix, obj.quietModules);

  if (obj.bgColor) {
    push(
      pathElement(obj, rectPathData(obj.widthMm, obj.heightMm, 0, true), {
        fillColor: obj.bgColor,
      }),
    );
  }

  const d =
    obj.moduleShape === "square"
      ? qrSquareRunsPathData(matrix, obj.quietModules)
      : obj.moduleShape === "rounded"
        ? qrRoundedModulesPathData(matrix, obj.quietModules)
        : qrDotModulesPathData(matrix, obj.quietModules);
  if (!d) return;

  push(
    pathElement(obj, d, {
      fillColor: obj.fgColor,
      scaleX: obj.widthMm / total,
      scaleY: obj.heightMm / total,
      postTranslateMm: { x: -obj.widthMm / 2, y: -obj.heightMm / 2 },
    }),
  );
}

function planBarcode(
  obj: BarcodeObject,
  push: (el: VectorElement) => void,
  warn: (message: string) => void,
): void {
  const validation = validateBarcodeValue(obj.symbology, obj.value);
  if (!validation.ok) {
    warn(
      `Barcode "${objectLabel(obj)}" skipped: ${validation.message ?? "invalid value"}`,
    );
    return;
  }

  const isMatrix = obj.symbology === "datamatrix";
  let generated: string;
  try {
    generated = bwipjs.toSVG({
      bcid: obj.symbology,
      text: validation.normalized ?? obj.value,
      ...(isMatrix
        ? {}
        : {
            height: 12,
            includetext: obj.showText,
            textxalign: "center" as const,
          }),
      barcolor: obj.fgColor.replace("#", ""),
      textcolor: obj.fgColor.replace("#", ""),
      paddingwidth: 2,
      paddingheight: 2,
    });
  } catch (err) {
    warn(
      `Barcode "${objectLabel(obj)}" skipped: ${err instanceof Error ? err.message : "could not be rendered"}`,
    );
    return;
  }

  const parsed = parseSvgPaths(generated);
  if (!parsed) {
    push(rasterElement(obj, "barcode-parse"));
    warn(rasterWarning(objectLabel(obj), "barcode-parse"));
    return;
  }

  if (obj.bgColor) {
    push(
      pathElement(obj, rectPathData(obj.widthMm, obj.heightMm, 0, true), {
        fillColor: obj.bgColor,
      }),
    );
  }

  const t = barcodeBoxTransform(obj, parsed.viewBox);
  for (const path of parsed.paths) {
    push(
      pathElement(obj, path.d, {
        fillColor: path.fill ?? (path.stroke ? undefined : obj.fgColor),
        stroke: path.stroke
          ? { color: path.stroke, widthMm: (path.strokeWidth ?? 1) * t.sx }
          : undefined,
        scaleX: t.sx,
        scaleY: t.sy,
        postTranslateMm: {
          x: t.txMm - obj.widthMm / 2,
          y: t.tyMm - obj.heightMm / 2,
        },
      }),
    );
  }
}

function rasterElement(obj: LabelObject, reason: RasterReason): VectorRasterElement {
  return {
    kind: "raster",
    objects: [obj],
    aabbMm: expandedAabbMm(obj),
    reason,
    sourceId: obj.id,
    sourceName: objectLabel(obj),
  };
}

// ---------------------------------------------------------------------------
// Document walk
// ---------------------------------------------------------------------------

export async function planVectorDoc(
  doc: LabelDocument,
  options: VectorDocOptions = {},
): Promise<VectorDocPlan> {
  const warnings: string[] = [];
  const warn = (message: string) => {
    if (!warnings.includes(message)) warnings.push(message);
  };
  const fonts = new FontStore(
    options.loadFontBytes ?? fetchFontBytes,
    warn,
    "vector PDF",
  );

  const elements: VectorElement[] = [];
  const bounds = bleedRect(doc);
  const push = (el: VectorElement) => {
    if (el.kind === "raster") {
      const clamped = clampToRect(el.aabbMm, bounds);
      if (!clamped) {
        warn(`“${el.sourceName}” lies outside the artwork area; omitted.`);
        return;
      }
      elements.push({ ...el, aabbMm: clamped });
    } else {
      elements.push(el);
    }
  };

  const visit = async (obj: LabelObject): Promise<void> => {
    if (!obj.visible) return;

    const reason = objectRasterReason(obj);
    if (reason) {
      push(rasterElement(obj, reason));
      warn(rasterWarning(objectLabel(obj), reason));
      return;
    }

    switch (obj.type) {
      case "text":
        await planText(obj, fonts, push, warn);
        return;
      case "rect":
        push(
          pathElement(obj, rectPathData(obj.widthMm, obj.heightMm, obj.cornerRadiusMm, true), {
            fillColor: solidColor(obj.fill),
            stroke: strokeToElement(obj.stroke),
          }),
        );
        return;
      case "ellipse":
        push(
          pathElement(obj, ellipsePathData(obj.widthMm / 2, obj.heightMm / 2), {
            fillColor: solidColor(obj.fill),
            stroke: strokeToElement(obj.stroke),
          }),
        );
        return;
      case "line": {
        const half = obj.widthMm / 2;
        push(
          pathElement(obj, `M${-half} 0L${half} 0`, {
            stroke: {
              color: obj.color,
              widthMm: fontPtToMm(obj.strokePt),
              dashMm:
                obj.dash && obj.dash.length > 0
                  ? obj.dash.map((d) => fontPtToMm(d))
                  : undefined,
              cap: obj.cap,
            },
          }),
        );
        return;
      }
      case "polygon":
        push(
          pathElement(obj, pointsPathData(polygonPointsMm(obj)), {
            fillColor: solidColor(obj.fill),
            stroke: strokeToElement(obj.stroke),
          }),
        );
        return;
      case "star":
        push(
          pathElement(obj, pointsPathData(starPointsMm(obj)), {
            fillColor: solidColor(obj.fill),
            stroke: strokeToElement(obj.stroke),
          }),
        );
        return;
      case "qrcode":
        planQr(obj, push, warn);
        return;
      case "barcode":
        planBarcode(obj, push, warn);
        return;
      case "image":
        // objectRasterReason already routed images to raster.
        return;
      case "group": {
        // Flatten: children are re-based into doc space and visited in order.
        for (const child of obj.children) {
          await visit(composeChildTransform(obj, child));
        }
        return;
      }
    }
  };

  for (const obj of doc.objects) {
    await visit(obj);
  }

  let background: VectorDocPlan["background"];
  switch (doc.background.type) {
    case "none":
      background = { kind: "none" };
      break;
    case "solid":
      background = { kind: "solid", color: doc.background.color };
      break;
    default:
      background = { kind: "raster" };
      if (doc.background.type === "finish") {
        warn("Simulated finish backgrounds are embedded as raster in the vector PDF.");
      } else {
        warn("Gradient backgrounds are embedded as raster in the vector PDF.");
      }
      break;
  }

  return { elements, background, warnings };
}
