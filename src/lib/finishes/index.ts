"use client";

import { registerFinishResolver } from "@/lib/render/fills";
import { generateFinishTile, FINISH_TILE_DENSITY_PX_PER_MM } from "./patterns";

export * from "./types";
export { generateFinishTile, FINISH_TILE_DENSITY_PX_PER_MM };

let registered = false;

/**
 * Wire the finish pattern generator into the shared fill resolver. Called
 * once from the editor shell and the export entry points; idempotent.
 */
export function ensureFinishesRegistered(): void {
  if (registered || typeof document === "undefined") return;
  registered = true;
  registerFinishResolver((fill) => {
    try {
      const image = generateFinishTile(fill.finishId, { intensity: fill.intensity });
      return image ? { image, pxPerMm: FINISH_TILE_DENSITY_PX_PER_MM } : null;
    } catch {
      return null;
    }
  });
}
