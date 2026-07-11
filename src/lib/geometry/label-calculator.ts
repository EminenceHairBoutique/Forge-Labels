/**
 * Label sizing calculator.
 *
 * Given a vial's measured dimensions and a label style, computes the exact
 * label dimensions, bleed/safe zones, wrap coverage, and print guidance.
 *
 * All inputs and outputs are millimeters (see units.ts). Pure functions —
 * no I/O, no rounding except via explicit helpers, fully unit-tested.
 */

export type LabelStyle =
  | "full-wrap"
  | "partial-wrap"
  | "front-only"
  | "front-back"
  | "neck-band"
  | "cap-circle";

export const LABEL_STYLE_LABELS: Record<LabelStyle, string> = {
  "full-wrap": "Full wrap",
  "partial-wrap": "Partial wrap",
  "front-only": "Front only",
  "front-back": "Front & back",
  "neck-band": "Tamper-evident neck band",
  "cap-circle": "Cap sticker",
};

export interface LabelCalcInput {
  /** Vial body diameter at the label area. */
  diameterMm: number;
  /** Height of the straight (cylindrical) wall available for a label. */
  straightWallHeightMm: number;
  style: LabelStyle;
  /**
   * Full wrap: distance between the two label ends once wrapped.
   * Positive = visible gap, negative = overlap, 0 = butt seam.
   * Default 3 mm.
   */
  gapMm?: number;
  /** Partial wrap: fraction of the circumference covered (0–1). Default 0.6. */
  coverageRatio?: number;
  /** Front-only / front-back: panel width as a fraction of circumference (0–0.5). Default 0.4. */
  panelRatio?: number;
  /** Height shaved off the straight wall top + bottom combined. Default 4 mm (2 mm each side). */
  verticalMarginMm?: number;
  /** Explicit label height override (still validated against the wall height). */
  heightMm?: number;
  /** Bleed extended past the trim on every side. Default 2 mm. */
  bleedMm?: number;
  /** Safe zone inset from the trim on every side. Default 3 mm. */
  safeMm?: number;
  /** Neck band: neck diameter (defaults to body diameter — measure the neck!). */
  neckDiameterMm?: number;
  /** Neck band height. Default 10 mm. */
  neckBandHeightMm?: number;
  /** Cap sticker: cap top diameter (defaults to body diameter). */
  capDiameterMm?: number;
}

export type CalcIssueSeverity = "error" | "warning" | "info";

export interface CalcIssue {
  code:
    | "invalid-diameter"
    | "invalid-wall-height"
    | "invalid-result"
    | "overlap-seam"
    | "tight-seam"
    | "height-exceeds-wall"
    | "tight-curvature"
    | "very-small-label"
    | "wide-gap"
    | "measure-vial";
  severity: CalcIssueSeverity;
  message: string;
}

export interface LabelCalcResult {
  style: LabelStyle;
  circumferenceMm: number;
  /** Trim (finished label) size. */
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  safeMm: number;
  /** Trim + bleed on both sides — the artwork canvas size. */
  totalWidthMm: number;
  totalHeightMm: number;
  /** Area inside the safe zone. */
  safeWidthMm: number;
  safeHeightMm: number;
  /** Fraction of circumference the label covers (wrap styles). */
  coverageRatio: number;
  /** Gap between label ends when wrapped; negative = overlap. */
  seamGapMm: number | null;
  /** Number of identical panels this style needs (front-back = 2). */
  panels: 1 | 2;
  printableAreaCm2: number;
  recommendedMinFontPt: number;
  recommendedDpi: number;
  issues: CalcIssue[];
}

export const DEFAULT_GAP_MM = 3;
export const DEFAULT_BLEED_MM = 2;
export const DEFAULT_SAFE_MM = 3;
export const DEFAULT_VERTICAL_MARGIN_MM = 4;
export const DEFAULT_COVERAGE_RATIO = 0.6;
export const DEFAULT_PANEL_RATIO = 0.4;
export const DEFAULT_NECK_BAND_HEIGHT_MM = 10;

export function circumference(diameterMm: number): number {
  return diameterMm * Math.PI;
}

