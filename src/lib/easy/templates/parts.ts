import type { ColorRole, RowDef, ZoneId } from "./types";

/**
 * Row-building helpers for the template library. These are AUTHORING
 * shorthand, not layout logic — every template still hand-tunes sizes,
 * spacing, casing, and structure, and every template passes the §21
 * validation matrix individually. Structural distinctness is enforced by
 * the layout-DNA uniqueness test.
 */

type RowOverrides = Partial<RowDef>;

export function brandCaps(overrides: RowOverrides = {}): RowDef {
  return {
    slot: "brand",
    zone: "header",
    font: "body",
    emphasis: true,
    sizeFactor: 0.055,
    minPt: 4.5,
    maxLines: 1,
    color: "muted",
    letterSpacingEm: 0.16,
    casing: "uppercase",
    ...overrides,
  };
}

/** Brand as the FOOTER sign-off (brand-below layouts). */
export function brandBottom(overrides: RowOverrides = {}): RowDef {
  return {
    slot: "brand",
    zone: "footer",
    font: "body",
    emphasis: true,
    sizeFactor: 0.05,
    minPt: 4.5,
    maxLines: 1,
    color: "text",
    letterSpacingEm: 0.2,
    casing: "uppercase",
    ...overrides,
  };
}

export function productHero(sizeFactor: number, overrides: RowOverrides = {}): RowDef {
  return {
    slot: "product-name",
    zone: "hero",
    font: "display",
    sizeFactor,
    minPt: sizeFactor >= 0.2 ? 8.5 : 7,
    maxLines: 2,
    color: "text",
    ...overrides,
  };
}

export function subtitleRow(overrides: RowOverrides = {}): RowDef {
  return {
    slot: "subtitle",
    zone: "hero",
    font: "body",
    sizeFactor: 0.05,
    minPt: 4,
    maxLines: 1,
    color: "muted",
    spacingBefore: 0.8,
    ...overrides,
  };
}

/** Kicker: subtitle ABOVE the product name, small caps. */
export function kickerSubtitle(overrides: RowOverrides = {}): RowDef {
  return {
    slot: "subtitle",
    zone: "hero",
    font: "body",
    sizeFactor: 0.046,
    minPt: 4,
    maxLines: 1,
    color: "accent",
    letterSpacingEm: 0.2,
    casing: "uppercase",
    ...overrides,
  };
}

export function strengthRow(overrides: RowOverrides = {}): RowDef {
  return {
    slot: "strength",
    zone: "hero",
    font: "body",
    emphasis: true,
    sizeFactor: 0.065,
    minPt: 4.5,
    maxLines: 1,
    color: "accent",
    spacingBefore: 1,
    ...overrides,
  };
}

export function volumeRow(zone: ZoneId = "footer", overrides: RowOverrides = {}): RowDef {
  return {
    slot: "volume",
    zone,
    font: "body",
    sizeFactor: 0.048,
    minPt: 4,
    maxLines: 1,
    color: "muted",
    ...overrides,
  };
}

/** The standard small-print block (description → website). */
export function detailBlock(color: ColorRole = "muted"): RowDef[] {
  return [
    { slot: "description", zone: "hero", font: "body", sizeFactor: 0.055, minPt: 4.5, maxLines: 3, color: "muted", spacingBefore: 1.4 },
    { slot: "ingredients", zone: "footer", font: "body", sizeFactor: 0.045, minPt: 4, maxLines: 3, color },
    { slot: "directions", zone: "footer", font: "body", sizeFactor: 0.045, minPt: 4, maxLines: 2, color, spacingBefore: 0.6 },
    { slot: "storage", zone: "footer", font: "body", sizeFactor: 0.045, minPt: 4, maxLines: 1, color, spacingBefore: 0.6 },
    { slot: "warning", zone: "footer", font: "body", emphasis: true, sizeFactor: 0.045, minPt: 4, maxLines: 2, color: "text", spacingBefore: 0.6 },
    { slot: "lot", zone: "footer", font: "technical", sizeFactor: 0.045, minPt: 4, maxLines: 1, color, spacingBefore: 0.8 },
    { slot: "expiry", zone: "footer", font: "technical", sizeFactor: 0.045, minPt: 4, maxLines: 1, color, spacingBefore: 0.3 },
    { slot: "verification", zone: "footer", font: "technical", sizeFactor: 0.042, minPt: 4, maxLines: 1, color, spacingBefore: 0.3 },
    { slot: "website", zone: "footer", font: "body", sizeFactor: 0.05, minPt: 4, maxLines: 1, color, spacingBefore: 0.8 },
  ];
}

/** Tighter small-print block for data-sheet layouts. */
export function tightDetailBlock(color: ColorRole = "muted"): RowDef[] {
  return [
    { slot: "description", zone: "footer", font: "body", sizeFactor: 0.045, minPt: 4, maxLines: 2, color, spacingBefore: 0.35 },
    { slot: "ingredients", zone: "footer", font: "body", sizeFactor: 0.042, minPt: 4, maxLines: 3, color, spacingBefore: 0.35 },
    { slot: "directions", zone: "footer", font: "body", sizeFactor: 0.042, minPt: 4, maxLines: 2, color, spacingBefore: 0.3 },
    { slot: "storage", zone: "footer", font: "body", sizeFactor: 0.042, minPt: 4, maxLines: 1, color, spacingBefore: 0.3 },
    { slot: "warning", zone: "footer", font: "body", emphasis: true, sizeFactor: 0.042, minPt: 4, maxLines: 2, color: "text", spacingBefore: 0.3 },
    { slot: "lot", zone: "footer", font: "technical", sizeFactor: 0.042, minPt: 4, maxLines: 1, color, spacingBefore: 0.4 },
    { slot: "expiry", zone: "footer", font: "technical", sizeFactor: 0.042, minPt: 4, maxLines: 1, color, spacingBefore: 0.25 },
    { slot: "verification", zone: "footer", font: "technical", sizeFactor: 0.042, minPt: 4, maxLines: 1, color, spacingBefore: 0.25 },
    { slot: "website", zone: "footer", font: "body", sizeFactor: 0.044, minPt: 4, maxLines: 1, color, spacingBefore: 0.4 },
  ];
}

/** Lot/expiry pinned in the header (lab record look). */
export function techHeader(): RowDef[] {
  return [
    { slot: "lot", zone: "header", font: "technical", sizeFactor: 0.044, minPt: 4, maxLines: 1, color: "muted", spacingBefore: 0.4 },
    { slot: "expiry", zone: "header", font: "technical", sizeFactor: 0.044, minPt: 4, maxLines: 1, color: "muted", spacingBefore: 0.25 },
  ];
}
