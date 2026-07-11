import QRCode from "qrcode";
import type { QrObject } from "@/lib/document/schema";

/**
 * QR generation. The matrix comes from the `qrcode` package; module drawing
 * is ours so square/rounded/dot styles, quiet zones, logo knockouts, and
 * vector export all share one geometry.
 */

export interface QrMatrix {
  size: number;
  get(x: number, y: number): boolean;
}

export function createQrMatrix(
  value: string,
  ecLevel: QrObject["ecLevel"],
): QrMatrix {
  const qr = QRCode.create(value || " ", { errorCorrectionLevel: ecLevel });
  const size = qr.modules.size;
  const data = qr.modules.data;
  return {
    size,
    get: (x, y) => data[y * size + x] === 1,
  };
}

/** Total module count per edge including the quiet zone. */
export function qrTotalModules(matrix: QrMatrix, quietModules: number): number {
  return matrix.size + 2 * quietModules;
}

/**
 * Minimum printed module size for reliable scanning (rule of thumb for
 * retail scanners/phones; preflight warns below this).
 */
export const MIN_QR_MODULE_MM = 0.4;

export interface QrRenderOptions {
  /** Target edge length in pixels for the generated canvas. */
  targetPx: number;
  logoImage?: CanvasImageSource;
}

/** True if the module falls inside the central logo knockout square. */
function inLogoArea(
  x: number,
  y: number,
  size: number,
  logoRatio: number | null,
): boolean {
  if (logoRatio === null) return false;
  const span = Math.ceil(size * logoRatio);
  const start = Math.floor((size - span) / 2);
  return x >= start && x < start + span && y >= start && y < start + span;
}

export function renderQrToCanvas(
  obj: QrObject,
  options: QrRenderOptions,
): HTMLCanvasElement {
  const matrix = createQrMatrix(obj.value, obj.ecLevel);
  const total = qrTotalModules(matrix, obj.quietModules);
  const modulePx = Math.max(Math.ceil(options.targetPx / total), 1);
  const edge = modulePx * total;

  const canvas = document.createElement("canvas");
  canvas.width = edge;
  canvas.height = edge;
  const ctx = canvas.getContext("2d")!;

  if (obj.bgColor) {
    ctx.fillStyle = obj.bgColor;
    ctx.fillRect(0, 0, edge, edge);
  }

  const logoRatio = obj.logo && options.logoImage ? obj.logo.sizeRatio : null;

  ctx.fillStyle = obj.fgColor;
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (!matrix.get(x, y)) continue;
      if (inLogoArea(x, y, matrix.size, logoRatio)) continue;
      const px = (x + obj.quietModules) * modulePx;
      const py = (y + obj.quietModules) * modulePx;
      switch (obj.moduleShape) {
        case "square":
          ctx.fillRect(px, py, modulePx, modulePx);
          break;
        case "rounded": {
          const r = modulePx * 0.3;
          ctx.beginPath();
          ctx.roundRect(px + 0.5, py + 0.5, modulePx - 1, modulePx - 1, r);
          ctx.fill();
          break;
        }
        case "dot": {
          ctx.beginPath();
          ctx.arc(
            px + modulePx / 2,
            py + modulePx / 2,
            (modulePx / 2) * 0.85,
            0,
            Math.PI * 2,
          );
          ctx.fill();
          break;
        }
      }
    }
  }

  if (obj.logo && options.logoImage) {
    const logoSpan = Math.ceil(matrix.size * obj.logo.sizeRatio) * modulePx;
    const start = (edge - logoSpan) / 2;
    ctx.drawImage(options.logoImage, start, start, logoSpan, logoSpan);
  }

  return canvas;
}

/** Printed module size in mm for a QR object (drives scannability checks). */
export function qrModuleSizeMm(obj: QrObject): number {
  const matrix = createQrMatrix(obj.value, obj.ecLevel);
  return obj.widthMm / qrTotalModules(matrix, obj.quietModules);
}
