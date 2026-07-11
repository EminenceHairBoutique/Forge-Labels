import type { LabelDocument, LabelObject } from "@/lib/document/schema";

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

/** Axis-aligned bounding box of a (possibly rotated) object, in mm. */
export function objectAabb(obj: LabelObject): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
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
