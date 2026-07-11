import type { LabelDocument, LabelObject } from "@/lib/document/schema";
import { newObjectId } from "@/lib/document/ids";
import { roundMm } from "@/lib/geometry/units";

/**
 * Apply a template's design to a target document (typically sized for a
 * different vial). Objects scale uniformly about the label center so
 * proportions and alignment survive; font/stroke sizes scale with them.
 */

function scaleObject(obj: LabelObject, s: number, dx: number, dy: number): LabelObject {
  const base = {
    ...obj,
    id: newObjectId(),
    xMm: roundMm(obj.xMm * s + dx),
    yMm: roundMm(obj.yMm * s + dy),
    widthMm: Math.max(roundMm(obj.widthMm * s), 0.5),
    heightMm: Math.max(roundMm(obj.heightMm * s), 0.5),
  };

  switch (base.type) {
    case "text":
      return {
        ...base,
        fontSizePt: Math.max(base.fontSizePt * s, 1.5),
        stroke: base.stroke
          ? { ...base.stroke, widthPt: base.stroke.widthPt * s }
          : undefined,
        curve: base.curve
          ? { ...base.curve, radiusMm: base.curve.radiusMm * s }
          : undefined,
      };
    case "rect":
      return {
        ...base,
        cornerRadiusMm: base.cornerRadiusMm * s,
        stroke: base.stroke
          ? { ...base.stroke, widthPt: base.stroke.widthPt * s }
          : undefined,
      };
    case "line":
      return { ...base, strokePt: Math.max(base.strokePt * s, 0.25) };
    case "group":
      return {
        ...base,
        // Children live in group-local space: scale sizes but not the
        // group-relative translation origin.
        children: base.children.map((c) => scaleObject(c, s, 0, 0)),
      };
    default:
      return base;
  }
}

/**
 * Returns a copy of `target` carrying the template's background, substrate,
 * and objects rescaled from the template's label size to the target's.
 */
export function applyTemplate(
  target: LabelDocument,
  template: LabelDocument,
): LabelDocument {
  const srcW = template.label.widthMm;
  const srcH = template.label.heightMm;
  const dstW = target.label.widthMm;
  const dstH = target.label.heightMm;
  const s = Math.min(dstW / srcW, dstH / srcH);
  // Uniform scale about the label center.
  const dx = (dstW - srcW * s) / 2;
  const dy = (dstH - srcH * s) / 2;

  return {
    ...target,
    background: structuredClone(template.background),
    substrateId: template.substrateId,
    objects: template.objects.map((o) => scaleObject(structuredClone(o), s, dx, dy)),
  };
}
