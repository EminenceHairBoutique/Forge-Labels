import type { LabelDocument, LabelObject } from "@/lib/document/schema";
import { loadFontsForDocument } from "@/lib/fonts/registry";
import { mmToPx } from "@/lib/geometry/units";
import { buildStage } from "@/lib/render/build-stage";
import { applyImageFilters } from "@/lib/render/image-filters";
import { getStorageAdapter } from "@/lib/storage";
import { setPngDpi } from "./png-dpi";

/**
 * DPI-exact raster export (browser only). Renders the document through the
 * same Konva mapping the editor uses, on a detached stage, at
 * pixelRatio = dpi / 25.4 — so output pixels are mm-exact by construction.
 */

export interface RasterExportOptions {
  dpi: number;
  /**
   * print: include bleed, opaque background (for PDFs and print files).
   * sticker: trim only, die-cut shape clip, honors transparent background.
   */
  mode: "print" | "sticker";
  format: "png" | "jpg";
  /** JPG quality 0–1. */
  quality?: number;
}

export interface RasterResult {
  blob: Blob;
  widthPx: number;
  heightPx: number;
  widthMm: number;
  heightMm: number;
}

/** Resolve every image referenced by the document into drawable sources. */
export async function resolveDocumentImages(
  doc: LabelDocument,
): Promise<{ images: Map<string, CanvasImageSource>; release(): void }> {
  const images = new Map<string, CanvasImageSource>();
  const urls: string[] = [];
  const adapter = getStorageAdapter();

  async function loadFrom(
    key: string,
    source: { kind: "asset"; assetId: string } | { kind: "url"; url: string },
  ): Promise<void> {
    try {
      let blob: Blob | null = null;
      if (source.kind === "asset") {
        blob = await adapter.getAssetBlob(source.assetId);
      } else {
        const res = await fetch(source.url);
        if (res.ok) blob = await res.blob();
      }
      if (!blob) return;

      if (blob.type === "image/svg+xml") {
        // SVG needs an <img> with explicit dimensions for canvas drawing.
        const url = URL.createObjectURL(blob);
        urls.push(url);
        const img = new Image();
        img.decoding = "async";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("SVG failed to load"));
          img.src = url;
        });
        images.set(key, img);
      } else {
        images.set(key, await createImageBitmap(blob));
      }
    } catch {
      // Missing image: the object renders empty; preflight reports it.
    }
  }

  const jobs: Promise<void>[] = [];
  const walk = (objects: LabelObject[]) => {
    for (const obj of objects) {
      if (obj.type === "image") {
        jobs.push(
          loadFrom(obj.id, obj.source).then(() => {
            // Bake the object's filter settings — same function the editor
            // uses, so exports match the screen.
            const src = images.get(obj.id);
            if (src) images.set(obj.id, applyImageFilters(src, obj.filters));
          }),
        );
      }
      if (obj.type === "qrcode" && obj.logo) {
        jobs.push(loadFrom(`${obj.id}:logo`, obj.logo.source));
      }
      if (obj.type === "group") walk(obj.children);
    }
  };
  walk(doc.objects);
  await Promise.all(jobs);

  return {
    images,
    release: () => {
      for (const url of urls) URL.revokeObjectURL(url);
      for (const source of images.values()) {
        if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
          source.close();
        }
      }
    },
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas export failed"))),
      type,
      quality,
    );
  });
}

export async function exportRaster(
  doc: LabelDocument,
  options: RasterExportOptions,
): Promise<RasterResult> {
  await loadFontsForDocument(doc);
  const { images, release } = await resolveDocumentImages(doc);

  const container = document.createElement("div");
  const built = buildStage(doc, container, {
    includeBleed: options.mode === "print",
    clipToShape: options.mode === "sticker",
    drawBackground: true,
    images,
    dpi: options.dpi,
  });

  try {
    const pixelRatio = options.dpi / 25.4;
    const expectedW = Math.round(mmToPx(built.widthMm, options.dpi));
    const expectedH = Math.round(mmToPx(built.heightMm, options.dpi));

    let canvas = built.stage.toCanvas({ pixelRatio });

    // Konva rounds stage px independently; enforce the exact target size.
    if (canvas.width !== expectedW || canvas.height !== expectedH) {
      const exact = document.createElement("canvas");
      exact.width = expectedW;
      exact.height = expectedH;
      const ctx = exact.getContext("2d")!;
      ctx.drawImage(canvas, 0, 0, expectedW, expectedH);
      canvas = exact;
    }

    if (options.format === "jpg") {
      // JPG has no alpha: composite over white.
      const flat = document.createElement("canvas");
      flat.width = canvas.width;
      flat.height = canvas.height;
      const ctx = flat.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, flat.width, flat.height);
      ctx.drawImage(canvas, 0, 0);
      const blob = await canvasToBlob(flat, "image/jpeg", options.quality ?? 0.92);
      return {
        blob,
        widthPx: flat.width,
        heightPx: flat.height,
        widthMm: built.widthMm,
        heightMm: built.heightMm,
      };
    }

    const pngBlob = await canvasToBlob(canvas, "image/png");
    const bytes = new Uint8Array(await pngBlob.arrayBuffer());
    const withDpi = setPngDpi(bytes, options.dpi);
    return {
      blob: new Blob([withDpi as BlobPart], { type: "image/png" }),
      widthPx: canvas.width,
      heightPx: canvas.height,
      widthMm: built.widthMm,
      heightMm: built.heightMm,
    };
  } finally {
    built.destroy();
    release();
  }
}

/**
 * Small raster for project thumbnails / mockup textures. Returns a data URL
 * (cheap to store alongside project metadata).
 */
export async function renderThumbnail(
  doc: LabelDocument,
  maxPx = 480,
): Promise<string> {
  await loadFontsForDocument(doc);
  const { images, release } = await resolveDocumentImages(doc);
  const container = document.createElement("div");
  const built = buildStage(doc, container, {
    includeBleed: false,
    clipToShape: true,
    drawBackground: true,
    images,
    dpi: 150,
  });
  try {
    const scale = maxPx / Math.max(built.widthMm, built.heightMm);
    return built.stage.toDataURL({ pixelRatio: scale, mimeType: "image/png" });
  } finally {
    built.destroy();
    release();
  }
}
