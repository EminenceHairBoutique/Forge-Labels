import type { Font, PathCommand } from "fontkit";
import type {
  BarcodeObject,
  PolygonObject,
  StarObject,
  TextObject,
} from "@/lib/document/schema";
import type { QrMatrix } from "@/lib/codes/qr";
import { fmt } from "./svg-helpers";

/**
 * Shared vector geometry for the true-vector exporters. Everything here is
 * pure math over document objects: SVG path data strings (y-down, mm units
 * unless noted) plus the numeric placements the serializers need. The SVG
 * exporter formats these into markup; the vector PDF feeds the same data to
 * pdf-lib's drawSvgPath. Keeping one home for glyph layout, QR module runs,
 * and barcode box mapping is what guarantees the two exporters agree.
 */

// ---------------------------------------------------------------------------
// Glyph outlines
// ---------------------------------------------------------------------------

/**
 * Serialize a glyph outline (font units, y-up) into absolute mm-space path
 * data: x → ox + x·scale, y → oy − y·scale (the sign flip converts the
 * font's y-up axis to SVG's y-down axis). Baking the full transform into the
 * path keeps userSpaceOnUse gradients correct and needs no nested scaling.
 */
export function glyphPathData(
  commands: PathCommand[],
  scale: number,
  ox: number,
  oy: number,
): string {
  const px = (x: number) => fmt(ox + x * scale, 3);
  const py = (y: number) => fmt(oy - y * scale, 3);
  let d = "";
  for (const cmd of commands) {
    const a = cmd.args;
    switch (cmd.command) {
      case "moveTo":
        d += `M${px(a[0]!)} ${py(a[1]!)}`;
        break;
      case "lineTo":
        d += `L${px(a[0]!)} ${py(a[1]!)}`;
        break;
      case "quadraticCurveTo":
        d += `Q${px(a[0]!)} ${py(a[1]!)} ${px(a[2]!)} ${py(a[3]!)}`;
        break;
      case "bezierCurveTo":
        d +=
          `C${px(a[0]!)} ${py(a[1]!)} ${px(a[2]!)} ${py(a[3]!)}` +
          ` ${px(a[4]!)} ${py(a[5]!)}`;
        break;
      case "closePath":
        d += "Z";
        break;
    }
  }
  return d;
}

/**
 * Like glyphPathData, but with a rigid transform baked in after the glyph's
 * local placement: local point → rotate by rotateDeg (clockwise, y-down) →
 * translate by (txMm, tyMm). Used for curved text in the vector PDF, where
 * each glyph must land in the object's center-origin space as plain path data
 * (drawSvgPath offers only one rotation per call).
 */
