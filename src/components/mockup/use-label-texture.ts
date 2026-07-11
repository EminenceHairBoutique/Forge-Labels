"use client";

import * as React from "react";
import type { LabelDocument } from "@/lib/document/schema";
import { loadFontsForDocument } from "@/lib/fonts/registry";
import { buildStage } from "@/lib/render/build-stage";
import { resolveDocumentImages } from "@/lib/export/raster";
import { ensureFinishesRegistered } from "@/lib/finishes";

const MAX_TEXTURE_PX = 2048;
const THROTTLE_MS = 300;

/**
 * Renders the document to an offscreen canvas for the 3D mockup texture.
 * Trailing-throttled: rapid edits coalesce into one render ~300 ms after the
 * last change. Returns the same canvas identity only when re-rendered, so
 * consumers can key texture updates off it.
 */
export function useLabelTexture(doc: LabelDocument | null): HTMLCanvasElement | null {
  const [canvas, setCanvas] = React.useState<HTMLCanvasElement | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyRef = React.useRef(false);
  const pendingRef = React.useRef<LabelDocument | null>(null);

  React.useEffect(() => {
    if (!doc) return;

    const render = async (target: LabelDocument) => {
      if (busyRef.current) {
        pendingRef.current = target;
        return;
      }
      busyRef.current = true;
      try {
        ensureFinishesRegistered();
        await loadFontsForDocument(target);
        const { images, release } = await resolveDocumentImages(target);
        const container = document.createElement("div");
        const built = buildStage(target, container, {
          includeBleed: false,
          clipToShape: false,
          drawBackground: true,
          images,
          dpi: 220,
        });
        try {
          const scale = Math.min(
            MAX_TEXTURE_PX / built.widthMm,
            MAX_TEXTURE_PX / built.heightMm,
            220 / 25.4,
          );
          setCanvas(built.stage.toCanvas({ pixelRatio: scale }));
        } finally {
          built.destroy();
          release();
        }
      } catch {
        // Texture refresh is cosmetic; keep the previous frame on failure.
      } finally {
        busyRef.current = false;
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending) void render(pending);
      }
    };

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void render(doc), THROTTLE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [doc]);

  return canvas;
}
