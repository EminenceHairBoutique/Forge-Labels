import type { LabelDocument } from "@/lib/document/schema";
import { mmToPx } from "@/lib/geometry/units";
import { buildStage } from "@/lib/render/build-stage";
import { loadFontsForDocument } from "@/lib/fonts/registry";
import { planVectorDoc, type VectorRasterElement } from "./vector-doc";
import { createVectorLabelPdf, type VectorPdfEntry } from "./pdf-vector";
import { resolveDocumentImages } from "./raster";

/**
 * Browser orchestrator for the vector-art PDF: plans the document, renders
 * each raster-fallback element as a cropped PNG tile through the SAME Konva
 * pipeline as the raster exports (zero new coordinate math — gradients,
 * finishes, shadows, and image filters look exactly like the editor), then
 * hands everything to the pure PDF composer.
 */

export interface VectorPdfExportOptions {
  cropMarks: boolean;
  title?: string;
  /** Resolution for raster-fallback tiles (default 600). */
  tileDpi?: 300 | 600;
}

export interface VectorPdfExportResult {
  bytes: Uint8Array;
  warnings: string[];
  rasterizedCount: number;
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error("Canvas export failed"));
        return;
      }
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, "image/png");
  });
}

/**
 * Render a crop of the document (bleed-extended stage) to exact-pixel PNG
 * bytes. `objects` overrides the document's object list so a single element
 * renders in place; background drawing is caller-controlled.
 */
async function renderRegionPng(
  doc: LabelDocument,
  region: { x: number; y: number; width: number; height: number },
  options: { dpi: number; drawBackground: boolean; objects: LabelDocument["objects"] },
): Promise<Uint8Array> {
  const tileDoc: LabelDocument = {
    ...doc,
    background: options.drawBackground ? doc.background : { type: "none" },
    objects: options.objects,
  };
  const { images, release } = await resolveDocumentImages(tileDoc);
  const container = document.createElement("div");
  const built = buildStage(tileDoc, container, {
    includeBleed: true,
    clipToShape: false,
    drawBackground: options.drawBackground,
    images,
    dpi: options.dpi,
  });

  try {
    const b = doc.label.bleedMm;
    const pixelRatio = options.dpi / 25.4;
    const expectedW = Math.round(mmToPx(region.width, options.dpi));
    const expectedH = Math.round(mmToPx(region.height, options.dpi));

    // Stage origin is the bleed rect's top-left; region is in doc (trim) mm.
    let canvas = built.stage.toCanvas({
      x: region.x + b,
      y: region.y + b,
      width: region.width + 2 / pixelRatio,
      height: region.height + 2 / pixelRatio,
      pixelRatio,
    });

    if (canvas.width !== expectedW || canvas.height !== expectedH) {
      const exact = document.createElement("canvas");
      exact.width = expectedW;
      exact.height = expectedH;
      const ctx = exact.getContext("2d")!;
      ctx.drawImage(
        canvas,
        0,
        0,
        Math.min(canvas.width, expectedW),
        Math.min(canvas.height, expectedH),
        0,
        0,
        Math.min(canvas.width, expectedW),
        Math.min(canvas.height, expectedH),
      );
      canvas = exact;
    }
    return await canvasToPngBytes(canvas);
  } finally {
    built.destroy();
    release();
  }
}

export async function exportVectorPdf(
  doc: LabelDocument,
  options: VectorPdfExportOptions,
): Promise<VectorPdfExportResult> {
  const { ensureFinishesRegistered } = await import("@/lib/finishes");
  ensureFinishesRegistered();
  await loadFontsForDocument(doc);

  const dpi = options.tileDpi ?? 600;
  const plan = await planVectorDoc(doc);

  // Background tile (gradient/finish backgrounds have no vector form).
  let background: Parameters<typeof createVectorLabelPdf>[0]["background"];
  if (plan.background.kind === "raster") {
    const b = doc.label.bleedMm;
    const pngBytes = await renderRegionPng(
      doc,
      {
        x: -b,
        y: -b,
        width: doc.label.widthMm + 2 * b,
        height: doc.label.heightMm + 2 * b,
      },
      { dpi, drawBackground: true, objects: [] },
    );
    background = { kind: "raster", pngBytes };
  } else {
    background = plan.background;
  }

  // Raster tiles render sequentially (one transient stage at a time), then
  // slot back into the plan's z-order.
  const entries: VectorPdfEntry[] = [];
  let rasterizedCount = 0;
  for (const element of plan.elements) {
    if (element.kind === "path") {
      entries.push({ element: { kind: "path", path: element } });
      continue;
    }
    rasterizedCount += 1;
    const raster = element as VectorRasterElement;
    const pngBytes = await renderRegionPng(doc, raster.aabbMm, {
      dpi,
      drawBackground: false,
      objects: raster.objects,
    });
    entries.push({
      element: { kind: "raster", aabbMm: raster.aabbMm, pngBytes },
    });
  }

  const bytes = await createVectorLabelPdf({
    widthMm: doc.label.widthMm,
    heightMm: doc.label.heightMm,
    bleedMm: doc.label.bleedMm,
    cropMarks: options.cropMarks,
    title: options.title,
    background,
    entries,
  });

  return { bytes, warnings: plan.warnings, rasterizedCount };
}
