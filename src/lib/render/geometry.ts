import type { LabelDocument, LabelObject, TextObject } from "@/lib/document/schema";
import { fontPtToMm } from "@/lib/geometry/units";

/**
 * Geometry resolution shared by the interactive editor, the offscreen
 * exporter, and (later) the SVG/PDF serializers.
 *
 * Stage convention: 1 Konva unit = 1 mm. (0,0) = trim top-left. Objects are
 * positioned by CENTER (x/y) with offset = half size, so rotation is about
 * the center — identical everywhere.
 */

export interface BaseNodeProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  opacity: number;
  visible: boolean;
}

export function baseNodeProps(obj: LabelObject): BaseNodeProps {
  return {
    id: obj.id,
    x: obj.xMm,
    y: obj.yMm,
    width: obj.widthMm,
    height: obj.heightMm,
    offsetX: obj.widthMm / 2,
    offsetY: obj.heightMm / 2,
    rotation: obj.rotationDeg,
    opacity: obj.opacity,
    visible: obj.visible,
  };
}

/**
 * Single-line run length (mm) of a text object — the advance its glyphs
 * cover along one baseline. Average-advance estimate (wider for uppercase
 * runs, which have no narrow lowercase advances), deliberately erring
 * high so space reserved from it can only exceed the real ink.
 */
export function estimateRunLengthMm(obj: TextObject): number {
  const fontMm = fontPtToMm(obj.fontSizePt);
  const upper = obj.textTransform === "uppercase";
  const text = (upper ? obj.text.toUpperCase() : obj.text).replace(/\s*\n\s*/g, " ");
  const factor = upper || text === text.toUpperCase() ? 0.72 : 0.6;
  return [...text].length * fontMm * factor * (1 + (obj.letterSpacingEm ?? 0));
}

/**
 * Ink AABB of a CURVED text object (null without a curve). Glyph
 * baselines ride a circle of curve.radiusMm around the stored (xMm, yMm),
 * so the ink hangs off the arc apex — entirely above ("up") or below
 * ("down") the stored center — and the stored width/height are only a
 * selection aid. Everything that reasons about real bounds (preflight,
 * snapping, group bounds, layout panels, the Easy validator) shares this
 * one estimate.
 */
export function curvedInkBox(obj: TextObject): {
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  if (!obj.curve) return null;
  const fontMm = fontPtToMm(obj.fontSizePt);
  const ascentMm = fontMm * 0.8;
  const r = obj.curve.radiusMm;
  const half = Math.min(estimateRunLengthMm(obj) / r, Math.PI * 1.6) / 2;
  const inkHalfW =
    (r + ascentMm) * Math.sin(Math.min(half, Math.PI / 2)) + fontMm * 0.15;
  const bandMm = r * (1 - Math.cos(half)) + ascentMm + fontMm * 0.25;
  const top =
    obj.curve.direction === "up"
      ? obj.yMm - r - ascentMm
      : obj.yMm + r + ascentMm - bandMm;
  return { x: obj.xMm - inkHalfW, y: top, width: inkHalfW * 2, height: bandMm };
}

/** Axis-aligned bounding box of a (possibly rotated) object, in mm. */
export function objectAabb(obj: LabelObject): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (obj.type === "text" && obj.curve) {
    const ink = curvedInkBox(obj)!;
    if (obj.rotationDeg % 360 === 0) return ink;
    // Curved text rotates about the stored point (the arc center), not
    // the box center — rotate the ink corners and box the result.
    const rad = (obj.rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const xs: number[] = [];
    const ys: number[] = [];
    for (const [cx, cy] of [
      [ink.x, ink.y],
      [ink.x + ink.width, ink.y],
      [ink.x, ink.y + ink.height],
      [ink.x + ink.width, ink.y + ink.height],
    ]) {
      const dx = cx! - obj.xMm;
      const dy = cy! - obj.yMm;
      xs.push(obj.xMm + dx * cos - dy * sin);
      ys.push(obj.yMm + dx * sin + dy * cos);
    }
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  }
  const rad = (obj.rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const w = obj.widthMm * cos + obj.heightMm * sin;
  const h = obj.widthMm * sin + obj.heightMm * cos;
  return { x: obj.xMm - w / 2, y: obj.yMm - h / 2, width: w, height: h };
}

/** The artwork canvas rect including bleed, in trim coordinates. */
export function bleedRect(doc: LabelDocument): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const b = doc.label.bleedMm;
  return {
    x: -b,
    y: -b,
    width: doc.label.widthMm + 2 * b,
    height: doc.label.heightMm + 2 * b,
  };
}

export function safeRect(doc: LabelDocument): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const s = doc.label.safeMm;
  return {
    x: s,
    y: s,
    width: Math.max(doc.label.widthMm - 2 * s, 0),
    height: Math.max(doc.label.heightMm - 2 * s, 0),
  };
}
