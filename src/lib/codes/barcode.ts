import bwipjs from "bwip-js/browser";
import type { BarcodeObject } from "@/lib/document/schema";
import { validateBarcodeValue } from "./validate";

/** bwip-js symbology ids for our supported formats. */
const BCID: Record<BarcodeObject["symbology"], string> = {
  code128: "code128",
  code39: "code39",
  ean13: "ean13",
  upca: "upca",
  datamatrix: "datamatrix",
};

function stripHash(color: string): string {
  return color.replace("#", "");
}

/**
 * Render a barcode to a canvas at roughly `targetPx` width. Throws with a
 * friendly message when the payload is invalid for the symbology.
 */
export function renderBarcodeToCanvas(
  obj: BarcodeObject,
  options: { targetPx: number },
): HTMLCanvasElement {
  const validation = validateBarcodeValue(obj.symbology, obj.value);
  if (!validation.ok) {
    throw new Error(validation.message ?? "Invalid barcode value");
  }

  const canvas = document.createElement("canvas");
  // bwip-js `scale` multiplies its base pixel raster; base 1D module ≈ 2px.
  const scale = Math.max(Math.min(Math.ceil(options.targetPx / 200), 16), 2);
  const isMatrix = obj.symbology === "datamatrix";

  bwipjs.toCanvas(canvas, {
    bcid: BCID[obj.symbology],
    text: validation.normalized ?? obj.value,
    scale,
    ...(isMatrix
      ? {}
      : {
          height: 12, // bar height in mm at scale 1; box fit stretches later
          includetext: obj.showText,
          textxalign: "center" as const,
        }),
    barcolor: stripHash(obj.fgColor),
    ...(obj.bgColor ? { backgroundcolor: stripHash(obj.bgColor) } : {}),
    paddingwidth: 2,
    paddingheight: 2,
  });

  return canvas;
}

/**
 * Preferred aspect ratio (w/h) for the symbology, used when the user resets
 * proportions. 1D codes stretch freely; Data Matrix must stay square.
 */
export function barcodeAspect(obj: BarcodeObject): number | null {
  return obj.symbology === "datamatrix" ? 1 : null;
}
