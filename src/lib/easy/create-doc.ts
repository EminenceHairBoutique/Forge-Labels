import { createDocument } from "@/lib/document/defaults";
import type { EasyMeta, LabelDocument } from "@/lib/document/schema";
import type { VialPreset } from "@/lib/vials/presets";
import { getEasyPalette } from "./palettes";
import { getMaterial, getMaterialOption, type Intensity } from "./materials";
import { getEasyTemplate } from "./templates";
import { buildEasyLabel, mergeEasyObjects } from "./instantiate";
import type { TextMeasure } from "./layout";
import type { SlotId } from "./slots";

/**
 * Build a complete Easy document from wizard choices. Pure (measurer
 * injectable); browser callers load the template's fonts first and pass
 * the real Konva measurer for exact metrics.
 */

export interface EasyDocumentSpec {
  preset: VialPreset;
  /** Custom measurement overrides (mm). */
  diameterMm?: number;
  straightWallHeightMm?: number;
  templateId: string;
  materialId: string;
  materialOptionId: string;
  intensity?: Intensity;
  paletteId: string;
  styleId?: string;
  fields: Partial<Record<SlotId, string>>;
  enabled: ReadonlySet<SlotId>;
}

export function buildEasyDocument(
  spec: EasyDocumentSpec,
  measure?: TextMeasure,
): LabelDocument {
  const template = getEasyTemplate(spec.templateId);
  const material = getMaterial(spec.materialId);
  if (!template || !material) {
    throw new Error("Unknown Easy template or material");
  }
  const option = getMaterialOption(material, spec.materialOptionId);
  const palette = getEasyPalette(spec.paletteId);
  const intensity = spec.intensity ?? material.defaultIntensity;

  const base = createDocument({
    preset: spec.preset,
    diameterMm: spec.diameterMm,
    straightWallHeightMm: spec.straightWallHeightMm,
  });

  const build = buildEasyLabel({
    template,
    widthMm: base.label.widthMm,
    heightMm: base.label.heightMm,
    bleedMm: base.label.bleedMm,
    safeMm: base.label.safeMm,
    material,
    option,
    intensity,
    palette,
    fields: spec.fields,
    enabled: spec.enabled,
    measure,
  });

  const easy: EasyMeta = {
    templateId: template.id,
    materialId: material.id,
    materialOptionId: option.id,
    intensity,
    paletteId: palette.id,
    styleId: spec.styleId,
  };

  return { ...mergeEasyObjects(base, build), easy };
}

/** Sensible starter values so previews never render an empty label. */
export function defaultEasyFields(
  overrides: Partial<Record<SlotId, string>> = {},
): Partial<Record<SlotId, string>> {
  return {
    brand: "YOUR BRAND",
    "product-name": "Product Name",
    strength: "",
    volume: "",
    ...overrides,
  };
}

export const DEFAULT_ENABLED: ReadonlySet<SlotId> = new Set([
  "brand",
  "product-name",
  "strength",
  "volume",
]);