export function transformedGlyphPathData(
  commands: PathCommand[],
  scale: number,
  ox: number,
  oy: number,
  rotateDeg: number,
  txMm: number,
  tyMm: number,
): string {
  const rad = (rotateDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const map = (x: number, y: number): { x: number; y: number } => {
    const lx = ox + x * scale;
    const ly = oy - y * scale;
    return { x: txMm + lx * cos - ly * sin, y: tyMm + lx * sin + ly * cos };
  };
  const pt = (x: number, y: number): string => {
    const p = map(x, y);
    return `${fmt(p.x, 3)} ${fmt(p.y, 3)}`;
  };
  let d = "";
  for (const cmd of commands) {
    const a = cmd.args;
    switch (cmd.command) {
      case "moveTo":
        d += `M${pt(a[0]!, a[1]!)}`;
        break;
      case "lineTo":
        d += `L${pt(a[0]!, a[1]!)}`;
        break;
      case "quadraticCurveTo":
        d += `Q${pt(a[0]!, a[1]!)} ${pt(a[2]!, a[3]!)}`;
        break;
      case "bezierCurveTo":
        d += `C${pt(a[0]!, a[1]!)} ${pt(a[2]!, a[3]!)} ${pt(a[4]!, a[5]!)}`;
        break;
      case "closePath":
        d += "Z";
        break;
    }
  }
  return d;
}

export interface GlyphRunMetrics {
  glyphs: { commands: PathCommand[]; xOffset: number; yOffset: number }[];
  /** Per-glyph advance in mm (font advance only, letter spacing excluded). */
  advancesMm: number[];
  /** Total run width in mm including letter spacing between glyphs. */
  widthMm: number;
}

export function layoutRun(
  font: Font,
  text: string,
  scale: number,
  letterSpacingMm: number,
): GlyphRunMetrics {
  const run = font.layout(text);
  const glyphs: GlyphRunMetrics["glyphs"] = [];
  const advancesMm: number[] = [];
  let widthMm = 0;
  for (let i = 0; i < run.glyphs.length; i++) {
    const glyph = run.glyphs[i]!;
    const pos = run.positions[i]!;
    glyphs.push({
      commands: glyph.path.commands,
      xOffset: pos.xOffset * scale,
      yOffset: pos.yOffset * scale,
    });
    const adv = pos.xAdvance * scale;
    advancesMm.push(adv);
    widthMm += adv;
  }
  if (glyphs.length > 1) widthMm += letterSpacingMm * (glyphs.length - 1);
  return { glyphs, advancesMm, widthMm };
}

export function alignOffset(
  align: TextObject["align"],
  boxWidth: number,
  lineWidth: number,
): number {
  if (align === "center") return (boxWidth - lineWidth) / 2;
  if (align === "right") return boxWidth - lineWidth;
  return 0;
}

/**
 * Straight text lines as path data: split on newlines, no wrapping (the
 * editor keeps heightMm in sync with the measured text, so stored documents
 * fit their boxes). Vertical metrics replicate Konva's line boxes: each line
 * occupies lineHeight·fontSize with the glyph baseline at
 * ascender + (lineHeight − 1)·fontSize/2 from the box top (half-leading).
 * Origin defaults to the object box's top-left (0,0); pass offsets to bake a
 * different origin (the vector PDF uses center-origin −w/2, −h/2).
 */
export function straightTextLineData(
  font: Font,
  obj: Pick<TextObject, "align" | "widthMm" | "lineHeight">,
  text: string,
  fontSizeMm: number,
  scale: number,
  letterSpacingMm: number,
  originX = 0,
  originY = 0,
): string[] {
  const ascenderMm = (font.ascent / font.unitsPerEm) * fontSizeMm;
  const halfLeadingMm = ((obj.lineHeight - 1) * fontSizeMm) / 2;
  const lineHeightMm = obj.lineHeight * fontSizeMm;

  const paths: string[] = [];
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (line.length === 0) continue;
    const run = layoutRun(font, line, scale, letterSpacingMm);
    if (run.glyphs.length === 0) continue;

    const baselineY = originY + halfLeadingMm + ascenderMm + index * lineHeightMm;
    let penX = originX + alignOffset(obj.align, obj.widthMm, run.widthMm);
    let d = "";
    for (let i = 0; i < run.glyphs.length; i++) {
      const g = run.glyphs[i]!;
      d += glyphPathData(g.commands, scale, penX + g.xOffset, baselineY - g.yOffset);
      penX += run.advancesMm[i]! + letterSpacingMm;
    }
    if (d) paths.push(d);
  }
  return paths;
}

export interface CurvedGlyphRaw {
  commands: PathCommand[];
  /** Glyph positioning offsets, already scaled to mm. */
  xOffset: number;
  yOffset: number;
  /** Pen point on the circle, in the object's center-origin space (mm). */
  gxMm: number;
  gyMm: number;
  /** Chord rotation, degrees clockwise (already normalized to [0, 360)). */
  rotateDeg: number;
}

/**
 * Curved text: glyphs on a circle of curve.radiusMm centered at the object's
 * (xMm, yMm) — the same geometry as curvedTextPathData. Direction "up" runs
 * clockwise over the top semicircle (apex at 270° in SVG's y-down angles),
 * "down" counterclockwise under the bottom (apex at 90°); the run is centered
 * on the apex. Each glyph's pen point sits on the circle (the radius reaches
 * the baseline) and the glyph is rotated to the chord orientation across its
 * own advance — identical to Konva.TextPath's per-glyph placement.
 * Returns every glyph (including empty outlines such as spaces).
 */
