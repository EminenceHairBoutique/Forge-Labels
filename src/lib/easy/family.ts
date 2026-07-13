import type { LabelDocument } from "@/lib/document/schema";
import { getEasyPalette, type EasyPalette } from "./palettes";
import { getMaterial, getMaterialOption, type MaterialDef } from "./materials";
import { getEasyTemplate } from "./templates";
import { buildEasyLabel, mergeEasyObjects } from "./instantiate";
import { readEasyContent } from "./meta";
import type { TextMeasure } from "./layout";
import type { SlotId } from "./slots";

/**
 * Matching product-line generator (§19): a new label that preserves the
 * brand identity — template, fonts, material, dimensions, warning style,
 * even free objects added in the Advanced Editor — while changing only the
 * product-specific fields, with optional strength color coding.
 */

export interface FamilyOverrides {
  productName?: string;
  strength?: string;
  lot?: string;
  expiry?: string;
  qr?: string;
  /** Accent/palette swap for strength color coding. */
  paletteId?: string;
}

export function buildFamilyVariant(
  source: LabelDocument,
  overrides: FamilyOverrides,
  measure?: TextMeasure,
): LabelDocument {
  const content = readEasyContent(source);
  if (!content) {
    throw new Error("Matching labels need an Easy Creator project.");
  }
  const meta = { ...content.meta };
  if (overrides.paletteId) meta.paletteId = overrides.paletteId;

  const template = getEasyTemplate(meta.templateId);
  const material = getMaterial(meta.materialId);
  if (!template || !material) {
    throw new Error("The source label uses an unknown template or material.");
  }
  const option = getMaterialOption(material, meta.materialOptionId);
  const palette = getEasyPalette(meta.paletteId);

  const fields = { ...content.fields };
  const enabled = new Set<SlotId>(content.enabled);
  const apply = (slot: SlotId, value: string | undefined) => {
    if (value === undefined) return;
    const trimmed = value.trim();
    if (trimmed) {
      fields[slot] = trimmed;
      enabled.add(slot);
    } else {
      delete fields[slot];
      enabled.delete(slot);
    }
  };
  apply("product-name", overrides.productName);
  apply("strength", overrides.strength);
  apply("lot", overrides.lot);
  apply("expiry", overrides.expiry);
  apply("qr", overrides.qr);

  const build = buildEasyLabel({
    template,
    widthMm: source.label.widthMm,
    heightMm: source.label.heightMm,
    bleedMm: source.label.bleedMm,
    safeMm: source.label.safeMm,
    material,
    option,
    intensity: meta.intensity ?? material.defaultIntensity,
    palette,
    fields,
    enabled,
    measure,
    tweaks: meta.tweaks,
  });

  // mergeEasyObjects keeps free objects (logos, extra art) — the brand
  // identity travels with the family.
  return { ...mergeEasyObjects(source, build), easy: meta };
}

// ---------------------------------------------------------------------------
// Strength color coding (§19): 5 mg → blue, 10 mg → purple, 20 mg → red,
// 30 mg+ → gold — customizable because the user can pick any palette.
// ---------------------------------------------------------------------------

export const STRENGTH_HUES: readonly { maxMg: number; hue: number; name: string }[] = [
  { maxMg: 7.5, hue: 225, name: "blue" },
  { maxMg: 15, hue: 275, name: "purple" },
  { maxMg: 25, hue: 0, name: "red" },
  { maxMg: Infinity, hue: 45, name: "gold" },
];

/** Hue (0–360) of a hex color; grays return null. */
export function hexHue(hex: string): number | null {
  const h =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex.slice(0, 7);
  const r = parseInt(h.slice(1, 3), 16) / 255;
  const g = parseInt(h.slice(3, 5), 16) / 255;
  const b = parseInt(h.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta < 0.08) return null; // effectively gray
  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return (hue * 60 + 360) % 360;
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** First numeric amount in a strength string ("10 mg" → 10). */
export function parseStrengthMg(strength: string): number | null {
  const match = strength.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

/**
 * Suggest the material palette whose accent hue is closest to the
 * strength's conventional color. Null when the strength has no number or
 * no palette has a usable hue.
 */
export function suggestPaletteForStrength(
  strength: string,
  material: MaterialDef,
): EasyPalette | null {
  const mg = parseStrengthMg(strength);
  if (mg === null) return null;
  const target = STRENGTH_HUES.find((s) => mg <= s.maxMg)!.hue;
  let best: { palette: EasyPalette; distance: number } | null = null;
  for (const id of material.paletteIds) {
    const palette = getEasyPalette(id);
    const hue = hexHue(palette.accent);
    if (hue === null) continue;
    const distance = hueDistance(hue, target);
    if (!best || distance < best.distance) best = { palette, distance };
  }
  return best?.palette ?? null;
}
