import type { Font } from "fontkit";
import bwipjs from "bwip-js/browser";
import type {
  Background,
  BarcodeObject,
  EllipseObject,
  Fill,
  GroupObject,
  ImageObject,
  ImageSource,
  LabelDocument,
  LabelObject,
  LineObject,
  PolygonObject,
  QrObject,
  RectObject,
  StarObject,
  TextObject,
} from "@/lib/document/schema";
import { fontPtToMm } from "@/lib/geometry/units";
import { applyTextTransform, resolveImageLayout } from "@/lib/render/node-configs";
import { createQrMatrix, qrTotalModules } from "@/lib/codes/qr";
import { validateBarcodeValue } from "@/lib/codes/validate";
import { FontStore, fetchFontBytes } from "./font-store";
import {
  curvedGlyphPlacements,
  polygonPointsMm,
  qrSquareRunsPathData,
  starPointsMm,
  straightTextLineData,
} from "./vector-paths";
import {
  bytesToBase64,
  escapeXml,
  FINISH_FALLBACK_COLOR,
  fmt,
  linearGradientDef,
  resolveFillPaint,
  strokeAttrs,
  xmlId,
} from "./svg-helpers";

/**
 * True-vector SVG export.
 *
 * User units are millimeters (viewBox spans trim + bleed in mm; width/height
 * carry explicit mm units), matching the document's coordinate conventions:
 * (0,0) = trim top-left, bleed extends negative, object x/y = center,
 * rotation clockwise about the center.
 *
 * Shapes, text (glyph outlines via fontkit), QR codes, and barcodes
 * (bwip-js SVG drawing) are emitted as real vector geometry so print shops
 * can edit the file in Illustrator. Raster content is limited to embedded
 * source images. Anything that cannot be vectorized (finish fills, shadows,
 * image filters, QR logos) is omitted or simplified with a warning.
 */

export interface SvgExportOptions {
  /** Byte loader for font files (defaults to fetch(fontFileUrl(...))). */
  loadFontBytes?: (familyId: string, weight: number) => Promise<ArrayBuffer>;
  /** Byte loader for images (defaults to the storage adapter / fetch). */
  loadImageBytes?: (
    source: ImageSource,
  ) => Promise<{ bytes: ArrayBuffer; mimeType: string }>;
  /** Include bleed area (default true). */
  includeBleed?: boolean;
}

export interface SvgExportResult {
  svg: string;
  warnings: string[];
}

const SHADOW_WARNING =
  "drop shadows are rasterized only in PNG/PDF exports; omitted in SVG";
const FINISH_BG_WARNING =
  "Simulated finish backgrounds are not vector; choose PDF for finish previews.";
const QR_LOGO_WARNING =
  "QR logo overlays are omitted in SVG export — verify scannability";
const IMAGE_FILTER_WARNING = "image adjustments are not applied in SVG export";

// ---------------------------------------------------------------------------
// Export context
// ---------------------------------------------------------------------------

interface EmitContext {
  defs: string[];
  warnings: string[];
  fonts: FontStore;
  loadImageBytes: (
    source: ImageSource,
  ) => Promise<{ bytes: ArrayBuffer; mimeType: string }>;
}

function warn(ctx: EmitContext, message: string): void {
  if (!ctx.warnings.includes(message)) ctx.warnings.push(message);
}

