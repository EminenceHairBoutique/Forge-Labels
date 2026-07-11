import type { Fill, Shadow, Stroke } from "@/lib/document/schema";
import { fontPtToMm } from "@/lib/geometry/units";

/**
 * Fill/stroke/shadow → Konva props, resolved in the object's LOCAL
 * coordinate space (0..width, 0..height in mm). Used identically by the
 * editor nodes and the offscreen export builder.
 */

export interface KonvaFillProps {
  fill?: string;
  fillLinearGradientStartPoint?: { x: number; y: number };
  fillLinearGradientEndPoint?: { x: number; y: number };
  fillLinearGradientColorStops?: (number | string)[];
  fillRadialGradientStartPoint?: { x: number; y: number };
  fillRadialGradientEndPoint?: { x: number; y: number };
  fillRadialGradientStartRadius?: number;
  fillRadialGradientEndRadius?: number;
  fillRadialGradientColorStops?: (number | string)[];
  // Konva's .d.ts narrows this to HTMLImageElement, but the runtime accepts
  // any CanvasImageSource (it feeds ctx.createPattern). We pass canvases.
  fillPatternImage?: HTMLImageElement;
  fillPatternScaleX?: number;
  fillPatternScaleY?: number;
  fillPatternRotation?: number;
  fillPatternRepeat?: string;
  fillPriority?: string;
}

export interface FinishPattern {
  image: CanvasImageSource;
  /** Pattern raster density so fills can map pixels back to millimeters. */
  pxPerMm: number;
}

export interface FinishPatternResolver {
  (fill: Extract<Fill, { type: "finish" }>, size: { width: number; height: number }):
    | FinishPattern
    | null;
}

let finishResolver: FinishPatternResolver | null = null;

/** lib/finishes registers its pattern generator here (avoids a cycle). */
export function registerFinishResolver(resolver: FinishPatternResolver): void {
  finishResolver = resolver;
}

export function fillToKonvaProps(
  fill: Fill | undefined,
  size: { width: number; height: number },
): KonvaFillProps {
  if (!fill || fill.type === "none") return {};

  switch (fill.type) {
    case "solid":
      return { fill: fill.color };

    case "linear-gradient": {
      const rad = ((fill.angleDeg - 90) * Math.PI) / 180; // 0° = up (CSS-like)
      const dirX = Math.cos(rad);
      const dirY = Math.sin(rad);
      const cx = size.width / 2;
      const cy = size.height / 2;
      const half =
        (Math.abs(dirX) * size.width + Math.abs(dirY) * size.height) / 2;
      return {
        fillLinearGradientStartPoint: { x: cx - dirX * half, y: cy - dirY * half },
        fillLinearGradientEndPoint: { x: cx + dirX * half, y: cy + dirY * half },
        fillLinearGradientColorStops: fill.stops.flatMap((s) => [s.offset, s.color]),
      };
    }

    case "radial-gradient": {
      const cx = size.width / 2;
      const cy = size.height / 2;
      const r = Math.max(size.width, size.height) / 2;
      return {
        fillRadialGradientStartPoint: { x: cx, y: cy },
        fillRadialGradientEndPoint: { x: cx, y: cy },
        fillRadialGradientStartRadius: 0,
        fillRadialGradientEndRadius: r,
        fillRadialGradientColorStops: fill.stops.flatMap((s) => [s.offset, s.color]),
      };
    }

    case "finish": {
      const pattern = finishResolver?.(fill, size);
      if (!pattern) {
        // Finishes engine not loaded (or unknown finish) — neutral fallback.
        return { fill: "#c8c8cc" };
      }
      // Map the tile's pixels onto millimeters; `scale` stretches the motif.
      const patternScale = fill.scale / pattern.pxPerMm;
      return {
        fillPatternImage: pattern.image as HTMLImageElement,
        fillPatternRepeat: "repeat",
        fillPatternScaleX: patternScale,
        fillPatternScaleY: patternScale,
        fillPatternRotation: fill.angleDeg,
        fillPriority: "pattern",
      };
    }
  }
}

export function strokeToKonvaProps(stroke: Stroke | undefined): {
  stroke?: string;
  strokeWidth?: number;
  dash?: number[];
} {
  if (!stroke || stroke.widthPt <= 0) return {};
  return {
    stroke: stroke.color,
    strokeWidth: fontPtToMm(stroke.widthPt),
    ...(stroke.dash && stroke.dash.length > 0
      ? { dash: stroke.dash.map((d) => fontPtToMm(d)) }
      : {}),
  };
}

export function shadowToKonvaProps(shadow: Shadow | undefined): {
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
} {
  if (!shadow) return {};
  return {
    shadowColor: shadow.color,
    shadowBlur: fontPtToMm(shadow.blurPt),
    shadowOffsetX: fontPtToMm(shadow.offsetXPt),
    shadowOffsetY: fontPtToMm(shadow.offsetYPt),
    shadowOpacity: shadow.opacity,
  };
}
