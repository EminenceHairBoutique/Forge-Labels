import { brandCaps, productHero, volumeRow } from "./parts";
import type { EasyTemplateDef, RowDef } from "./types";
import { defineTemplate } from "./types";

/**
 * Hex Badge family — modeled on a user-supplied pharma brand system:
 * tracked brand line over a hexagon initials badge, a heavyweight product
 * name, a full-width rule, then a technical data block. Layout ONLY —
 * brand names, products, ingredients, and any claims are the user's field
 * text (reviewed by the compliance pass), the badge letters come from the
 * abbreviation field, and an uploaded logo replaces nothing it shouldn't.
 * On holographic material the film + readability panels come from the
 * material rules, matching the reference's foil-and-white-panel look.
 */

function dataRow(slot: RowDef["slot"], overrides: Partial<RowDef> = {}): RowDef {
  return {
    slot,
    zone: "footer",
    font: "technical",
    sizeFactor: 0.044,
    minPt: 4,
    maxLines: 1,
    color: "muted",
    spacingBefore: 0.3,
    ...overrides,
  };
}

export const HEX_BADGE_TEMPLATES: readonly EasyTemplateDef[] = [
  // The centered "elixir" layout: brand arc position → hex badge →
  // display product name → subtitle → rule → data block.
  defineTemplate({
    id: "hex-elixir",
    name: "Hex Elixir",
    family: "hex-badge",
    familyName: "Hex Badge",
    category: ["pharmaceutical", "clinical", "holographic"],
    mood: ["badge", "centered", "branded"],
    vibe: { clinical: 2, premium: 2, bold: 1 },
    colorMode: "light",
    density: "standard",
    pairingId: "contemporary-skincare",
    recommendedGlass: ["clear", "cobalt"],
    featured: true,
    minHeightMm: 18,
    align: "center",
    rows: [
      brandCaps({ align: "center", color: "accent", letterSpacingEm: 0.18 }),
      // The badge: the abbreviation ("ZH"-style initials) on a hexagon.
      { slot: "abbreviation", zone: "header", font: "display", weight: 700, sizeFactor: 0.075, minPt: 4.5, maxLines: 1, color: "onAccent", align: "center", spacingBefore: 2.6, minLabelHeightMm: 22 },
      productHero(0.19, { align: "center", minPt: 8, spacingBefore: 2.6 }),
      { slot: "subtitle", zone: "hero", font: "body", sizeFactor: 0.06, minPt: 4, maxLines: 1, color: "text", align: "center", spacingBefore: 0.7 },
      volumeRow("footer", { align: "center", weight: 600, color: "text", spacingBefore: 0.6 }),
      { slot: "ingredients", zone: "footer", font: "body", sizeFactor: 0.044, minPt: 4, maxLines: 3, color: "muted", align: "center", spacingBefore: 0.45 },
      dataRow("lot", { align: "center", spacingBefore: 0.45 }),
      dataRow("expiry", { align: "center" }),
      { slot: "notice", zone: "footer", font: "body", emphasis: true, sizeFactor: 0.042, minPt: 4, maxLines: 2, color: "text", letterSpacingEm: 0.08, casing: "uppercase", align: "center", spacingBefore: 0.5 },
      { slot: "contact", zone: "footer", font: "body", sizeFactor: 0.042, minPt: 4, maxLines: 1, color: "muted", align: "center", spacingBefore: 0.45 },
    ],
    codeCorner: "bottom-right",
    decor: [
      { kind: "medallion", shape: "hexagon", slot: "abbreviation", sizeFactor: 0.21, fill: { role: "accent" }, minLabelHeightMm: 22 },
      { kind: "divider", after: "subtitle", widthFactor: 1, strokePt: 0.9, fill: { role: "accent" } },
    ],
    materials: ["plain", "glossy", "matte", "holographic"],
  }),
  // The banded data layout: identity block beside the hex badge, then a
  // wide technical panel — the film/panel split comes from the material.
  defineTemplate({
    id: "hex-data-band",
    name: "Hex Data Band",
    family: "hex-badge",
    familyName: "Hex Badge",
    category: ["pharmaceutical", "laboratory", "holographic"],
    mood: ["badge", "banded", "data-panel"],
    vibe: { clinical: 3, bold: 1 },
    colorMode: "light",
    density: "standard",
    pairingId: "modern-clinical",
    recommendedGlass: ["clear", "amber"],
    minHeightMm: 20,
    minWidthMm: 55,
    align: "left",
    split: { ratio: 0.58 },
    rows: [
      brandCaps({ color: "accent", letterSpacingEm: 0.14 }),
      productHero(0.17, { minPt: 8, maxLines: 2 }),
      { slot: "abbreviation", zone: "header", font: "display", weight: 800, sizeFactor: 0.07, minPt: 4.5, maxLines: 1, color: "onAccent", column: "right", align: "center", spacingBefore: 2.2, minLabelHeightMm: 22 },
      { slot: "warning", zone: "header", font: "body", emphasis: true, sizeFactor: 0.044, minPt: 4, maxLines: 2, color: "text", column: "right", casing: "uppercase", letterSpacingEm: 0.04, spacingBefore: 2.4 },
      volumeRow("hero", { weight: 600, color: "text", spacingBefore: 1 }),
      { slot: "ingredients", zone: "footer", font: "body", sizeFactor: 0.044, minPt: 4, maxLines: 3, color: "muted" },
      dataRow("lot", { spacingBefore: 0.4 }),
      dataRow("expiry"),
      { slot: "notice", zone: "footer", font: "body", emphasis: true, sizeFactor: 0.042, minPt: 4, maxLines: 2, color: "text", letterSpacingEm: 0.08, casing: "uppercase", spacingBefore: 0.5 },
      { slot: "contact", zone: "footer", font: "body", sizeFactor: 0.042, minPt: 4, maxLines: 1, color: "muted", spacingBefore: 0.4 },
    ],
    codeCorner: "bottom-right",
    decor: [
      { kind: "medallion", shape: "hexagon", slot: "abbreviation", sizeFactor: 0.2, fill: { role: "accent" }, minLabelHeightMm: 22 },
      { kind: "divider", after: "volume", widthFactor: 1, strokePt: 0.8, fill: { role: "border" } },
    ],
    materials: ["plain", "glossy", "matte", "holographic"],
  }),
] as const;
