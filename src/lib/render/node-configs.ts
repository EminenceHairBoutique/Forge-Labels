import type {
  BarcodeObject,
  EllipseObject,
  ImageObject,
  LineObject,
  PolygonObject,
  QrObject,
  RectObject,
  StarObject,
  TextObject,
} from "@/lib/document/schema";
import { fontPtToMm } from "@/lib/geometry/units";
import { fontCssFamily } from "@/lib/fonts/registry";
import { baseNodeProps } from "./geometry";
import { fillToKonvaProps, shadowToKonvaProps, strokeToKonvaProps } from "./fills";

/**
 * Object → Konva node config. These configs are spread onto react-konva
 * elements by the editor AND onto plain Konva nodes by the offscreen export
 * builder — one mapping, no drift.
 */

export function applyTextTransform(
  text: string,
  transform: TextObject["textTransform"],
): string {
  switch (transform) {
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    default:
      return text;
  }
}

export function textNodeConfig(obj: TextObject) {
  const fontSizeMm = fontPtToMm(obj.fontSizePt);
  const size = { width: obj.widthMm, height: obj.heightMm };
  return {
    ...baseNodeProps(obj),
    // Height is intentionally omitted: Konva auto-sizes text vertically and
    // the editor keeps obj.heightMm in sync via measureTextHeightMm.
    height: undefined as number | undefined,
    text: applyTextTransform(obj.text, obj.textTransform),
    fontFamily: fontCssFamily(obj.fontFamilyId),
    fontStyle: String(obj.fontWeight),
    fontSize: fontSizeMm,
    lineHeight: obj.lineHeight,
    letterSpacing: obj.letterSpacingEm * fontSizeMm,
    align: obj.align,
    wrap: "word" as const,
    ...fillToKonvaProps(obj.fill, size),
    ...strokeToKonvaProps(obj.stroke),
    fillAfterStrokeEnabled: true,
    ...shadowToKonvaProps(obj.shadow),
  };
}

export function rectNodeConfig(obj: RectObject) {
  const size = { width: obj.widthMm, height: obj.heightMm };
  return {
    ...baseNodeProps(obj),
    cornerRadius: obj.cornerRadiusMm,
    ...fillToKonvaProps(obj.fill, size),
    ...strokeToKonvaProps(obj.stroke),
    ...shadowToKonvaProps(obj.shadow),
  };
}

/** Ellipse is natively center-origin in Konva — no offset needed. */
export function ellipseNodeConfig(obj: EllipseObject) {
  const size = { width: obj.widthMm, height: obj.heightMm };
  return {
    id: obj.id,
    x: obj.xMm,
    y: obj.yMm,
    radiusX: obj.widthMm / 2,
    radiusY: obj.heightMm / 2,
    rotation: obj.rotationDeg,
    opacity: obj.opacity,
    visible: obj.visible,
    ...fillToKonvaProps(obj.fill, size),
    ...strokeToKonvaProps(obj.stroke),
    ...shadowToKonvaProps(obj.shadow),
  };
}

export function lineNodeConfig(obj: LineObject) {
  const strokeWidthMm = fontPtToMm(obj.strokePt);
  return {
    id: obj.id,
    x: obj.xMm,
    y: obj.yMm,
    offsetX: obj.widthMm / 2,
    offsetY: 0,
    points: [0, 0, obj.widthMm, 0],
    stroke: obj.color,
    strokeWidth: strokeWidthMm,
    ...(obj.dash && obj.dash.length > 0
      ? { dash: obj.dash.map((d) => fontPtToMm(d)) }
      : {}),
    lineCap: obj.cap,
    rotation: obj.rotationDeg,
    opacity: obj.opacity,
    visible: obj.visible,
    hitStrokeWidth: Math.max(strokeWidthMm, 3),
  };
}

/** Regular polygons/stars are center-origin and equilateral (radius-based). */
export function polygonNodeConfig(obj: PolygonObject) {
  const size = { width: obj.widthMm, height: obj.heightMm };
  return {
    id: obj.id,
    x: obj.xMm,
    y: obj.yMm,
    sides: obj.sides,
    radius: Math.min(obj.widthMm, obj.heightMm) / 2,
    rotation: obj.rotationDeg,
    opacity: obj.opacity,
    visible: obj.visible,
    ...fillToKonvaProps(obj.fill, size),
    ...strokeToKonvaProps(obj.stroke),
    ...shadowToKonvaProps(obj.shadow),
  };
}