export function calculateLabel(input: LabelCalcInput): LabelCalcResult {
  const issues: CalcIssue[] = [];
  const bleedMm = input.bleedMm ?? DEFAULT_BLEED_MM;
  const safeMm = input.safeMm ?? DEFAULT_SAFE_MM;

  if (!(input.diameterMm > 0) || !Number.isFinite(input.diameterMm)) {
    issues.push({
      code: "invalid-diameter",
      severity: "error",
      message: "Vial diameter must be a positive number.",
    });
  }
  if (
    !(input.straightWallHeightMm > 0) ||
    !Number.isFinite(input.straightWallHeightMm)
  ) {
    issues.push({
      code: "invalid-wall-height",
      severity: "error",
      message: "Straight-wall height must be a positive number.",
    });
  }
  if (issues.some((i) => i.severity === "error")) {
    return emptyResult(input.style, bleedMm, safeMm, issues);
  }

  const bodyCircumference = circumference(input.diameterMm);
  const verticalMargin = input.verticalMarginMm ?? DEFAULT_VERTICAL_MARGIN_MM;

  let widthMm: number;
  let heightMm: number;
  let coverageRatio: number;
  let seamGapMm: number | null = null;
  let panels: 1 | 2 = 1;
  let circ = bodyCircumference;

  const defaultHeight = Math.max(input.straightWallHeightMm - verticalMargin, 0);

  switch (input.style) {
    case "full-wrap": {
      const gap = input.gapMm ?? DEFAULT_GAP_MM;
      widthMm = bodyCircumference - gap;
      heightMm = input.heightMm ?? defaultHeight;
      seamGapMm = gap;
      coverageRatio = widthMm / bodyCircumference;
      break;
    }
    case "partial-wrap": {
      coverageRatio = clamp(input.coverageRatio ?? DEFAULT_COVERAGE_RATIO, 0.05, 1);
      widthMm = bodyCircumference * coverageRatio;
      heightMm = input.heightMm ?? defaultHeight;
      seamGapMm = bodyCircumference - widthMm;
      break;
    }
    case "front-only": {
      const ratio = clamp(input.panelRatio ?? DEFAULT_PANEL_RATIO, 0.05, 0.5);
      widthMm = bodyCircumference * ratio;
      heightMm = input.heightMm ?? defaultHeight;
      coverageRatio = ratio;
      break;
    }
    case "front-back": {
      const ratio = clamp(input.panelRatio ?? DEFAULT_PANEL_RATIO, 0.05, 0.5);
      widthMm = bodyCircumference * ratio;
      heightMm = input.heightMm ?? defaultHeight;
      coverageRatio = ratio * 2;
      panels = 2;
      break;
    }
    case "neck-band": {
      const neckDiameter = input.neckDiameterMm ?? input.diameterMm;
      circ = circumference(neckDiameter);
      // Neck bands intentionally overlap themselves for tamper evidence.
      const overlap = 5;
      widthMm = circ + overlap;
      heightMm = input.neckBandHeightMm ?? DEFAULT_NECK_BAND_HEIGHT_MM;
      seamGapMm = -overlap;
      coverageRatio = widthMm / circ;
      break;
    }
    case "cap-circle": {
      const capDiameter = input.capDiameterMm ?? input.diameterMm;
      // Inset 1 mm from the cap edge on each side.
      widthMm = Math.max(capDiameter - 2, 0);
      heightMm = widthMm;
      coverageRatio = 1;
      break;
    }
  }

  if (!(widthMm > 0) || !(heightMm > 0)) {
    issues.push({
      code: "invalid-result",
      severity: "error",
      message:
        "The resulting label has no printable size. Check the diameter, gap, and height inputs.",
    });
    return emptyResult(input.style, bleedMm, safeMm, issues);
  }

  // --- Guidance ---------------------------------------------------------
  const isWrap = input.style === "full-wrap" || input.style === "partial-wrap";
  const isCylinderLabel = input.style !== "cap-circle";

  if (seamGapMm !== null && input.style === "full-wrap") {
    if (seamGapMm < 0) {
      issues.push({
        code: "overlap-seam",
        severity: "warning",
        message: `The label ends will overlap by ${Math.abs(seamGapMm).toFixed(1)} mm. Use overlap only with thin film materials, and keep critical content away from the seam.`,
      });
    } else if (seamGapMm < 2) {
      issues.push({
        code: "tight-seam",
        severity: "warning",
        message: `A ${seamGapMm.toFixed(1)} mm gap leaves little room for application error. 2–4 mm is easier to apply by hand.`,
      });
    } else if (seamGapMm > 10) {
      issues.push({
        code: "wide-gap",
        severity: "info",
        message: `The ${seamGapMm.toFixed(1)} mm gap will show a wide unlabeled stripe. Reduce the gap for near-full coverage.`,
      });
    }
  }

  if (isCylinderLabel && heightMm > input.straightWallHeightMm) {
    issues.push({
      code: "height-exceeds-wall",
      severity: "error",
      message: `Label height (${heightMm.toFixed(1)} mm) exceeds the straight-wall height (${input.straightWallHeightMm.toFixed(1)} mm). The label will wrinkle where the vial curves.`,
    });
  }

  if (isWrap && input.diameterMm < 15) {
    issues.push({
      code: "tight-curvature",
      severity: "warning",
      message:
        "Diameters under 15 mm are demanding to wrap: stiff or thick label stock may lift or wrinkle. Use a thin, flexible material.",
    });
  }

  if (heightMm < 10 || widthMm < 15) {
    issues.push({
      code: "very-small-label",
      severity: "warning",
      message:
        "This label is very small. Keep text at or above the minimum font size and avoid fine detail.",
    });
  }

  issues.push({
    code: "measure-vial",
    severity: "info",
    message:
      "Vials of the same nominal volume vary between manufacturers. Measure your exact vial (or confirm the manufacturer drawing) before printing a full run.",
  });

  const safeWidthMm = Math.max(widthMm - 2 * safeMm, 0);
  const safeHeightMm = Math.max(heightMm - 2 * safeMm, 0);

  return {
    style: input.style,
    circumferenceMm: circ,
    widthMm,
    heightMm,
    bleedMm,
    safeMm,
    totalWidthMm: widthMm + 2 * bleedMm,
    totalHeightMm: heightMm + 2 * bleedMm,
    safeWidthMm,
    safeHeightMm,
    coverageRatio,
    seamGapMm,
    panels,
    printableAreaCm2: (widthMm * heightMm) / 100,
    recommendedMinFontPt: heightMm < 15 ? 4 : 5,
    recommendedDpi: widthMm < 40 || heightMm < 15 ? 600 : 300,
    issues,
  };
}

function emptyResult(
  style: LabelStyle,
  bleedMm: number,
  safeMm: number,
  issues: CalcIssue[],
): LabelCalcResult {
  return {
    style,
    circumferenceMm: 0,
    widthMm: 0,
    heightMm: 0,
    bleedMm,
    safeMm,
    totalWidthMm: 0,
    totalHeightMm: 0,
    safeWidthMm: 0,
    safeHeightMm: 0,
    coverageRatio: 0,
    seamGapMm: null,
    panels: 1,
    printableAreaCm2: 0,
    recommendedMinFontPt: 5,
    recommendedDpi: 300,
    issues,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
