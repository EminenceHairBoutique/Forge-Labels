import type { MaterialId } from "../materials";
import { getVialPreset } from "@/lib/vials/presets";
import { CORE_TEMPLATES } from "./core";
import { LUXURY_TEMPLATES } from "./luxury";
import { CLINICAL_TEMPLATES } from "./clinical";
import { LABORATORY_TEMPLATES } from "./laboratory";
import { EFFECT_TEMPLATES } from "./effects";
import { EVERYDAY_TEMPLATES } from "./everyday";
import { LUXE_EXPANSION } from "./expansion-luxe";
import { LAB_EXPANSION } from "./expansion-lab";
import { EFFECTS_EXPANSION } from "./expansion-effects";
import { CRIMP_TEMPLATES } from "./crimp";
import { RESEARCH_PEPTIDE_TEMPLATES } from "./research-peptide";
import { DARK_LABORATORY_TEMPLATES } from "./dark-laboratory";
import { BIOTECHNOLOGY_TEMPLATES } from "./biotechnology";
import type { EasyTemplateDef, TemplateCategory } from "./types";

/**
 * The Easy template registry: every family file contributes here. IDs and
 * family ids must be unique across the whole library — validate.ts and the
 * unit suite enforce it together with the per-template quality gates.
 */

export * from "./types";

const ALL: EasyTemplateDef[] = [
  ...CORE_TEMPLATES,
  ...LUXURY_TEMPLATES,
  ...CLINICAL_TEMPLATES,
  ...LABORATORY_TEMPLATES,
  ...EFFECT_TEMPLATES,
  ...EVERYDAY_TEMPLATES,
  ...LUXE_EXPANSION,
  ...LAB_EXPANSION,
  ...EFFECTS_EXPANSION,
  ...CRIMP_TEMPLATES,
  ...RESEARCH_PEPTIDE_TEMPLATES,
  ...DARK_LABORATORY_TEMPLATES,
  ...BIOTECHNOLOGY_TEMPLATES,
];

export const EASY_TEMPLATES: readonly EasyTemplateDef[] = ALL;

export function getEasyTemplate(id: string): EasyTemplateDef | undefined {
  return EASY_TEMPLATES.find((t) => t.id === id);
}

export function templatesForMaterial(materialId: MaterialId): EasyTemplateDef[] {
  return EASY_TEMPLATES.filter(
    (t) => t.materials === "all" || t.materials.includes(materialId),
  );
}

/**
 * Vial compatibility (§3): most templates fit any container, but a
 * template may lock itself to specific vial presets and/or nominal
 * volumes. An unknown vial (custom measurements, no preset) never
 * matches a restricted template — we can't promise a fit we can't
 * verify. Restricted templates keep matching when the user fine-tunes
 * the measurements of a known preset (it's still that vial, measured).
 */
export function templateFitsVial(
  t: EasyTemplateDef,
  presetId: string | null | undefined,
): boolean {
  if (t.compatibleVialTypes === "all" && t.compatibleVolumesMl === "all") {
    return true;
  }
  const preset = presetId ? getVialPreset(presetId) : undefined;
  if (!preset) return false;
  if (t.compatibleVialTypes !== "all" && !t.compatibleVialTypes.includes(preset.id)) {
    return false;
  }
  if (
    t.compatibleVolumesMl !== "all" &&
    (preset.nominalVolumeMl === null ||
      !t.compatibleVolumesMl.includes(preset.nominalVolumeMl))
  ) {
    return false;
  }
  return true;
}

/** True when the template is tuned to specific vials (vs universal). */
export function templateIsVialSpecific(t: EasyTemplateDef): boolean {
  return t.compatibleVialTypes !== "all" || t.compatibleVolumesMl !== "all";
}

export function templatesInCategory(category: TemplateCategory): EasyTemplateDef[] {
  return EASY_TEMPLATES.filter((t) => t.category.includes(category));
}

/** Distinct family ids, in registry order. */
export function templateFamilies(): { family: string; familyName: string; count: number }[] {
  const seen = new Map<string, { family: string; familyName: string; count: number }>();
  for (const t of EASY_TEMPLATES) {
    const entry = seen.get(t.family);
    if (entry) entry.count += 1;
    else seen.set(t.family, { family: t.family, familyName: t.familyName, count: 1 });
  }
  return [...seen.values()];
}

/** Other templates of the same family (design siblings). */
export function familySiblings(template: EasyTemplateDef): EasyTemplateDef[] {
  return EASY_TEMPLATES.filter(
    (t) => t.family === template.family && t.id !== template.id,
  );
}
