import type { MaterialId } from "../materials";
import { CORE_TEMPLATES } from "./core";
import type { EasyTemplateDef, TemplateCategory } from "./types";

/**
 * The Easy template registry: every family file contributes here. IDs and
 * family ids must be unique across the whole library — validate.ts and the
 * unit suite enforce it together with the per-template quality gates.
 */

export * from "./types";

const ALL: EasyTemplateDef[] = [...CORE_TEMPLATES];

export const EASY_TEMPLATES: readonly EasyTemplateDef[] = ALL;

export function getEasyTemplate(id: string): EasyTemplateDef | undefined {
  return EASY_TEMPLATES.find((t) => t.id === id);
}

export function templatesForMaterial(materialId: MaterialId): EasyTemplateDef[] {
  return EASY_TEMPLATES.filter(
    (t) => t.materials === "all" || t.materials.includes(materialId),
  );
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