export function starNodeConfig(obj: StarObject) {
  const size = { width: obj.widthMm, height: obj.heightMm };
  const outer = Math.min(obj.widthMm, obj.heightMm) / 2;
  return {
    id: obj.id,
    x: obj.xMm,
    y: obj.yMm,
    numPoints: obj.points,
    outerRadius: outer,
    innerRadius: outer * obj.innerRatio,
    rotation: obj.rotationDeg,
    opacity: obj.opacity,
    visible: obj.visible,
    ...fillToKonvaProps(obj.fill, size),
    ...strokeToKonvaProps(obj.stroke),
    ...shadowToKonvaProps(obj.shadow),
  };
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

export interface ImageLayout {
  /** Source crop in natural pixels. */
  crop: { x: number; y: number; width: number; height: number };
  /** Draw rect in mm, relative to the object's top-left corner. */
  dxMm: number;
  dyMm: number;
  drawWidthMm: number;
  drawHeightMm: number;
}

/**
 * Resolve fit/crop into a source-pixel crop + a draw rect inside the box.
 * The object renders as a Group (rotation about box center) containing a
 * Konva.Image at the draw rect.
 */
export function resolveImageLayout(obj: ImageObject): ImageLayout {
  const cropNorm = obj.crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const srcX = cropNorm.x * obj.naturalWidthPx;
  const srcY = cropNorm.y * obj.naturalHeightPx;
  const srcW = Math.max(cropNorm.width * obj.naturalWidthPx, 1);
  const srcH = Math.max(cropNorm.height * obj.naturalHeightPx, 1);

  const boxW = obj.widthMm;
  const boxH = obj.heightMm;
  const boxAspect = boxW / boxH;
  const srcAspect = srcW / srcH;

  switch (obj.fit) {
    case "fill":
      return {
        crop: { x: srcX, y: srcY, width: srcW, height: srcH },
        dxMm: 0,
        dyMm: 0,
        drawWidthMm: boxW,
        drawHeightMm: boxH,
      };
    case "cover": {
      // Trim the source to the box aspect, centered.
      let cw = srcW;
      let ch = srcH;
      if (srcAspect > boxAspect) {
        cw = srcH * boxAspect;
      } else {
        ch = srcW / boxAspect;
      }
      return {
        crop: {
          x: srcX + (srcW - cw) / 2,
          y: srcY + (srcH - ch) / 2,
          width: cw,
          height: ch,
        },
        dxMm: 0,
        dyMm: 0,
        drawWidthMm: boxW,
        drawHeightMm: boxH,
      };
    }
    case "contain": {
      let dw = boxW;
      let dh = boxH;
      if (srcAspect > boxAspect) {
        dh = boxW / srcAspect;
      } else {
        dw = boxH * srcAspect;
      }
      return {
        crop: { x: srcX, y: srcY, width: srcW, height: srcH },
        dxMm: (boxW - dw) / 2,
        dyMm: (boxH - dh) / 2,
        drawWidthMm: dw,
        drawHeightMm: dh,
      };
    }
  }
}

export function imageGroupConfig(obj: ImageObject) {
  return baseNodeProps(obj);
}

export function imageNodeConfig(
  obj: ImageObject,
  image: CanvasImageSource | undefined,
) {
  const layout = resolveImageLayout(obj);
  return {
    image,
    x: layout.dxMm + (obj.flipX ? layout.drawWidthMm : 0),
    y: layout.dyMm + (obj.flipY ? layout.drawHeightMm : 0),
    width: layout.drawWidthMm,
    height: layout.drawHeightMm,
    scaleX: obj.flipX ? -1 : 1,
    scaleY: obj.flipY ? -1 : 1,
    crop: layout.crop,
    ...shadowToKonvaProps(obj.shadow),
    listening: false,
  };
}

// ---------------------------------------------------------------------------
// Codes (rendered via generated offscreen canvases — see lib/codes)
// ---------------------------------------------------------------------------

export function codeGroupConfig(obj: QrObject | BarcodeObject) {
  return baseNodeProps(obj);
}
