/**
 * Unit conversion kernel.
 *
 * Millimeters are the canonical unit for every dimension in Forge Labels.
 * Documents, presets, and geometry never store screen pixels or display
 * units — those are derived here, in exactly one place, so physical print
 * accuracy cannot drift between the editor, exports, and imposition.
 */

export type Unit = "mm" | "cm" | "in";

export const MM_PER_INCH = 25.4;
export const MM_PER_CM = 10;
export const PT_PER_INCH = 72;

export const UNIT_LABELS: Record<Unit, string> = {
  mm: "mm",
  cm: "cm",
  in: "in",
};

/** Convert a value in the given display unit to millimeters. */
export function toMm(value: number, unit: Unit): number {
  switch (unit) {
    case "mm":
      return value;
    case "cm":
      return value * MM_PER_CM;
    case "in":
      return value * MM_PER_INCH;
  }
}

/** Convert millimeters to the given display unit. */
export function fromMm(mm: number, unit: Unit): number {
  switch (unit) {
    case "mm":
      return mm;
    case "cm":
      return mm / MM_PER_CM;
    case "in":
      return mm / MM_PER_INCH;
  }
}

/** Millimeters → PDF points (1 pt = 1/72 in). Exact, no rounding. */
export function mmToPt(mm: number): number {
  return (mm / MM_PER_INCH) * PT_PER_INCH;
}

/** PDF points → millimeters. */
export function ptToMm(pt: number): number {
  return (pt / PT_PER_INCH) * MM_PER_INCH;
}

/** Millimeters → raster pixels at a given DPI. Not rounded. */
export function mmToPx(mm: number, dpi: number): number {
  return (mm / MM_PER_INCH) * dpi;
}

/** Raster pixels at a given DPI → millimeters. */
export function pxToMm(px: number, dpi: number): number {
  return (px / dpi) * MM_PER_INCH;
}

/** Integer pixel count for a physical length at a DPI (what exporters emit). */
export function mmToPxExact(mm: number, dpi: number): number {
  return Math.round(mmToPx(mm, dpi));
}

/** Typographic points → millimeters (font sizes). */
export function fontPtToMm(pt: number): number {
  return ptToMm(pt);
}

/** Round to a sane precision for storing mm values (0.001 mm). */
export function roundMm(mm: number): number {
  return Math.round(mm * 1000) / 1000;
}

/** Decimal places conventionally shown per display unit. */
export const UNIT_DISPLAY_DECIMALS: Record<Unit, number> = {
  mm: 1,
  cm: 2,
  in: 3,
};

/** Format a millimeter value in a display unit, e.g. `formatMm(76.97, "in") → "3.03 in"`. */
export function formatMm(
  mm: number,
  unit: Unit,
  options?: { decimals?: number; suffix?: boolean },
): string {
  const decimals = options?.decimals ?? UNIT_DISPLAY_DECIMALS[unit];
  const value = fromMm(mm, unit).toFixed(decimals);
  return options?.suffix === false ? value : `${value} ${UNIT_LABELS[unit]}`;
}

/** Parse a user-entered value in a display unit into millimeters. Returns null for invalid input. */
export function parseToMm(input: string, unit: Unit): number | null {
  const value = Number.parseFloat(input.replace(",", "."));
  if (!Number.isFinite(value)) return null;
  return toMm(value, unit);
}
