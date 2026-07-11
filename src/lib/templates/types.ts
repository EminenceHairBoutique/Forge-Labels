import type { LabelDocument } from "@/lib/document/schema";

/**
 * Template registry types. Templates are complete, validated LabelDocuments
 * authored for a specific vial preset; applying one to a different label
 * size rescales it proportionally (see apply.ts).
 */

export const TEMPLATE_CATEGORIES = [
  { id: "minimal-clinical", name: "Minimal clinical" },
  { id: "luxury", name: "Luxury" },
  { id: "cosmetic-serum", name: "Cosmetic serum" },
  { id: "botanical", name: "Botanical & organic" },
  { id: "pharma", name: "Pharmaceutical-inspired" },
  { id: "apothecary", name: "Vintage apothecary" },
  { id: "modern-wellness", name: "Modern wellness" },
  { id: "bold-type", name: "Bold typography" },
  { id: "qr-first", name: "QR-first" },
  { id: "lab", name: "Laboratory & research" },
] as const;

export type TemplateCategoryId = (typeof TEMPLATE_CATEGORIES)[number]["id"];

/** Fictional demo brands (spec §33) — never real companies. */
export const DEMO_BRANDS = [
  "AURELIS LABS",
  "VANTA RESEARCH",
  "NOVA SERUM",
  "ETHERA SKIN",
  "ORIGIN WELLNESS",
  "LUMEN BIOSCIENCE",
  "NOIR FORMULA",
  "ARCADIA BOTANICALS",
] as const;

export interface TemplateDef {
  id: string;
  name: string;
  /** One of DEMO_BRANDS. */
  brand: string;
  description: string;
  categories: TemplateCategoryId[];
  /** Premium templates unlock on paid plans (all usable in local demo). */
  premium: boolean;
  /** The vial preset this template was designed around. */
  presetId: string;
  doc: LabelDocument;
}
