import type { MaterialId } from "./materials";
import type { SlotId } from "./slots";

/**
 * Easy template definitions. Unlike the classic template registry (which
 * stores complete documents for one vial size), Easy templates are LAYOUT
 * PROGRAMS: slot rows with zone/size/casing rules that the engine
 * instantiates for ANY label geometry — responsive across 10/20/30 mL by
 * construction, material-aware, and palette-driven.
 */

export type ZoneId = "header" | "hero" | "footer";
export type ColorRole = "text" | "muted" | "accent" | "onAccent";
export type FontRole = "display" | "body";

export interface RowDef {
  slot: SlotId;
  zone: ZoneId;
  font: FontRole;
  weight?: number;
  /**
   * Cap height as a fraction of label height (0.14 on a 26 mm label ≈
   * 10 pt) — this is what makes templates size-responsive.
   */
  sizeFactor: number;
  minPt: number;
  maxLines: number;
  color: ColorRole;
  letterSpacingEm?: number;
  casing?: "uppercase";
  /** Extra space above the row, in mm at a 26 mm label (scaled). */
  spacingBefore?: number;
}

export type DecorFill = { role: ColorRole } | { effect: true };

export type DecorDef =
  | { kind: "band"; edge: "top" | "bottom"; heightFactor: number; fill: DecorFill }
  | { kind: "stripe"; edge: "left" | "right"; widthFactor: number; fill: DecorFill }
  | { kind: "border"; insetMm: number; strokePt: number; color: ColorRole }
  | { kind: "underline-hero"; widthFactor: number; strokePt: number; fill: DecorFill };

export type VibeTag =
  | "clinical"
  | "luxury"
  | "bold"
  | "futuristic"
  | "minimal"
  | "botanical"
  | "playful"
  | "premium";

export interface EasyTemplateDef {
  id: string;
  name: string;
  /** Layout archetype family (distinct DNA — never a color swap). */
  family: string;
  vibe: Partial<Record<VibeTag, number>>;
  /** Whether the template reads best on dark palettes. */
  prefersDark: boolean;
  fonts: {
    display: string;
    displayWeight: number;
    body: string;
    bodyWeight: number;
  };
  align: "left" | "center";
  rows: RowDef[];
  /** Corner that anchors QR/barcode boxes (inside the footer zone). */
  codeCorner: "bottom-right" | "bottom-left";
  decor: DecorDef[];
  materials: MaterialId[] | "all";
}

// Shared footer rows (small print) used by most archetypes.
function footerRows(color: ColorRole = "muted"): RowDef[] {
  return [
    { slot: "description", zone: "hero", font: "body", sizeFactor: 0.055, minPt: 4.5, maxLines: 3, color: "muted", spacingBefore: 1.4 },
    { slot: "ingredients", zone: "footer", font: "body", sizeFactor: 0.045, minPt: 4, maxLines: 3, color },
    { slot: "directions", zone: "footer", font: "body", sizeFactor: 0.045, minPt: 4, maxLines: 2, color, spacingBefore: 0.6 },
    { slot: "storage", zone: "footer", font: "body", sizeFactor: 0.045, minPt: 4, maxLines: 1, color, spacingBefore: 0.6 },
    { slot: "warning", zone: "footer", font: "body", weight: 600, sizeFactor: 0.045, minPt: 4, maxLines: 2, color: "text", spacingBefore: 0.6 },
    { slot: "lot", zone: "footer", font: "body", sizeFactor: 0.045, minPt: 4, maxLines: 1, color, spacingBefore: 0.8 },
    { slot: "expiry", zone: "footer", font: "body", sizeFactor: 0.045, minPt: 4, maxLines: 1, color, spacingBefore: 0.3 },
    { slot: "website", zone: "footer", font: "body", sizeFactor: 0.05, minPt: 4, maxLines: 1, color, spacingBefore: 0.8 },
  ];
}

