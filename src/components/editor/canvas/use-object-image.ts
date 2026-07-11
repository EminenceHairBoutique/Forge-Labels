"use client";

import * as React from "react";
import type { ImageSource } from "@/lib/document/schema";
import { getStorageAdapter } from "@/lib/storage";

/**
 * Loads an image object's source into a drawable CanvasImageSource, cached
 * across the editor session. SVGs load through <img> (canvas-safe after
 * sanitization at upload time); raster formats use createImageBitmap.
 */
const cache = new Map<string, Promise<CanvasImageSource>>();

function keyOf(source: ImageSource): string {
  return source.kind === "asset" ? `asset:${source.assetId}` : `url:${source.url}`;
}

async function loadSource(source: ImageSource): Promise<CanvasImageSource> {
  let blob: Blob | null;
  if (source.kind === "asset") {
    blob = await getStorageAdapter().getAssetBlob(source.assetId);
  } else {
    const res = await fetch(source.url);
    blob = res.ok ? await res.blob() : null;
  }
  if (!blob) throw new Error("Image not found");

  if (blob.type === "image/svg+xml") {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("SVG failed to load"));
      img.src = url;
    });
    // Object URL stays alive for the session (cached image keeps using it).
    return img;
  }
  return createImageBitmap(blob);
}

export function useObjectImage(source: ImageSource | null): CanvasImageSource | null {
  const [loaded, setLoaded] = React.useState<{
    key: string;
    image: CanvasImageSource | null;
  } | null>(null);

  React.useEffect(() => {
    if (!source) return;
    let cancelled = false;
    const key = keyOf(source);
    let promise = cache.get(key);
    if (!promise) {
      promise = loadSource(source);
      cache.set(key, promise);
      promise.catch(() => cache.delete(key));
    }
    promise
      .then((img) => {
        if (!cancelled) setLoaded({ key, image: img });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key, image: null });
      });
    return () => {
      cancelled = true;
    };
  }, [source]);

  if (!source) return null;
  return loaded && loaded.key === keyOf(source) ? loaded.image : null;
}