export function curvedGlyphRawPlacements(
  font: Font,
  curve: NonNullable<TextObject["curve"]>,
  text: string,
  scale: number,
  letterSpacingMm: number,
): CurvedGlyphRaw[] {
  const singleLine = text.replace(/\s*\n\s*/g, " ");
  const run = layoutRun(font, singleLine, scale, letterSpacingMm);
  if (run.glyphs.length === 0) return [];

  const r = curve.radiusMm;
  const degPerMm = 180 / (Math.PI * r);
  const up = curve.direction === "up";
  const apexDeg = up ? 270 : 90;
  const startDeg = up
    ? apexDeg - (run.widthMm / 2) * degPerMm
    : apexDeg + (run.widthMm / 2) * degPerMm;

  const placements: CurvedGlyphRaw[] = [];
  let distMm = 0;
  for (let i = 0; i < run.glyphs.length; i++) {
    const g = run.glyphs[i]!;
    const advDeg = run.advancesMm[i]! * degPerMm;
    const penDeg = up ? startDeg + distMm * degPerMm : startDeg - distMm * degPerMm;
    const midDeg = up ? penDeg + advDeg / 2 : penDeg - advDeg / 2;
    const rotateDeg = (((up ? midDeg + 90 : midDeg - 90) % 360) + 360) % 360;

    const rad = (penDeg * Math.PI) / 180;
    placements.push({
      commands: g.commands,
      xOffset: g.xOffset,
      yOffset: g.yOffset,
      gxMm: r * Math.cos(rad),
      gyMm: r * Math.sin(rad),
      rotateDeg,
    });
    distMm += run.advancesMm[i]! + letterSpacingMm;
  }
  return placements;
}

export interface CurvedGlyphPlacement {
  /** Path data in glyph-local mm space (pen point at the origin). */
  d: string;
  gxMm: number;
  gyMm: number;
  rotateDeg: number;
}

/** Formatted variant used by the SVG serializer: skips empty outlines. */
export function curvedGlyphPlacements(
  font: Font,
  curve: NonNullable<TextObject["curve"]>,
  text: string,
  scale: number,
  letterSpacingMm: number,
): CurvedGlyphPlacement[] {
  const placements: CurvedGlyphPlacement[] = [];
  for (const g of curvedGlyphRawPlacements(font, curve, text, scale, letterSpacingMm)) {
    const d = glyphPathData(g.commands, scale, g.xOffset, -g.yOffset);
    if (!d) continue;
    placements.push({ d, gxMm: g.gxMm, gyMm: g.gyMm, rotateDeg: g.rotateDeg });
  }
  return placements;
}

// ---------------------------------------------------------------------------
// Shape vertices
// ---------------------------------------------------------------------------

/** Konva.RegularPolygon vertices: angle -90° + k·360°/sides, radius min(w,h)/2. */
export function polygonPointsMm(
  obj: Pick<PolygonObject, "widthMm" | "heightMm" | "sides">,
): { x: number; y: number }[] {
  const r = Math.min(obj.widthMm, obj.heightMm) / 2;
  const pts: { x: number; y: number }[] = [];
  for (let k = 0; k < obj.sides; k++) {
    const a = ((-90 + (k * 360) / obj.sides) * Math.PI) / 180;
    pts.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
  }
  return pts;
}

/** Konva.Star: 2·points vertices from -90°, alternating outer/inner radii. */
export function starPointsMm(
  obj: Pick<StarObject, "widthMm" | "heightMm" | "points" | "innerRatio">,
): { x: number; y: number }[] {
  const outer = Math.min(obj.widthMm, obj.heightMm) / 2;
  const inner = outer * obj.innerRatio;
  const pts: { x: number; y: number }[] = [];
  for (let n = 0; n < obj.points * 2; n++) {
    const radius = n % 2 === 0 ? outer : inner;
    const a = ((-90 + (n * 180) / obj.points) * Math.PI) / 180;
    pts.push({ x: radius * Math.cos(a), y: radius * Math.sin(a) });
  }
  return pts;
}

/** Closed polygon path data from vertex points (3-decimal mm). */
export function pointsPathData(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  let d = `M${fmt(pts[0]!.x, 3)} ${fmt(pts[0]!.y, 3)}`;
  for (let i = 1; i < pts.length; i++) {
    d += `L${fmt(pts[i]!.x, 3)} ${fmt(pts[i]!.y, 3)}`;
  }
  return `${d}Z`;
}