export const EASY_TEMPLATES: readonly EasyTemplateDef[] = [
  {
    id: "clinical-frame",
    name: "Clinical frame",
    family: "clinical",
    vibe: { clinical: 3, minimal: 2 },
    prefersDark: false,
    fonts: { display: "inter", displayWeight: 700, body: "inter", bodyWeight: 400 },
    align: "left",
    rows: [
      { slot: "brand", zone: "header", font: "body", weight: 600, sizeFactor: 0.06, minPt: 4.5, maxLines: 1, color: "muted", letterSpacingEm: 0.14, casing: "uppercase" },
      { slot: "product-name", zone: "hero", font: "display", sizeFactor: 0.15, minPt: 7, maxLines: 2, color: "text" },
      { slot: "subtitle", zone: "hero", font: "body", sizeFactor: 0.06, minPt: 4.5, maxLines: 1, color: "muted", spacingBefore: 0.8 },
      { slot: "strength", zone: "hero", font: "body", weight: 600, sizeFactor: 0.075, minPt: 5, maxLines: 1, color: "accent", spacingBefore: 1 },
      { slot: "volume", zone: "hero", font: "body", sizeFactor: 0.055, minPt: 4.5, maxLines: 1, color: "muted", spacingBefore: 0.4 },
      ...footerRows(),
    ],
    codeCorner: "bottom-right",
    decor: [{ kind: "border", insetMm: 1.2, strokePt: 0.8, color: "accent" }],
    materials: "all",
  },
  {
    id: "luxury-center",
    name: "Luxury centered",
    family: "luxury",
    vibe: { luxury: 3, premium: 3 },
    prefersDark: true,
    fonts: { display: "playfair-display", displayWeight: 600, body: "inter", bodyWeight: 400 },
    align: "center",
    rows: [
      { slot: "brand", zone: "header", font: "body", weight: 500, sizeFactor: 0.06, minPt: 4.5, maxLines: 1, color: "muted", letterSpacingEm: 0.3, casing: "uppercase" },
      { slot: "product-name", zone: "hero", font: "display", sizeFactor: 0.16, minPt: 7, maxLines: 2, color: "text" },
      { slot: "subtitle", zone: "hero", font: "body", sizeFactor: 0.055, minPt: 4.5, maxLines: 1, color: "muted", letterSpacingEm: 0.08, spacingBefore: 1 },
      { slot: "strength", zone: "hero", font: "body", weight: 500, sizeFactor: 0.065, minPt: 4.5, maxLines: 1, color: "accent", letterSpacingEm: 0.12, spacingBefore: 1.2 },
      { slot: "volume", zone: "footer", font: "body", sizeFactor: 0.05, minPt: 4, maxLines: 1, color: "muted" },
      ...footerRows(),
    ],
    codeCorner: "bottom-right",
    decor: [
      { kind: "underline-hero", widthFactor: 0.18, strokePt: 1, fill: { effect: true } },
    ],
    materials: "all",
  },
  {
    id: "bold-block",
    name: "Bold block",
    family: "bold",
    vibe: { bold: 3, playful: 1 },
    prefersDark: true,
    fonts: { display: "bebas-neue", displayWeight: 400, body: "inter", bodyWeight: 500 },
    align: "left",
    rows: [
      { slot: "brand", zone: "header", font: "body", weight: 700, sizeFactor: 0.06, minPt: 4.5, maxLines: 1, color: "muted", letterSpacingEm: 0.12, casing: "uppercase" },
      { slot: "product-name", zone: "hero", font: "display", sizeFactor: 0.24, minPt: 9, maxLines: 2, color: "text", casing: "uppercase" },
      { slot: "strength", zone: "hero", font: "body", weight: 700, sizeFactor: 0.085, minPt: 5, maxLines: 1, color: "accent", spacingBefore: 0.8 },
      { slot: "subtitle", zone: "hero", font: "body", sizeFactor: 0.055, minPt: 4.5, maxLines: 1, color: "muted", spacingBefore: 0.6 },
      { slot: "volume", zone: "footer", font: "body", weight: 600, sizeFactor: 0.055, minPt: 4, maxLines: 1, color: "muted" },
      ...footerRows(),
    ],
    codeCorner: "bottom-right",
    decor: [
      { kind: "band", edge: "top", heightFactor: 0.14, fill: { effect: true } },
      { kind: "band", edge: "bottom", heightFactor: 0.07, fill: { role: "accent" } },
    ],
    materials: "all",
  },
  {
    id: "futuristic-band",
    name: "Futuristic band",
    family: "futuristic",
    vibe: { futuristic: 3, bold: 1, clinical: 1 },
    prefersDark: true,
    fonts: { display: "orbitron", displayWeight: 700, body: "space-grotesk", bodyWeight: 400 },
    align: "center",
    rows: [
      { slot: "brand", zone: "header", font: "body", weight: 500, sizeFactor: 0.055, minPt: 4.5, maxLines: 1, color: "muted", letterSpacingEm: 0.35, casing: "uppercase" },
      { slot: "product-name", zone: "hero", font: "display", sizeFactor: 0.14, minPt: 6.5, maxLines: 2, color: "text", casing: "uppercase", letterSpacingEm: 0.06 },
      { slot: "strength", zone: "hero", font: "body", weight: 700, sizeFactor: 0.07, minPt: 4.5, maxLines: 1, color: "accent", letterSpacingEm: 0.2, spacingBefore: 1.2 },
      { slot: "subtitle", zone: "hero", font: "body", sizeFactor: 0.05, minPt: 4, maxLines: 1, color: "muted", letterSpacingEm: 0.1, spacingBefore: 0.6 },
      { slot: "volume", zone: "footer", font: "body", sizeFactor: 0.05, minPt: 4, maxLines: 1, color: "muted" },
      ...footerRows(),
    ],
    codeCorner: "bottom-left",
    decor: [
      { kind: "stripe", edge: "left", widthFactor: 0.045, fill: { effect: true } },
      { kind: "stripe", edge: "right", widthFactor: 0.045, fill: { effect: true } },
    ],
    materials: "all",
  },
  {
    id: "minimal-left",
    name: "Minimal left",
    family: "minimal",
    vibe: { minimal: 3, clinical: 1, premium: 1 },
    prefersDark: false,
    fonts: { display: "space-grotesk", displayWeight: 500, body: "inter", bodyWeight: 400 },
    align: "left",
    rows: [
      { slot: "brand", zone: "header", font: "body", weight: 500, sizeFactor: 0.055, minPt: 4.5, maxLines: 1, color: "muted", letterSpacingEm: 0.06 },
      { slot: "product-name", zone: "hero", font: "display", sizeFactor: 0.13, minPt: 6.5, maxLines: 2, color: "text" },
      { slot: "strength", zone: "hero", font: "body", sizeFactor: 0.06, minPt: 4.5, maxLines: 1, color: "text", spacingBefore: 1 },
      { slot: "subtitle", zone: "hero", font: "body", sizeFactor: 0.05, minPt: 4, maxLines: 1, color: "muted", spacingBefore: 0.5 },
      { slot: "volume", zone: "footer", font: "body", sizeFactor: 0.05, minPt: 4, maxLines: 1, color: "muted" },
      ...footerRows(),
    ],
    codeCorner: "bottom-right",
    decor: [{ kind: "underline-hero", widthFactor: 0.1, strokePt: 1.4, fill: { role: "accent" } }],
    materials: "all",
  },
  {
    id: "botanical-soft",
    name: "Botanical soft",
    family: "botanical",
    vibe: { botanical: 3, luxury: 1, minimal: 1 },
    prefersDark: false,
    fonts: { display: "cormorant-garamond", displayWeight: 600, body: "inter", bodyWeight: 400 },
    align: "center",
    rows: [
      { slot: "brand", zone: "header", font: "body", weight: 500, sizeFactor: 0.055, minPt: 4.5, maxLines: 1, color: "muted", letterSpacingEm: 0.22, casing: "uppercase" },
      { slot: "product-name", zone: "hero", font: "display", sizeFactor: 0.17, minPt: 7, maxLines: 2, color: "text" },
      { slot: "subtitle", zone: "hero", font: "body", sizeFactor: 0.052, minPt: 4, maxLines: 2, color: "muted", spacingBefore: 0.8 },
      { slot: "strength", zone: "hero", font: "body", weight: 500, sizeFactor: 0.06, minPt: 4.5, maxLines: 1, color: "accent", spacingBefore: 1 },
      { slot: "volume", zone: "footer", font: "body", sizeFactor: 0.05, minPt: 4, maxLines: 1, color: "muted" },
      ...footerRows(),
    ],
    codeCorner: "bottom-right",
    decor: [{ kind: "border", insetMm: 1.6, strokePt: 0.6, color: "muted" }],
    materials: "all",
  },
] as const;

export function getEasyTemplate(id: string): EasyTemplateDef | undefined {
  return EASY_TEMPLATES.find((t) => t.id === id);
}

export function templatesForMaterial(materialId: MaterialId): EasyTemplateDef[] {
  return EASY_TEMPLATES.filter(
    (t) => t.materials === "all" || t.materials.includes(materialId),
  );
}
