import type { EasyMeta } from "@/lib/document/schema";
import { getMaterial, type Intensity } from "./materials";
import type { SlotId } from "./slots";

/**
 * Pure Easy-meta transitions (DOM-free — fields.ts wires them to the
 * store; tests exercise them directly).
 */

export interface EasyChange {
  field?: { slot: SlotId; value: string };
  toggle?: { slot: SlotId; on: boolean };
  paletteId?: string;
  templateId?: string;
  material?: { materialId: string; optionId: string };
  intensity?: Intensity;
}

/**
 * On a material change the palette carries across only when the new
 * material offers it (otherwise its curated default keeps the contrast
 * rules holding), sub-options revalidate, and intensity resets to the
 * material's default unless explicitly chosen.
 */
export function nextEasyMeta(current: EasyMeta, change: EasyChange): EasyMeta {
  const meta: EasyMeta = { ...current };
  if (change.paletteId) meta.paletteId = change.paletteId;
  if (change.templateId) meta.templateId = change.templateId;
  if (change.intensity) meta.intensity = change.intensity;
  if (change.material) {
    meta.materialId = change.material.materialId;
    meta.materialOptionId = change.material.optionId;
    const nextMaterial = getMaterial(meta.materialId);
    if (nextMaterial) {
      if (!nextMaterial.paletteIds.includes(meta.paletteId)) {
        meta.paletteId = nextMaterial.defaultPaletteId;
      }
      if (!nextMaterial.options.some((o) => o.id === meta.materialOptionId)) {
        meta.materialOptionId = nextMaterial.defaultOptionId;
      }
      if (!change.intensity) meta.intensity = nextMaterial.defaultIntensity;
    }
  }
  return meta;
}
