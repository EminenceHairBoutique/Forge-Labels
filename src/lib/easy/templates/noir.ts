import { brandCaps, productHero } from "./parts";
import type { EasyTemplateDef, RowDef } from "./types";
import { defineTemplate } from "./types";

/**
 * Noir family — modeled on a user-supplied four-piece label system
 * (Core Black / Spectral / Cryogenic / Neural Grid): a premium research
 * layout built around a tracked brand line, a hexagon initials badge, a
 * heavyweight product name over a strength band, a compliance/storage
 * panel, and a LOT/MFG/EXP data stack beside the codes. Layout ONLY —
 * brand names, compounds, compositions, and every scientific value are
 * the user's field text (reviewed by the compliance pass, never
 * suggested). The four templates carry the system's four genuinely
 * different arrangements; the metallic, iridescent, and glow skins come
 * from materials + the noir palettes, not from baked-in artwork.
 */

const noticeRow = (overrides: Partial<RowDef> = {}): RowDef => ({
  slot: "notice",
  zone: "footer",
  font: "body",
  emphasis: true,
  sizeFactor: 0.042,
  minPt: 4,
  maxLines: 2,
  color: "text",
  letterSpacingEm: 0.08,
  casing: "uppercase",
  spacingBefore: 0.5,
  ...overrides,
});

const dataRow = (slot: RowDef["slot"], overrides: Partial<RowDef> = {}): RowDef => ({
  slot,
  zone: "hero",
  font: "technical",
  sizeFactor: 0.044,
  minPt: 4,
  maxLines: 1,
  color: "muted",
  spacingBefore: 0.35,
  ...overrides,
});

const badgeRow = (overrides: Partial<RowDef> = {}): RowDef => ({
  // The hexagon initials badge ("NP"-style) — letters from the
  // abbreviation field, hexagon from the slot-targeted medallion below.
  // Weight via `emphasis`: each pairing supplies its own heaviest cut.
  slot: "abbreviation",
  zone: "header",
  font: "display",
  emphasis: true,
  sizeFactor: 0.072,
  minPt: 4.5,
  maxLines: 1,
  color: "onAccent",
  align: "center",
  spacingBefore: 2.4,
  minLabelHeightMm: 22,
  ...overrides,
});

const strengthBand = (overrides: Partial<RowDef> = {}): RowDef => ({
  // The reference's metallic/blue strength band → an accent-filled chip.
  slot: "strength",
  zone: "hero",
  font: "body",
  emphasis: true,
  sizeFactor: 0.07,
  minPt: 4.5,
  maxLines: 1,
  color: "onAccent",
  chip: "fill",
  spacingBefore: 1.1,
  ...overrides,
});

const kickerRow = (overrides: Partial<RowDef> = {}): RowDef => ({
  // "LYOPHILIZED RESEARCH MATERIAL" — tracked caps under the name.
  slot: "subtitle",
  zone: "hero",
  font: "body",
  sizeFactor: 0.046,
  minPt: 4,
  maxLines: 1,
  color: "muted",
  letterSpacingEm: 0.22,
  casing: "uppercase",
  spacingBefore: 0.9,
  ...overrides,
});

