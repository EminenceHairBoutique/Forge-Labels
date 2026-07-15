import type { EasyTemplateDef } from "./types";
import { defineTemplate } from "./types";

/**
 * Vial-specific templates: layouts tuned to ONE container's real label
 * geometry and locked to it via `compatibleVialTypes` — the wizard,
 * browser, and recommender only offer them when the project actually
 * uses that vial, and the validation matrix builds them on exactly the
 * geometries they can appear on.
 */

export const CRIMP_TEMPLATES: readonly EasyTemplateDef[] = [
  // 10 mL crimp-top injection vial (Ø 23.75 mm × 32 mm wall → ≈ 71.6 × 28 mm
  // full wrap): a multiple-dose pharma label — identity block on the left,
  // dose data sheet on the right, exactly how the printed originals read.
  defineTemplate({
    id: "crimp-dose",
    name: "Crimp Dose",
    family: "crimp-dose",
    familyName: "Crimp Dose",
    category: ["clinical", "laboratory"],
    mood: ["dose", "pharma", "vial-fitted"],
    vibe: { clinical: 3, minimal: 1 },
    colorMode: "light",
    density: "detailed",
    pairingId: "pharmaceutical",
    compatibleVialTypes: ["10ml-crimp"],
    compatibleVolumesMl: [10],
    recommendedGlass: ["clear", "amber", "cobalt"],
    featured: true,
    minHeightMm: 20,
    minWidthMm: 55,
    align: "left",
    split: { ratio: 0.52, divider: true },
    rows: [
      { slot: "brand", zone: "header", font: "body", weight: 600, sizeFactor: 0.052, minPt: 4.5, maxLines: 1, color: "muted", letterSpacingEm: 0.14, casing: "uppercase" },
      { slot: "product-name", zone: "hero", font: "display", sizeFactor: 0.15, minPt: 7, maxLines: 2, color: "text" },
      { slot: "subtitle", zone: "hero", font: "body", sizeFactor: 0.048, minPt: 4, maxLines: 1, color: "muted", spacingBefore: 0.6 },
      { slot: "strength", zone: "hero", font: "body", weight: 600, sizeFactor: 0.06, minPt: 4.5, maxLines: 1, color: "accent", chip: "outline", spacingBefore: 0.9 },
      { slot: "warning", zone: "footer", font: "body", emphasis: true, sizeFactor: 0.042, minPt: 4, maxLines: 2, color: "text", spacingBefore: 0.4 },
      { slot: "website", zone: "footer", font: "body", sizeFactor: 0.044, minPt: 4, maxLines: 1, color: "muted", spacingBefore: 0.4 },
      { slot: "verification", zone: "footer", font: "technical", sizeFactor: 0.042, minPt: 4, maxLines: 1, color: "muted", spacingBefore: 0.25 },
      { slot: "volume", zone: "header", font: "technical", weight: 600, sizeFactor: 0.048, minPt: 4, maxLines: 1, color: "text", column: "right" },
      { slot: "description", zone: "hero", font: "body", sizeFactor: 0.044, minPt: 4, maxLines: 2, color: "muted", column: "right" },
      { slot: "ingredients", zone: "footer", font: "body", sizeFactor: 0.042, minPt: 4, maxLines: 3, color: "muted", column: "right" },
      { slot: "directions", zone: "footer", font: "body", sizeFactor: 0.042, minPt: 4, maxLines: 2, color: "muted", column: "right", spacingBefore: 0.3 },
      { slot: "storage", zone: "footer", font: "body", sizeFactor: 0.042, minPt: 4, maxLines: 1, color: "muted", column: "right", spacingBefore: 0.3 },
      { slot: "lot", zone: "footer", font: "technical", sizeFactor: 0.042, minPt: 4, maxLines: 1, color: "muted", column: "right", spacingBefore: 0.4 },
      { slot: "expiry", zone: "footer", font: "technical", sizeFactor: 0.042, minPt: 4, maxLines: 1, color: "muted", column: "right", spacingBefore: 0.25 },
    ],
    codeCorner: "bottom-right",
    decor: [
      { kind: "divider", after: "brand", widthFactor: 1, strokePt: 0.8, fill: { role: "border" } },
    ],
    materials: ["plain", "matte", "glossy", "clear"],
  }),
] as const;
