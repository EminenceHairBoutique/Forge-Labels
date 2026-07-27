import { EXEMPLAR_TEMPLATES } from "./data/exemplars";
import { COLLECTION_TEMPLATES } from "./data/collection";
import { NOIR_EXACT_TEMPLATES } from "./data/noir-exact";
import type { TemplateCategoryId, TemplateDef } from "./types";

export const ALL_TEMPLATES: TemplateDef[] = [
  ...EXEMPLAR_TEMPLATES,
  ...COLLECTION_TEMPLATES,
  ...NOIR_EXACT_TEMPLATES,
];

export function getTemplate(id: string): TemplateDef | undefined {
  return ALL_TEMPLATES.find((t) => t.id === id);
}

export function templatesByCategory(category: TemplateCategoryId | "all"): TemplateDef[] {
  if (category === "all") return ALL_TEMPLATES;
  return ALL_TEMPLATES.filter((t) => t.categories.includes(category));
}
