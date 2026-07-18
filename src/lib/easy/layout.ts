import type { TextObject } from "@/lib/document/schema";

/**
 * Easy Creator layout math — pure and injectable so the engine is
 * node-testable. In the browser the measurer is Konva's real text metrics
 * (`measureTextHeightMm`); in tests and for first-pass estimates it's the
 * approximation below.
 */

export const PT_TO_MM = 25.4 / 72;

/** Returns the rendered height (mm) of a text object at its current props. */
export type TextMeasure = (obj: TextObject) => number;

/**
 * Font-metric-free estimate: average glyph advance ≈ 0.54 em for the
 * bundled sans faces (serifs and mono land close enough for layout
 * purposes; the browser pass re-measures with real metrics).
 */
export function approximateMeasure(obj: TextObject): number {
  const fontMm = obj.fontSizePt * PT_TO_MM;
  const spacing = 1 + (obj.letterSpacingEm ?? 0);
  const charW = fontMm * 0.54 * spacing;
  const perLine = Math.max(1, Math.floor(obj.widthMm / charW));
  const text = obj.textTransform === "uppercase" ? obj.text.toUpperCase() : obj.text;
  let lines = 0;
  for (const paragraph of text.split("\n")) {
    lines += Math.max(1, Math.ceil(paragraph.length / perLine));
  }
  return Math.max(lines * fontMm * obj.lineHeight, 0.1);
}

export interface ArcSpec {
  radiusMm: number;
  /** The arc center sits this far below the ink band's top edge. */
  centerFromTopMm: number;
  /** Vertical space the bowed row occupies (sagitta + ascent + pad). */
  bandHeightMm: number;
  /** Horizontal ink extent (chord plus rotated end-glyph overhang). */
  inkWidthMm: number;
}

/**
 * Geometry for a row bowed upward along a circular arc (pharma-seal brand
 * lines). `requestedDeg` is the MOST the run may subtend; the solver
 * flattens the bow (bigger radius) until the band fits `bandBudgetMm` and
 * returns null when no meaningful bow fits — callers then keep the row
 * straight. Pure and estimate-driven: the engine lays out and the
 * validator boxes with the same numbers, so the two cannot disagree.
 */
export function solveArc(
  runLengthMm: number,
  requestedDeg: number,
  fontSizePt: number,
  bandBudgetMm: number,
): ArcSpec | null {
  const fontMm = fontSizePt * PT_TO_MM;
  const ascentMm = fontMm * 0.8;
  const padMm = fontMm * 0.25;
  const sagittaMax = bandBudgetMm - ascentMm - padMm;
  // A bow shallower than ~half the cap height reads as a mistake, not an
  // arch — below that (or on runs too short to sweep), stay straight.
  if (runLengthMm < 8 || sagittaMax < Math.max(0.9, fontMm * 0.55)) return null;
  // Small-angle inversion of sagitta = (L/θ)·(1 − cos(θ/2)) ≈ L·θ/8. The
  // approximation overestimates the sagitta, so the exact band computed
  // below always comes in at or under budget.
  const budgetTheta = (8 * sagittaMax) / runLengthMm;
  const theta = Math.min((Math.max(requestedDeg, 0) * Math.PI) / 180, budgetTheta, 2.6);
  if (theta < 0.35) return null;
  const radiusMm = runLengthMm / theta;
  if (radiusMm > 300) return null;
  const half = theta / 2;
  return {
    radiusMm,
    centerFromTopMm: radiusMm + ascentMm,
    bandHeightMm: radiusMm * (1 - Math.cos(half)) + ascentMm + padMm,
    inkWidthMm: 2 * (radiusMm + ascentMm) * Math.sin(half) + fontMm * 0.3,
  };
}

export interface FitResult {
  fontSizePt: number;
  heightMm: number;
  /** True when the row hit its minimum size and may still be tight. */
  atMinimum: boolean;
}

/**
 * Shrink a row's font until its measured height fits `maxLines` (and an
 * optional hard height cap), never going below `minPt`. Guarantees text
 * can't silently overflow its column: at the floor, the caller records a
 * plain-language note instead.
 */
export function fitRow(
  base: TextObject,
  options: { prefPt: number; minPt: number; maxLines: number; maxHeightMm?: number },
  measure: TextMeasure,
): FitResult {
  let pt = options.prefPt;
  for (let i = 0; i < 24; i++) {
    const candidate: TextObject = { ...base, fontSizePt: pt };
    const heightMm = measure(candidate);
    const lineMm = pt * PT_TO_MM * base.lineHeight;
    const maxMm = Math.min(
      options.maxLines * lineMm + 0.2,
      options.maxHeightMm ?? Infinity,
    );
    if (heightMm <= maxMm || pt <= options.minPt) {
      return { fontSizePt: pt, heightMm, atMinimum: pt <= options.minPt && heightMm > maxMm };
    }
    pt = Math.max(options.minPt, pt * 0.92);
  }
  const heightMm = measure({ ...base, fontSizePt: pt });
  return { fontSizePt: pt, heightMm, atMinimum: true };
}

export interface StackItem {
  heightMm: number;
  /** Extra space above this item (mm). */
  spacingBeforeMm: number;
}

/**
 * Vertical zone stacking: header items hug the top, footer items hug the
 * bottom, hero items center in the space that remains. Returns the y of
 * each item's TOP edge, in input order (header…, hero…, footer…).
 */
export function stackZones(
  zones: { header: StackItem[]; hero: StackItem[]; footer: StackItem[] },
  bounds: { topMm: number; bottomMm: number },
): { header: number[]; hero: number[]; footer: number[] } {
  const total = (items: StackItem[]) =>
    items.reduce((sum, item) => sum + item.spacingBeforeMm + item.heightMm, 0);

  const place = (items: StackItem[], startY: number): number[] => {
    const tops: number[] = [];
    let y = startY;
    for (const item of items) {
      y += item.spacingBeforeMm;
      tops.push(y);
      y += item.heightMm;
    }
    return tops;
  };

  const headerTops = place(zones.header, bounds.topMm);
  const headerBottom =
    zones.header.length > 0 ? bounds.topMm + total(zones.header) : bounds.topMm;

  const footerHeight = total(zones.footer);
  const footerTop = bounds.bottomMm - footerHeight;
  const footerTops = place(zones.footer, footerTop);

  const heroHeight = total(zones.hero);
  const heroSpace = footerTop - headerBottom;
  const heroStart = headerBottom + Math.max((heroSpace - heroHeight) / 2, 0);
  const heroTops = place(zones.hero, heroStart);

  return { header: headerTops, hero: heroTops, footer: footerTops };
}

/**
 * Global squeeze: when the stacked content is taller than the available
 * space, scale every row's font proportionally (bounded) so the layout
 * always fits. Returns the factor to apply (1 = no squeeze needed).
 */
export function squeezeFactor(
  contentHeightMm: number,
  availableMm: number,
  floor = 0.55,
): number {
  if (contentHeightMm <= availableMm || contentHeightMm <= 0) return 1;
  return Math.max(availableMm / contentHeightMm, floor);
}
