"use client";

import DOMPurify from "dompurify";
import { getStorageAdapter } from "@/lib/storage";
import type { AssetRecord } from "@/lib/storage/types";

/**
 * Upload intake: type/size validation and SVG sanitization. SVGs are
 * sanitized at ingest (scripts/foreignObject/event handlers stripped) AND
 * only ever rendered through <img>/canvas — defense in depth against
 * SVG-borne XSS.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ACCEPTED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

export const UPLOAD_ACCEPT_ATTR = ".png,.jpg,.jpeg,.webp,.svg";

export interface PreparedUpload {
  asset: AssetRecord;
  naturalWidthPx: number;
  naturalHeightPx: number;
}

export class UploadError extends Error {}

async function sanitizeSvg(file: File): Promise<Blob> {
  const source = await file.text();
  const clean = DOMPurify.sanitize(source, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["script", "foreignObject", "iframe"],
    FORBID_ATTR: ["onload", "onerror", "onclick"],
  });
  if (!clean.includes("<svg")) {
    throw new UploadError("This SVG file couldn't be sanitized safely.");
  }
  return new Blob([clean], { type: "image/svg+xml" });
}

async function measureImage(blob: Blob): Promise<{ width: number; height: number }> {
  if (blob.type === "image/svg+xml") {
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new UploadError("SVG could not be decoded."));
        img.src = url;
      });
      // SVGs without intrinsic size decode as 0×0 or 300×150; give them a
      // usable design-space size.
      return {
        width: img.naturalWidth || 512,
        height: img.naturalHeight || 512,
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const bitmap = await createImageBitmap(blob);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

export async function prepareUpload(file: File): Promise<PreparedUpload> {
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new UploadError(
      "Unsupported format. Use PNG, JPG, WebP, or SVG images.",
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError("Images must be 10 MB or smaller.");
  }

  const blob = file.type === "image/svg+xml" ? await sanitizeSvg(file) : file;
  const { width, height } = await measureImage(blob);
  const asset = await getStorageAdapter().putAsset(blob, { name: file.name });
  return { asset, naturalWidthPx: width, naturalHeightPx: height };
}