function objectLabel(obj: LabelObject): string {
  return obj.name || obj.id;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/**
 * Standard object wrapper: translate to the stored center, rotate clockwise,
 * then shift so local (0,0) is the object's top-left box corner. Shapes that
 * are natively center-origin (ellipse/polygon/star/line/curved text) skip
 * the final shift and draw around local (0,0).
 */
function objectTransform(obj: LabelObject, centerOrigin: boolean): string {
  const parts: string[] = [];
  if (obj.rotationDeg !== 0) {
    parts.push(`translate(${fmt(obj.xMm)} ${fmt(obj.yMm)})`);
    parts.push(`rotate(${fmt(obj.rotationDeg)})`);
    if (!centerOrigin) {
      parts.push(`translate(${fmt(-obj.widthMm / 2)} ${fmt(-obj.heightMm / 2)})`);
    }
  } else if (centerOrigin) {
    parts.push(`translate(${fmt(obj.xMm)} ${fmt(obj.yMm)})`);
  } else {
    parts.push(
      `translate(${fmt(obj.xMm - obj.widthMm / 2)} ${fmt(obj.yMm - obj.heightMm / 2)})`,
    );
  }
  return parts.join(" ");
}

function wrap(obj: LabelObject, inner: string, centerOrigin: boolean): string {
  if (!inner) return "";
  const opacity = obj.opacity < 1 ? ` opacity="${fmt(obj.opacity)}"` : "";
  return (
    `<g id="${escapeXml(xmlId(obj.id))}" transform="${objectTransform(obj, centerOrigin)}"${opacity}>\n` +
    `${inner}\n</g>`
  );
}

/** Resolve an object fill, hoisting gradient defs and surfacing warnings. */
function fillPaint(
  ctx: EmitContext,
  obj: LabelObject,
  fill: Fill | undefined,
  size: { width: number; height: number },
): string {
  const res = resolveFillPaint(fill, size, `grad-${xmlId(obj.id)}`);
  if (res.def) ctx.defs.push(res.def);
  if (res.warning) warn(ctx, res.warning);
  return res.paint;
}

function shadowCheck(ctx: EmitContext, obj: { shadow?: unknown }): void {
  if (obj.shadow) warn(ctx, SHADOW_WARNING);
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

function emitRect(ctx: EmitContext, obj: RectObject): string {
  shadowCheck(ctx, obj);
  const paint = fillPaint(ctx, obj, obj.fill, { width: obj.widthMm, height: obj.heightMm });
  const rx = obj.cornerRadiusMm > 0 ? ` rx="${fmt(obj.cornerRadiusMm)}"` : "";
  const inner =
    `<rect x="0" y="0" width="${fmt(obj.widthMm)}" height="${fmt(obj.heightMm)}"${rx}` +
    ` fill="${paint}"${strokeAttrs(obj.stroke)}/>`;
  return wrap(obj, inner, false);
}

function emitEllipse(ctx: EmitContext, obj: EllipseObject): string {
  shadowCheck(ctx, obj);
  const paint = fillPaint(ctx, obj, obj.fill, { width: obj.widthMm, height: obj.heightMm });
  const inner =
    `<ellipse cx="0" cy="0" rx="${fmt(obj.widthMm / 2)}" ry="${fmt(obj.heightMm / 2)}"` +
    ` fill="${paint}"${strokeAttrs(obj.stroke)}/>`;
  return wrap(obj, inner, true);
}

function emitLine(ctx: EmitContext, obj: LineObject): string {
  const half = obj.widthMm / 2;
  let attrs =
    ` stroke="${escapeXml(obj.color)}" stroke-width="${fmt(fontPtToMm(obj.strokePt))}"`;
  if (obj.dash && obj.dash.length > 0) {
    attrs += ` stroke-dasharray="${obj.dash.map((d) => fmt(fontPtToMm(d))).join(" ")}"`;
  }
  if (obj.cap !== "butt") attrs += ` stroke-linecap="${obj.cap}"`;
  const inner = `<line x1="${fmt(-half)}" y1="0" x2="${fmt(half)}" y2="0"${attrs}/>`;
  return wrap(obj, inner, true);
}

/** Konva.RegularPolygon vertices: angle -90° + k·360°/sides, radius min(w,h)/2. */
function emitPolygon(ctx: EmitContext, obj: PolygonObject): string {
  shadowCheck(ctx, obj);
  const paint = fillPaint(ctx, obj, obj.fill, { width: obj.widthMm, height: obj.heightMm });
  const pts = polygonPointsMm(obj).map((p) => `${fmt(p.x, 3)},${fmt(p.y, 3)}`);
  const inner =
    `<polygon points="${pts.join(" ")}" fill="${paint}"${strokeAttrs(obj.stroke)}/>`;
  return wrap(obj, inner, true);
}

/** Konva.Star: 2·points vertices from -90°, alternating outer/inner radii. */
function emitStar(ctx: EmitContext, obj: StarObject): string {
  shadowCheck(ctx, obj);
  const paint = fillPaint(ctx, obj, obj.fill, { width: obj.widthMm, height: obj.heightMm });
  const pts = starPointsMm(obj).map((p) => `${fmt(p.x, 3)},${fmt(p.y, 3)}`);
  const markup =
    `<polygon points="${pts.join(" ")}" fill="${paint}"${strokeAttrs(obj.stroke)}/>`;
  return wrap(obj, markup, true);
}

// ---------------------------------------------------------------------------
// Text — glyph outlines
// ---------------------------------------------------------------------------

async function emitText(ctx: EmitContext, obj: TextObject): Promise<string> {
  shadowCheck(ctx, obj);
  const font = await ctx.fonts.get(obj.fontFamilyId, obj.fontWeight);
  if (!font) {
    warn(ctx, `Text "${objectLabel(obj)}" skipped: no usable font could be loaded.`);
    return "";
  }

  const fontSizeMm = fontPtToMm(obj.fontSizePt);
  const scale = fontSizeMm / font.unitsPerEm;
  const letterSpacingMm = obj.letterSpacingEm * fontSizeMm;
  const size = { width: obj.widthMm, height: obj.heightMm };

  // Curved text lays each glyph out with its own transform, so a shared
  // userSpaceOnUse gradient cannot resolve consistently — fall back to the
  // first stop color there. Straight text bakes coordinates into mm space,
  // where gradients work exactly.
  let paint: string;
  if (
    obj.curve &&
    (obj.fill.type === "linear-gradient" || obj.fill.type === "radial-gradient")
  ) {
    paint = obj.fill.stops[0]?.color ?? "#000000";
    warn(ctx, "Gradient fills on curved text are exported as a solid color in SVG.");
  } else {
    paint = fillPaint(ctx, obj, obj.fill, size);
  }

  let groupAttrs = ` fill="${paint}"`;
  if (obj.stroke && obj.stroke.widthPt > 0) {
    // Konva renders text with fillAfterStrokeEnabled (stroke under fill).
    groupAttrs += `${strokeAttrs(obj.stroke)} paint-order="stroke"`;
  }

  const text = applyTextTransform(obj.text, obj.textTransform);
  const paths = obj.curve
    ? emitCurvedGlyphs(font, obj, text, scale, letterSpacingMm)
    : emitStraightLines(font, obj, text, fontSizeMm, scale, letterSpacingMm);
  if (paths.length === 0) return "";

  const opacity = obj.opacity < 1 ? ` opacity="${fmt(obj.opacity)}"` : "";
  return (
    `<g id="${escapeXml(xmlId(obj.id))}" transform="${objectTransform(obj, Boolean(obj.curve))}"${opacity}${groupAttrs}>\n` +
    `${paths.join("\n")}\n</g>`
  );
}

/**
 * Straight text: shared line layout from vector-paths (Konva half-leading
 * metrics), serialized here as <path> elements.
 */
function emitStraightLines(
  font: Font,
  obj: TextObject,
  text: string,
  fontSizeMm: number,
  scale: number,
  letterSpacingMm: number,
): string[] {
  return straightTextLineData(font, obj, text, fontSizeMm, scale, letterSpacingMm).map(
    (d) => `<path d="${d}"/>`,
  );
}

/**
 * Curved text: shared circle placement from vector-paths (identical to
 * Konva.TextPath's per-glyph geometry), serialized as transformed <path>s.
 */
function emitCurvedGlyphs(
  font: Font,
  obj: TextObject,
  text: string,
  scale: number,
  letterSpacingMm: number,
): string[] {
  return curvedGlyphPlacements(font, obj.curve!, text, scale, letterSpacingMm).map(
    (p) =>
      `<path transform="translate(${fmt(p.gxMm, 3)} ${fmt(p.gyMm, 3)}) rotate(${fmt(p.rotateDeg, 3)})" d="${p.d}"/>`,
  );
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

async function defaultLoadImageBytes(
  source: ImageSource,
): Promise<{ bytes: ArrayBuffer; mimeType: string }> {
  if (source.kind === "asset") {
    // Dynamic import keeps IndexedDB out of node test bundles.
    const { getStorageAdapter } = await import("@/lib/storage");
    const blob = await getStorageAdapter().getAssetBlob(source.assetId);
    if (!blob) throw new Error(`Asset ${source.assetId} not found`);
    return { bytes: await blob.arrayBuffer(), mimeType: blob.type || "image/png" };
  }
  const res = await fetch(source.url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${source.url}`);
  const blob = await res.blob();
  return { bytes: await blob.arrayBuffer(), mimeType: blob.type || "image/png" };
}

function hasNonDefaultFilters(obj: ImageObject): boolean {
  const f = obj.filters;
  return (
    f.brightness !== 0 ||
    f.contrast !== 0 ||
    f.saturation !== 0 ||
    f.blurPx !== 0 ||
    f.grayscale
  );
}

/**
 * Images embed the ORIGINAL bytes as a data URI (filters cannot be baked
 * outside the browser). Crop strategy: resolveImageLayout gives a source
 * crop (natural px) plus a draw rect (mm); the full-size <image> is scaled by
 * drawRect/cropRect and translated so the crop's corner lands on the draw
 * rect's corner, then a <clipPath> rect trims everything outside the draw
 * rect. Flips mirror the image inside the draw rect, which is symmetric, so
 * they compose safely outside the crop transform.
 */
async function emitImage(ctx: EmitContext, obj: ImageObject): Promise<string> {
  shadowCheck(ctx, obj);
  if (hasNonDefaultFilters(obj)) warn(ctx, IMAGE_FILTER_WARNING);

  let loaded: { bytes: ArrayBuffer; mimeType: string };
  try {
    loaded = await ctx.loadImageBytes(obj.source);
  } catch {
    warn(
      ctx,
      `Image "${objectLabel(obj)}" could not be loaded; omitted from SVG export.`,
    );
    return "";
  }
  const href = `data:${loaded.mimeType};base64,${bytesToBase64(new Uint8Array(loaded.bytes))}`;

  const layout = resolveImageLayout(obj);
  const eps = 0.001;
  const needsClip =
    layout.crop.x > eps ||
    layout.crop.y > eps ||
    layout.crop.width < obj.naturalWidthPx - eps ||
    layout.crop.height < obj.naturalHeightPx - eps;

  let flip = "";
  if (obj.flipX || obj.flipY) {
    const tx = obj.flipX ? 2 * layout.dxMm + layout.drawWidthMm : 0;
    const ty = obj.flipY ? 2 * layout.dyMm + layout.drawHeightMm : 0;
    flip = `translate(${fmt(tx)} ${fmt(ty)}) scale(${obj.flipX ? -1 : 1} ${obj.flipY ? -1 : 1})`;
  }

  const hrefAttrs = ` preserveAspectRatio="none" href="${href}" xlink:href="${href}"`;

  let inner: string;
  if (!needsClip) {
    const t = flip ? ` transform="${flip}"` : "";
    inner =
      `<image x="${fmt(layout.dxMm)}" y="${fmt(layout.dyMm)}"` +
      ` width="${fmt(layout.drawWidthMm)}" height="${fmt(layout.drawHeightMm)}"${t}${hrefAttrs}/>`;
  } else {
    const clipId = `clip-${xmlId(obj.id)}`;
    ctx.defs.push(
      `<clipPath id="${clipId}"><rect x="${fmt(layout.dxMm)}" y="${fmt(layout.dyMm)}"` +
        ` width="${fmt(layout.drawWidthMm)}" height="${fmt(layout.drawHeightMm)}"/></clipPath>`,
    );
    const sx = layout.drawWidthMm / layout.crop.width;
    const sy = layout.drawHeightMm / layout.crop.height;
    const tx = layout.dxMm - layout.crop.x * sx;
    const ty = layout.dyMm - layout.crop.y * sy;
    const t = `${flip ? `${flip} ` : ""}translate(${fmt(tx)} ${fmt(ty)}) scale(${fmt(sx, 6)} ${fmt(sy, 6)})`;
    inner =
      `<g clip-path="url(#${clipId})">` +
      `<image x="0" y="0" width="${fmt(obj.naturalWidthPx)}" height="${fmt(obj.naturalHeightPx)}"` +
      ` transform="${t}"${hrefAttrs}/></g>`;
  }
  return wrap(obj, inner, false);
}

// ---------------------------------------------------------------------------
// QR codes
// ---------------------------------------------------------------------------

/**
 * QR modules as vector geometry, mirroring renderQrToCanvas: quiet-zone
 * offset, module grid scaled to the box, square/rounded/dot shapes. Drawn in
 * a unit-per-module space then scaled, so module size = width/totalModules.
 */
function emitQr(ctx: EmitContext, obj: QrObject): string {
  if (obj.logo) warn(ctx, QR_LOGO_WARNING);

  let matrix: ReturnType<typeof createQrMatrix>;
  try {
    matrix = createQrMatrix(obj.value, obj.ecLevel);
  } catch (err) {
    warn(
      ctx,
      `QR code "${objectLabel(obj)}" skipped: ${err instanceof Error ? err.message : "could not be encoded"}`,
    );
    return "";
  }

  const total = qrTotalModules(matrix, obj.quietModules);
  const parts: string[] = [];
  if (obj.bgColor) {
    parts.push(`<rect x="0" y="0" width="${total}" height="${total}" fill="${escapeXml(obj.bgColor)}"/>`);
  }

  const q = obj.quietModules;
  const fg = escapeXml(obj.fgColor);
  switch (obj.moduleShape) {
    case "square": {
      // One path; horizontal runs of dark modules merge into single subpaths.
      const d = qrSquareRunsPathData(matrix, q);
      if (d) parts.push(`<path d="${d}" fill="${fg}"/>`);
      break;
    }
    case "rounded": {
      // Canvas version insets by ~half a raster pixel; 5% of a module keeps
      // the same slight separation resolution-independently (rx = 0.3 module).
      for (let y = 0; y < matrix.size; y++) {
        for (let x = 0; x < matrix.size; x++) {
          if (!matrix.get(x, y)) continue;
          parts.push(
            `<rect x="${fmt(x + q + 0.05, 2)}" y="${fmt(y + q + 0.05, 2)}" width="0.9" height="0.9" rx="0.3" fill="${fg}"/>`,
          );
        }
      }
      break;
    }
    case "dot": {
      for (let y = 0; y < matrix.size; y++) {
        for (let x = 0; x < matrix.size; x++) {
          if (!matrix.get(x, y)) continue;
          parts.push(
            `<circle cx="${fmt(x + q + 0.5, 2)}" cy="${fmt(y + q + 0.5, 2)}" r="0.425" fill="${fg}"/>`,
          );
        }
      }
      break;
    }
  }

  const inner =
    `<g transform="scale(${fmt(obj.widthMm / total, 6)} ${fmt(obj.heightMm / total, 6)})">\n` +
    `${parts.join("\n")}\n</g>`;
  return wrap(obj, inner, false);
}

// ---------------------------------------------------------------------------
// Barcodes
// ---------------------------------------------------------------------------

function stripHash(color: string): string {
  return color.replace("#", "");
}

/**
 * Barcodes come from bwip-js's own SVG drawing (bars and human-readable text
 * are both <path>s). The generated <svg> is unwrapped and its viewBox mapped
 * into the object box: 1D codes stretch to fill (same as the canvas
 * renderer); Data Matrix keeps its square aspect, centered.
 */
function emitBarcode(ctx: EmitContext, obj: BarcodeObject): string {
  const validation = validateBarcodeValue(obj.symbology, obj.value);
  if (!validation.ok) {
    warn(
      ctx,
      `Barcode "${objectLabel(obj)}" skipped: ${validation.message ?? "invalid value"}`,
    );
    return "";
  }

  const isMatrix = obj.symbology === "datamatrix";
  let generated: string;
  try {
    // Our schema symbology ids are exactly bwip-js bcids.
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
      barcolor: stripHash(obj.fgColor),
      textcolor: stripHash(obj.fgColor),
      ...(obj.bgColor ? { backgroundcolor: stripHash(obj.bgColor) } : {}),
      paddingwidth: 2,
      paddingheight: 2,
    });
  } catch (err) {
    warn(
      ctx,
      `Barcode "${objectLabel(obj)}" skipped: ${err instanceof Error ? err.message : "could not be rendered"}`,
    );
    return "";
  }

  const viewBoxMatch = generated.match(/viewBox="([^"]+)"/);
  const openTagEnd = generated.indexOf(">");
  const closeTag = generated.lastIndexOf("</svg>");
  if (!viewBoxMatch || openTagEnd === -1 || closeTag === -1) {
    warn(ctx, `Barcode "${objectLabel(obj)}" skipped: unexpected renderer output.`);
    return "";
  }
  const [minX = 0, minY = 0, vw = 1, vh = 1] = viewBoxMatch[1]!
    .trim()
    .split(/\s+/)
    .map(Number);
  const content = generated.slice(openTagEnd + 1, closeTag).trim();

  let transform: string;
  if (isMatrix) {
    const s = Math.min(obj.widthMm / vw, obj.heightMm / vh);
    const tx = (obj.widthMm - vw * s) / 2 - minX * s;
    const ty = (obj.heightMm - vh * s) / 2 - minY * s;
    transform = `translate(${fmt(tx)} ${fmt(ty)}) scale(${fmt(s, 6)})`;
  } else {
    const sx = obj.widthMm / vw;
    const sy = obj.heightMm / vh;
    transform = `scale(${fmt(sx, 6)} ${fmt(sy, 6)})`;
    if (minX !== 0 || minY !== 0) transform += ` translate(${fmt(-minX)} ${fmt(-minY)})`;
  }

  const inner = `<g transform="${transform}">\n${content}\n</g>`;
  return wrap(obj, inner, false);
}

// ---------------------------------------------------------------------------
// Groups + dispatch
// ---------------------------------------------------------------------------

async function emitGroup(ctx: EmitContext, obj: GroupObject): Promise<string> {
  const children: string[] = [];
  for (const child of obj.children) {
    const markup = await emitObject(ctx, child);
    if (markup) children.push(markup);
  }
  if (children.length === 0) return "";
  // Children live in the group's unrotated local space with (0,0) at the
  // group box's top-left — the same convention as the root canvas.
  return wrap(obj, children.join("\n"), false);
}

async function emitObject(ctx: EmitContext, obj: LabelObject): Promise<string> {
  if (!obj.visible) return "";
  switch (obj.type) {
    case "text":
      return emitText(ctx, obj);
    case "rect":
      return emitRect(ctx, obj);
    case "ellipse":
      return emitEllipse(ctx, obj);
    case "line":
      return emitLine(ctx, obj);
    case "polygon":
      return emitPolygon(ctx, obj);
    case "star":
      return emitStar(ctx, obj);
    case "image":
      return emitImage(ctx, obj);
    case "qrcode":
      return emitQr(ctx, obj);
    case "barcode":
      return emitBarcode(ctx, obj);
    case "group":
      return emitGroup(ctx, obj);
  }
}

// ---------------------------------------------------------------------------
// Background + document
// ---------------------------------------------------------------------------

function emitBackground(
  ctx: EmitContext,
  background: Background,
  rect: { x: number; y: number; width: number; height: number },
): string {
  const rectAttrs =
    `x="${fmt(rect.x)}" y="${fmt(rect.y)}" width="${fmt(rect.width)}" height="${fmt(rect.height)}"`;
  switch (background.type) {
    case "none":
      return "";
    case "solid":
      return `<rect ${rectAttrs} fill="${escapeXml(background.color)}"/>`;
    case "linear-gradient": {
      // Endpoints span the full background rect (bleed included), offset into
      // its negative-origin coordinates — same geometry as fills.ts.
      const id = "grad-background";
      ctx.defs.push(linearGradientDef(id, background.angleDeg, background.stops, rect));
      return `<rect ${rectAttrs} fill="url(#${id})"/>`;
    }
    case "finish":
      warn(ctx, FINISH_BG_WARNING);
      return `<rect ${rectAttrs} fill="${FINISH_FALLBACK_COLOR}"/>`;
  }
}

export async function exportSvg(
  doc: LabelDocument,
  options: SvgExportOptions = {},
): Promise<SvgExportResult> {
  const warnings: string[] = [];
  const ctx: EmitContext = {
    defs: [],
    warnings,
    fonts: new FontStore(options.loadFontBytes ?? fetchFontBytes, (message) => {
      if (!warnings.includes(message)) warnings.push(message);
    }),
    loadImageBytes: options.loadImageBytes ?? defaultLoadImageBytes,
  };

  const bleed = options.includeBleed === false ? 0 : doc.label.bleedMm;
  const minX = -bleed;
  const minY = -bleed;
  const width = doc.label.widthMm + 2 * bleed;
  const height = doc.label.heightMm + 2 * bleed;

  const body: string[] = [];
  const background = emitBackground(ctx, doc.background, {
    x: minX,
    y: minY,
    width,
    height,
  });
  if (background) body.push(background);

  for (const obj of doc.objects) {
    const markup = await emitObject(ctx, obj);
    if (markup) body.push(markup);
  }

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"` +
      ` width="${fmt(width)}mm" height="${fmt(height)}mm"` +
      ` viewBox="${fmt(minX)} ${fmt(minY)} ${fmt(width)} ${fmt(height)}">`,
  ];
  if (ctx.defs.length > 0) parts.push(`<defs>\n${ctx.defs.join("\n")}\n</defs>`);
  parts.push(...body, `</svg>`);

  return { svg: parts.join("\n"), warnings };
}
