/**
 * Simulated special-material finishes and print substrates.
 *
 * Finishes are procedural, seamlessly-tiling canvas patterns applied as
 * fills (objects, text, backgrounds). They are SCREEN SIMULATIONS of
 * physical materials — every UI surface that shows them carries the
 * "simulation only" disclaimer, and exports rasterize them at a fixed
 * density (see fills.ts wiring).
 */

export type FinishCategory = "holographic" | "foil" | "metal" | "texture";

export interface FinishDef {
  id: string;
  name: string;
  category: FinishCategory;
  description: string;
}

export const FINISHES: readonly FinishDef[] = [
  {
    id: "holo-rainbow",
    name: "Holographic rainbow",
    category: "holographic",
    description: "Smooth spectral sweep like classic rainbow holographic film.",
  },
  {
    id: "holo-prism",
    name: "Holographic prism",
    category: "holographic",
    description: "Faceted triangular prisms catching different hues.",
  },
  {
    id: "holo-wave",
    name: "Holographic wave",
    category: "holographic",
    description: "Flowing bands of shifting spectral color.",
  },
  {
    id: "holo-dots",
    name: "Holographic dots",
    category: "holographic",
    description: "Micro-dot diffraction pattern with rainbow sparkle.",
  },
  {
    id: "holo-shatter",
    name: "Shattered glass",
    category: "holographic",
    description: "Angular shards of iridescent color.",
  },
  {
    id: "foil-gold",
    name: "Gold foil",
    category: "foil",
    description: "Warm metallic gold with directional sheen.",
  },
  {
    id: "foil-silver",
    name: "Silver foil",
    category: "foil",
    description: "Bright silver metallic with directional sheen.",
  },
  {
    id: "foil-rose",
    name: "Rose gold foil",
    category: "foil",
    description: "Blushed copper-pink metallic.",
  },
  {
    id: "metal-brushed",
    name: "Brushed metal",
    category: "metal",
    description: "Fine linear grain like brushed aluminum.",
  },
  {
    id: "metal-chrome",
    name: "Chrome",
    category: "metal",
    description: "High-contrast mirror-like banding.",
  },
  {
    id: "glitter",
    name: "Glitter",
    category: "texture",
    description: "Dense multicolor sparkle flecks.",
  },
  {
    id: "kraft",
    name: "Kraft paper",
    category: "texture",
    description: "Warm brown recycled-fiber paper texture.",
  },
] as const;

export function getFinish(id: string): FinishDef | undefined {
  return FINISHES.find((f) => f.id === id);
}

// ---------------------------------------------------------------------------
// Substrates (the physical label stock, previewed under transparent areas)
// ---------------------------------------------------------------------------

export interface SubstrateDef {
  id: string;
  name: string;
  description: string;
  /** null = show true transparency (checkerboard in the editor). */
  previewFinishId: string | null;
  /** Flat preview color when no finish tile applies. */
  previewColor: string | null;
  waterproof: boolean;
}

export const SUBSTRATES: readonly SubstrateDef[] = [
  {
    id: "white-pp",
    name: "White polypropylene",
    description: "The standard waterproof white label stock.",
    previewFinishId: null,
    previewColor: "#ffffff",
    waterproof: true,
  },
  {
    id: "clear-pp",
    name: "Clear polypropylene",
    description: "Transparent film for a no-label look.",
    previewFinishId: null,
    previewColor: null,
    waterproof: true,
  },
  {
    id: "silver-pet",
    name: "Silver polyester",
    description: "Metallic silver film; unprinted areas stay mirror-silver.",
    previewFinishId: "foil-silver",
    previewColor: null,
    waterproof: true,
  },
  {
    id: "holo-pet",
    name: "Holographic polyester",
    description: "Rainbow holographic film; unprinted areas shimmer.",
    previewFinishId: "holo-rainbow",
    previewColor: null,
    waterproof: true,
  },
  {
    id: "kraft-paper",
    name: "Kraft paper",
    description: "Uncoated recycled look; not waterproof.",
    previewFinishId: "kraft",
    previewColor: null,
    waterproof: false,
  },
  {
    id: "textured-paper",
    name: "Textured estate paper",
    description: "Premium uncoated paper with a felt texture.",
    previewFinishId: null,
    previewColor: "#f7f3ea",
    waterproof: false,
  },
] as const;

export function getSubstrate(id: string): SubstrateDef | undefined {
  return SUBSTRATES.find((s) => s.id === id);
}