/**
 * Rectangle path with optional rounded corners (arc commands — pdf-lib's
 * parser converts arcs to cubics). Center origin puts (0,0) at the rect
 * center; otherwise at the top-left corner.
 */
export function rectPathData(
  wMm: number,
  hMm: number,
  cornerRadiusMm: number,
  centerOrigin: boolean,
): string {
  const ox = centerOrigin ? -wMm / 2 : 0;
  const oy = centerOrigin ? -hMm / 2 : 0;
  const r = Math.min(Math.max(cornerRadiusMm, 0), Math.min(wMm, hMm) / 2);
  const n = (v: number) => fmt(v, 3);
  if (r <= 0) {
    return `M${n(ox)} ${n(oy)}H${n(ox + wMm)}V${n(oy + hMm)}H${n(ox)}Z`;
  }
  return (
    `M${n(ox + r)} ${n(oy)}` +
    `H${n(ox + wMm - r)}` +
    `A${n(r)} ${n(r)} 0 0 1 ${n(ox + wMm)} ${n(oy + r)}` +
    `V${n(oy + hMm - r)}` +
    `A${n(r)} ${n(r)} 0 0 1 ${n(ox + wMm - r)} ${n(oy + hMm)}` +
    `H${n(ox + r)}` +
    `A${n(r)} ${n(r)} 0 0 1 ${n(ox)} ${n(oy + hMm - r)}` +
    `V${n(oy + r)}` +
    `A${n(r)} ${n(r)} 0 0 1 ${n(ox + r)} ${n(oy)}Z`
  );
}

/** Ellipse path (center origin) via two arc commands. */
export function ellipsePathData(rxMm: number, ryMm: number): string {
  const n = (v: number) => fmt(v, 3);
  return (
    `M${n(-rxMm)} 0` +
    `A${n(rxMm)} ${n(ryMm)} 0 1 0 ${n(rxMm)} 0` +
    `A${n(rxMm)} ${n(ryMm)} 0 1 0 ${n(-rxMm)} 0Z`
  );
}

// ---------------------------------------------------------------------------
// QR modules
// ---------------------------------------------------------------------------

/**
 * Square QR modules as one path in unit-per-module space (top-left origin,
 * quiet zone offset baked in); horizontal runs of dark modules merge into
 * single subpaths.
 */
export function qrSquareRunsPathData(matrix: QrMatrix, quietModules: number): string {
  const q = quietModules;
  let d = "";
  for (let y = 0; y < matrix.size; y++) {
    let x = 0;
    while (x < matrix.size) {
      if (!matrix.get(x, y)) {
        x++;
        continue;
      }
      let len = 1;
      while (x + len < matrix.size && matrix.get(x + len, y)) len++;
      d += `M${x + q} ${y + q}h${len}v1h-${len}z`;
      x += len;
    }
  }
  return d;
}

/**
 * Rounded QR modules as one path in unit-per-module space: 0.9-unit rounded
 * rects (rx 0.3) inset 0.05 — the same geometry the SVG exporter emits as
 * individual <rect rx> elements.
 */
export function qrRoundedModulesPathData(matrix: QrMatrix, quietModules: number): string {
  const q = quietModules;
  const r = 0.3;
  const w = 0.9;
  const n = (v: number) => fmt(v, 2);
  let d = "";
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (!matrix.get(x, y)) continue;
      const ox = x + q + 0.05;
      const oy = y + q + 0.05;
      d +=
        `M${n(ox + r)} ${n(oy)}` +
        `h${n(w - 2 * r)}` +
        `a${n(r)} ${n(r)} 0 0 1 ${n(r)} ${n(r)}` +
        `v${n(w - 2 * r)}` +
        `a${n(r)} ${n(r)} 0 0 1 ${n(-r)} ${n(r)}` +
        `h${n(-(w - 2 * r))}` +
        `a${n(r)} ${n(r)} 0 0 1 ${n(-r)} ${n(-r)}` +
        `v${n(-(w - 2 * r))}` +
        `a${n(r)} ${n(r)} 0 0 1 ${n(r)} ${n(-r)}z`;
    }
  }
  return d;
}

