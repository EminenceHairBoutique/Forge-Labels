"use client";

import { extractDominantColors, paletteFromLogo } from "./logo-palette";
import type { EasyPalette } from "./palettes";

/**
 * Logo intake for the Easy Creator: downscale any raster upload to a
 * bounded PNG data URL (≤ 512 px on the long edge, alpha preserved) so it
 * travels inside the document, renders identically in the editor, the 3D
 * preview, and every export, and never bloats autosave.
 */

const MAX_EDGE_PX = 512;
const MAX_FILE_BYTES = 12 * 1024 * 1024;

export interface EasyLogo {
  src: string;
  /** Width / height. */
  aspect: number;
}

export async function fileToEasyLogo(file: File): Promise<EasyLogo> {
  if (!file.type.startsWith("image/")) {
    throw new Error("That file isn't an image — use a PNG or JPG of your logo.");
  }
  if (file.type === "image/svg+xml") {
    // SVG needs sanitization + font handling — the Advanced Editor's asset
    // pipeline does that properly.
    throw new Error(
      "SVG logos are supported in the Advanced Editor — here, use a PNG or JPG.",
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("That image is very large — export your logo under 12 MB and try again.");
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const w = image.naturalWidth;
    const h = image.naturalHeight;
    if (!w || !h) throw new Error("Couldn't read that image — try a different file.");
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(Math.round(w * scale), 1);
    canvas.height = Math.max(Math.round(h * scale), 1);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't process the image in this browser.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
      src: canvas.toDataURL("image/png"),
      aspect: w / h,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Couldn't read that image — try a different file."));
    image.src = url;
  });
}

/**
 * Colors from a stored logo data URL → a contrast-safe Easy palette, or
 * null when the logo has no usable color. Downsampled hard (≤ 48 px) —
 * dominant-color math doesn't need detail.
 */
export async function paletteFromLogoSrc(src: string): Promise<EasyPalette | null> {
  try {
    const image = await loadImage(src);
    const w = image.naturalWidth;
    const h = image.naturalHeight;
    if (!w || !h) return null;
    const scale = Math.min(1, 48 / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(Math.round(w * scale), 1);
    canvas.height = Math.max(Math.round(h * scale), 1);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return paletteFromLogo(extractDominantColors(pixels));
  } catch {
    return null;
  }
}
