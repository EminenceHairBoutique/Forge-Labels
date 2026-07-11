import type { ImageObject } from "@/lib/document/schema";

/**
 * Image adjustments baked into a canvas via ctx.filter — once per change,
 * never per frame (the editor's no-runtime-filters performance rule). The
 * SAME function runs in the editor hook and the export resolver, so screen
 * and print match.
 */

export type ImageFilterSettings = ImageObject["filters"];

export function hasActiveFilters(filters: ImageFilterSettings): boolean {
  return (
    filters.brightness !== 0 ||
    filters.contrast !== 0 ||
    filters.saturation !== 0 ||
    filters.blurPx > 0 ||
    filters.grayscale
  );
}

export function filterCss(filters: ImageFilterSettings): string {
  const parts: string[] = [];
  if (filters.brightness !== 0) parts.push(`brightness(${1 + filters.brightness})`);
  if (filters.contrast !== 0) parts.push(`contrast(${1 + filters.contrast / 100})`);
  if (filters.saturation !== 0) parts.push(`saturate(${1 + filters.saturation})`);
  if (filters.grayscale) parts.push("grayscale(1)");
  if (filters.blurPx > 0) parts.push(`blur(${filters.blurPx}px)`);
  return parts.join(" ");
}

export function filterCacheKey(filters: ImageFilterSettings): string {
  return [
    filters.brightness,
    filters.contrast,
    filters.saturation,
    filters.blurPx,
    filters.grayscale ? 1 : 0,
  ].join("|");
}

function sourceSize(source: CanvasImageSource): { width: number; height: number } {
  if (typeof VideoFrame !== "undefined" && source instanceof VideoFrame) {
    return { width: source.displayWidth, height: source.displayHeight };
  }
  const anySource = source as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
  return {
    width: anySource.naturalWidth ?? anySource.width ?? 0,
    height: anySource.naturalHeight ?? anySource.height ?? 0,
  };
}

/** Bake filters into a new canvas (returns the source unchanged when idle). */
export function applyImageFilters(
  source: CanvasImageSource,
  filters: ImageFilterSettings,
): CanvasImageSource {
  if (!hasActiveFilters(filters)) return source;
  const { width, height } = sourceSize(source);
  if (width === 0 || height === 0) return source;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.filter = filterCss(filters);
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}
