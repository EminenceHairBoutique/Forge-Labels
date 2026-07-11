import Konva from "konva";
import type {
  Background,
  LabelDocument,
  LabelObject,
} from "@/lib/document/schema";
import { renderQrToCanvas } from "@/lib/codes/qr";
import { renderBarcodeToCanvas } from "@/lib/codes/barcode";
import { mmToPx } from "@/lib/geometry/units";
import { fillToKonvaProps } from "./fills";
import {
  codeGroupConfig,
  ellipseNodeConfig,
  imageGroupConfig,
  imageNodeConfig,
  lineNodeConfig,
  polygonNodeConfig,
  rectNodeConfig,
  starNodeConfig,
  textNodeConfig,
  textPathNodeConfig,
} from "./node-configs";

/**
 * Offscreen document renderer (plain Konva, no React). This is the SAME
 * mapping the editor uses (shared node configs), assembled into a detached
 * stage for raster export and the 3D mockup texture.
 *
 * Stage units are millimeters; callers export with
 * `stage.toCanvas({ pixelRatio: dpi / 25.4 })` for DPI-exact output.
 */

export interface BuildStageOptions {
  /** Include the bleed area (print) or crop to the trim (sticker preview). */
  includeBleed: boolean;
  /** Clip to the label's die-cut shape (rounded rect / circle). */
  clipToShape: boolean;
  /** Draw the document background (false = fully transparent artwork). */
  drawBackground: boolean;
  /** Resolved images keyed by object id (image objects + QR logos). */
  images: Map<string, CanvasImageSource>;
  /** Target DPI hint so code canvases are generated at exact resolution. */
  dpi: number;
}

export interface BuiltStage {
  stage: Konva.Stage;
  widthMm: number;
  heightMm: number;
  destroy(): void;
}

function backgroundFillProps(
  background: Background,
  size: { width: number; height: number },
) {
  switch (background.type) {
    case "none":
      return null;
    case "solid":
      return fillToKonvaProps({ type: "solid", color: background.color }, size);
    case "linear-gradient":
      return fillToKonvaProps(
        { type: "linear-gradient", angleDeg: background.angleDeg, stops: background.stops },
        size,
      );
    case "finish":
      return fillToKonvaProps(
        {
          type: "finish",
          finishId: background.finishId,
          intensity: background.intensity,
          scale: background.scale,
          angleDeg: background.angleDeg,
        },
        size,
      );
  }
}

export function buildObjectNode(
  obj: LabelObject,
  options: Pick<BuildStageOptions, "images" | "dpi">,
): Konva.Shape | Konva.Group | null {
  switch (obj.type) {
    case "text":
      return obj.curve
        ? new Konva.TextPath(textPathNodeConfig(obj))
        : new Konva.Text(textNodeConfig(obj));
    case "rect":
      return new Konva.Rect(rectNodeConfig(obj));
    case "ellipse":
      return new Konva.Ellipse(ellipseNodeConfig(obj));
    case "line":
      return new Konva.Line(lineNodeConfig(obj));
    case "polygon":
      return new Konva.RegularPolygon(polygonNodeConfig(obj));
    case "star":
      return new Konva.Star(starNodeConfig(obj));
    case "image": {
      const group = new Konva.Group(imageGroupConfig(obj));
      const image = options.images.get(obj.id);
      group.add(new Konva.Image(imageNodeConfig(obj, image)));
      return group;
    }
    case "qrcode": {
      const group = new Konva.Group(codeGroupConfig(obj));
      const targetPx = Math.max(mmToPx(obj.widthMm, options.dpi), 64);
      const canvas = renderQrToCanvas(obj, {
        targetPx,
        logoImage: options.images.get(`${obj.id}:logo`),
      });
      group.add(
        new Konva.Image({
          image: canvas,
          width: obj.widthMm,
          height: obj.heightMm,
          listening: false,
        }),
      );
      return group;
    }
    case "barcode": {
      const group = new Konva.Group(codeGroupConfig(obj));
      let canvas: HTMLCanvasElement;
      try {
        canvas = renderBarcodeToCanvas(obj, {
          targetPx: Math.max(mmToPx(obj.widthMm, options.dpi), 128),
        });
      } catch {
        // Invalid payload: render a hatched placeholder instead of crashing;
        // the editor UI surfaces the validation error next to the input.
        const placeholder = new Konva.Rect({
          width: obj.widthMm,
          height: obj.heightMm,
          stroke: "#b91c1c",
          strokeWidth: 0.3,
          dash: [1.5, 1],
        });
        group.add(placeholder);
        return group;
      }
      group.add(
        new Konva.Image({
          image: canvas,
          width: obj.widthMm,
          height: obj.heightMm,
          listening: false,
        }),
      );
      return group;
    }
    case "group": {
      const group = new Konva.Group({
        id: obj.id,
        x: obj.xMm,
        y: obj.yMm,
        offsetX: obj.widthMm / 2,
        offsetY: obj.heightMm / 2,
        rotation: obj.rotationDeg,
        opacity: obj.opacity,
        visible: obj.visible,
      });
      for (const child of obj.children) {
        const node = buildObjectNode(child, options);
        if (node) group.add(node);
      }
      return group;
    }
  }
}

function clipLabelShape(
  ctx: CanvasRenderingContext2D,
  doc: LabelDocument,
  expandMm: number,
): void {
  const w = doc.label.widthMm + 2 * expandMm;
  const h = doc.label.heightMm + 2 * expandMm;
  const x = -expandMm;
  const y = -expandMm;
  ctx.beginPath();
  if (doc.label.shape === "circle") {
    ctx.arc(
      doc.label.widthMm / 2,
      doc.label.heightMm / 2,
      Math.max(w, h) / 2,
      0,
      Math.PI * 2,
    );
  } else {
    const r = Math.min(doc.label.cornerRadiusMm + expandMm, Math.min(w, h) / 2);
    if (r > 0.01) {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.rect(x, y, w, h);
    }
  }
  ctx.closePath();
}

export function buildStage(
  doc: LabelDocument,
  container: HTMLDivElement,
  options: BuildStageOptions,
): BuiltStage {
  const bleed = options.includeBleed ? doc.label.bleedMm : 0;
  const widthMm = doc.label.widthMm + 2 * bleed;
  const heightMm = doc.label.heightMm + 2 * bleed;

  const stage = new Konva.Stage({
    container,
    width: widthMm,
    height: heightMm,
  });

  const layer = new Konva.Layer({
    // Shift so document coordinates (trim origin) land inside the bleed.
    x: bleed,
    y: bleed,
  });

  if (options.clipToShape) {
    layer.clipFunc((ctx) => clipLabelShape(ctx, doc, bleed));
  }

  if (options.drawBackground) {
    const size = { width: widthMm, height: heightMm };
    const fillProps = backgroundFillProps(doc.background, size);
    if (fillProps) {
      layer.add(
        new Konva.Rect({
          x: -bleed - 0.05,
          y: -bleed - 0.05,
          width: widthMm + 0.1,
          height: heightMm + 0.1,
          ...fillProps,
          listening: false,
        }),
      );
    }
  }

  for (const obj of doc.objects) {
    const node = buildObjectNode(obj, options);
    if (node) layer.add(node);
  }

  stage.add(layer);
  layer.draw();

  return {
    stage,
    widthMm,
    heightMm,
    destroy: () => {
      stage.destroy();
    },
  };
}