/** Dot QR modules as one path: r=0.425 circles via two arcs per module. */
export function qrDotModulesPathData(matrix: QrMatrix, quietModules: number): string {
  const q = quietModules;
  const r = 0.425;
  const n = (v: number) => fmt(v, 3);
  let d = "";
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (!matrix.get(x, y)) continue;
      const cx = x + q + 0.5;
      const cy = y + q + 0.5;
      d +=
        `M${n(cx - r)} ${n(cy)}` +
        `A${n(r)} ${n(r)} 0 1 0 ${n(cx + r)} ${n(cy)}` +
        `A${n(r)} ${n(r)} 0 1 0 ${n(cx - r)} ${n(cy)}z`;
    }
  }
  return d;
}

// ---------------------------------------------------------------------------
// Barcode SVG parsing (bwip-js output)
// ---------------------------------------------------------------------------

export interface ParsedSvgPaths {
  viewBox: { minX: number; minY: number; width: number; height: number };
  paths: { d: string; fill?: string; stroke?: string; strokeWidth?: number }[];
}

/**
 * Parse bwip-js's machine-generated SVG (viewBox + <path> elements only)
 * into raw path data. Returns null when the output contains anything beyond
 * paths — the caller falls back to raster embedding rather than guessing.
 */
export function parseSvgPaths(svg: string): ParsedSvgPaths | null {
  const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
  if (!viewBoxMatch) return null;
  const [minX = 0, minY = 0, width = 1, height = 1] = viewBoxMatch[1]!
    .trim()
    .split(/\s+/)
    .map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;

  const openTagEnd = svg.indexOf(">");
  const closeTag = svg.lastIndexOf("</svg>");
  if (openTagEnd === -1 || closeTag === -1) return null;
  const content = svg.slice(openTagEnd + 1, closeTag);

  // Any non-path drawing element means we don't understand the output; a
  // transformed <g> would silently shift geometry, so it disqualifies too.
  const elementRe = /<([a-zA-Z][\w-]*)\b([^>]*)>/g;
  let el: RegExpExecArray | null;
  while ((el = elementRe.exec(content)) !== null) {
    const tag = el[1]!.toLowerCase();
    if (tag === "g") {
      if (/\btransform=/.test(el[2] ?? "")) return null;
      continue;
    }
    if (tag !== "path") return null;
  }

  const paths: ParsedSvgPaths["paths"] = [];
  const pathRe = /<path\b([^>]*)\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = pathRe.exec(content)) !== null) {
    const attrs = m[1]!;
    const dMatch = attrs.match(/\bd="([^"]+)"/);
    if (!dMatch) return null;
    const fill = attrs.match(/\bfill="([^"]+)"/)?.[1];
    const stroke = attrs.match(/\bstroke="([^"]+)"/)?.[1];
    const strokeWidthRaw = attrs.match(/\bstroke-width="([^"]+)"/)?.[1];
    const strokeWidth = strokeWidthRaw ? Number(strokeWidthRaw) : undefined;
    paths.push({
      d: dMatch[1]!,
      fill: fill && fill !== "none" ? fill : undefined,
      stroke: stroke && stroke !== "none" ? stroke : undefined,
      strokeWidth: Number.isFinite(strokeWidth) ? strokeWidth : undefined,
    });
  }
  if (paths.length === 0) return null;
  return { viewBox: { minX, minY, width, height }, paths };
}

/**
 * Map a bwip-js viewBox into the object's box (top-left origin): 1D codes
 * stretch to fill (same as the canvas renderer); Data Matrix keeps its square
 * aspect, centered. Mirrors the SVG exporter's transform math.
 */
export function barcodeBoxTransform(
  obj: Pick<BarcodeObject, "symbology" | "widthMm" | "heightMm">,
  vb: ParsedSvgPaths["viewBox"],
): { sx: number; sy: number; txMm: number; tyMm: number } {
  if (obj.symbology === "datamatrix") {
    const s = Math.min(obj.widthMm / vb.width, obj.heightMm / vb.height);
    return {
      sx: s,
      sy: s,
      txMm: (obj.widthMm - vb.width * s) / 2 - vb.minX * s,
      tyMm: (obj.heightMm - vb.height * s) / 2 - vb.minY * s,
    };
  }
  const sx = obj.widthMm / vb.width;
  const sy = obj.heightMm / vb.height;
  return { sx, sy, txMm: -vb.minX * sx, tyMm: -vb.minY * sy };
}