export const NOIR_TEMPLATES: readonly EasyTemplateDef[] = [
  // Core Black: centered identity column beside the compliance + data
  // stack — the flagship arrangement of the system.
  defineTemplate({
    id: "noir-core",
    name: "Noir Core",
    family: "noir",
    familyName: "Noir",
    category: ["research", "pharmaceutical", "glossy"],
    mood: ["premium", "dark", "metallic", "badge"],
    vibe: { premium: 3, clinical: 2, luxury: 1 },
    colorMode: "dark",
    density: "detailed",
    pairingId: "grotesk-minimal",
    recommendedGlass: ["clear", "cobalt"],
    featured: true,
    minHeightMm: 20,
    minWidthMm: 55,
    align: "center",
    split: { ratio: 0.56, divider: true },
    rows: [
      brandCaps({ align: "center", color: "accent", letterSpacingEm: 0.22 }),
      badgeRow(),
      productHero(0.17, { align: "center", minPt: 8, maxLines: 2, spacingBefore: 2.2 }),
      strengthBand({ align: "center" }),
      kickerRow({ align: "center" }),
      { slot: "catalog", zone: "footer", font: "technical", sizeFactor: 0.044, minPt: 4, maxLines: 1, color: "muted", align: "center", spacingBefore: 0.5 },
      noticeRow({ zone: "header", column: "right", align: "left", spacingBefore: 0 }),
      { slot: "storage", zone: "header", font: "body", sizeFactor: 0.042, minPt: 4, maxLines: 3, color: "muted", column: "right", spacingBefore: 1.2 },
      dataRow("lot", { column: "right", spacingBefore: 1.4 }),
      dataRow("produced", { column: "right" }),
      dataRow("expiry", { column: "right" }),
      { slot: "verification", zone: "footer", font: "technical", sizeFactor: 0.042, minPt: 4, maxLines: 1, color: "accent", column: "right", spacingBefore: 0.5 },
      { slot: "website", zone: "footer", font: "body", sizeFactor: 0.044, minPt: 4, maxLines: 1, color: "muted", column: "right", spacingBefore: 0.35 },
    ],
    codeCorner: "bottom-right",
    decor: [
      { kind: "border", insetMm: 1.1, strokePt: 1, color: "border" },
      { kind: "divider", after: "brand", widthFactor: 0.5, strokePt: 0.7, fill: { role: "border" }, minLabelHeightMm: 22 },
      { kind: "medallion", shape: "hexagon", slot: "abbreviation", sizeFactor: 0.2, fill: { role: "accent" }, minLabelHeightMm: 22 },
    ],
    materials: ["plain", "glossy", "matte"],
  }),

  // Spectral: the iridescent one — a centered stack wrapped in the
  // material's film frame, badge over the name, data in the footer.
  defineTemplate({
    id: "noir-spectral",
    name: "Noir Spectral",
    family: "noir",
    familyName: "Noir",
    category: ["research", "holographic", "pharmaceutical"],
    mood: ["iridescent", "dark", "badge", "centered"],
    vibe: { premium: 2, futuristic: 2, clinical: 1 },
    colorMode: "dark",
    density: "standard",
    pairingId: "futuristic",
    recommendedGlass: ["clear", "cobalt"],
    minHeightMm: 18,
    align: "center",
    rows: [
      brandCaps({ align: "center", color: "accent", letterSpacingEm: 0.26 }),
      badgeRow({ spacingBefore: 1.5 }),
      productHero(0.17, { align: "center", minPt: 8, spacingBefore: 1.7 }),
      strengthBand({ align: "center", spacingBefore: 0.9 }),
      kickerRow({ align: "center", spacingBefore: 0.7 }),
      { slot: "catalog", zone: "footer", font: "technical", sizeFactor: 0.042, minPt: 4, maxLines: 1, color: "muted", align: "center" },
      dataRow("lot", { zone: "footer", align: "center", spacingBefore: 0.45 }),
      dataRow("expiry", { zone: "footer", align: "center", spacingBefore: 0.3 }),
      noticeRow({ align: "center" }),
      { slot: "verification", zone: "footer", font: "technical", sizeFactor: 0.042, minPt: 4, maxLines: 1, color: "accent", align: "center", spacingBefore: 0.4 },
    ],
    codeCorner: "bottom-right",
    decor: [
      { kind: "frame-effect", thicknessFactor: 0.05 },
      { kind: "medallion", shape: "hexagon", slot: "abbreviation", sizeFactor: 0.21, fill: { role: "accent" }, minLabelHeightMm: 22 },
      { kind: "divider", after: "subtitle", widthFactor: 0.66, strokePt: 0.7, fill: { role: "accent" } },
    ],
    materials: ["holographic", "plain", "glossy"],
  }),

  // Cryogenic: the light clinical flip — compliance panel LEFT, identity
  // column RIGHT, icy accent band.
  defineTemplate({
    id: "noir-cryo",
    name: "Noir Cryo",
    family: "noir",
    familyName: "Noir",
    category: ["research", "laboratory", "clinical"],
    mood: ["icy", "light", "data-panel", "badge"],
    vibe: { clinical: 3, premium: 1 },
    colorMode: "light",
    density: "detailed",
    pairingId: "modern-clinical",
    recommendedGlass: ["clear", "frosted"],
    minHeightMm: 20,
    minWidthMm: 55,
    align: "left",
    split: { ratio: 0.58, divider: true },
    rows: [
      brandCaps({ color: "accent", letterSpacingEm: 0.2 }),
      // Badge stays centered — the hexagon medallion centers on its
      // column, so left-aligned initials would sit beside it.
      badgeRow({ spacingBefore: 2 }),
      productHero(0.16, { minPt: 8, maxLines: 2, spacingBefore: 1.8 }),
      strengthBand({ align: "center" }),
      kickerRow(),
      { slot: "website", zone: "footer", font: "body", sizeFactor: 0.044, minPt: 4, maxLines: 1, color: "accent", spacingBefore: 0.5 },
      noticeRow({ zone: "header", column: "right", align: "left", spacingBefore: 0 }),
      dataRow("lot", { zone: "header", column: "right", spacingBefore: 1.2 }),
      dataRow("produced", { zone: "header", column: "right" }),
      dataRow("expiry", { zone: "header", column: "right" }),
      { slot: "storage", zone: "hero", font: "body", sizeFactor: 0.042, minPt: 4, maxLines: 3, color: "muted", column: "right", spacingBefore: 0.8 },
      { slot: "ingredients", zone: "footer", font: "body", sizeFactor: 0.042, minPt: 4, maxLines: 2, color: "muted", column: "right", spacingBefore: 0.4 },
      { slot: "catalog", zone: "footer", font: "technical", sizeFactor: 0.042, minPt: 4, maxLines: 1, color: "muted", column: "right", spacingBefore: 0.35 },
    ],
    codeCorner: "bottom-right",
    decor: [
      { kind: "border", insetMm: 1.1, strokePt: 1, color: "border" },
      { kind: "medallion", shape: "hexagon", slot: "abbreviation", sizeFactor: 0.19, fill: { role: "accent" }, minLabelHeightMm: 22 },
    ],
    materials: ["plain", "matte", "glossy"],
  }),

  // Neural Grid: the engineered one — data pinned in the header like a
  // spec sheet, corner brackets and a side rail instead of a full frame.
  defineTemplate({
    id: "noir-grid",
    name: "Noir Grid",
    family: "noir",
    familyName: "Noir",
    category: ["research", "biotechnology", "laboratory"],
    mood: ["technical", "dark", "circuit", "data-first"],
    vibe: { futuristic: 3, clinical: 2, bold: 1 },
    colorMode: "dark",
    density: "detailed",
    pairingId: "tech-lab",
    recommendedGlass: ["cobalt", "clear"],
    minHeightMm: 20,
    minWidthMm: 55,
    align: "left",
    split: { ratio: 0.6 },
    rows: [
      dataRow("lot", { zone: "header", spacingBefore: 0 }),
      dataRow("expiry", { zone: "header", spacingBefore: 0.25 }),
      brandCaps({ color: "accent", letterSpacingEm: 0.24, spacingBefore: 1.2 }),
      productHero(0.165, { minPt: 8, maxLines: 2, spacingBefore: 1.6 }),
      strengthBand({ align: "center" }),
      kickerRow(),
      noticeRow({ column: "right", zone: "header", align: "left", spacingBefore: 0 }),
      { slot: "storage", zone: "hero", font: "body", sizeFactor: 0.042, minPt: 4, maxLines: 3, color: "muted", column: "right", spacingBefore: 0.8 },
      { slot: "catalog", zone: "footer", font: "technical", sizeFactor: 0.042, minPt: 4, maxLines: 1, color: "muted", column: "right", spacingBefore: 0.4 },
      { slot: "verification", zone: "footer", font: "technical", sizeFactor: 0.042, minPt: 4, maxLines: 1, color: "accent", column: "right", spacingBefore: 0.35 },
      { slot: "website", zone: "footer", font: "body", sizeFactor: 0.042, minPt: 4, maxLines: 1, color: "muted", column: "right", spacingBefore: 0.35 },
    ],
    codeCorner: "bottom-right",
    decor: [
      { kind: "corners", lengthMm: 3, strokePt: 1, color: "accent", insetMm: 1.2 },
      { kind: "side-rail", edge: "left", insetMm: 0.9, strokePt: 1.1, color: "accent", minLabelHeightMm: 22 },
    ],
    materials: ["plain", "glossy"],
  }),
] as const;
