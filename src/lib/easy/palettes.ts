/**
 * Curated Easy Creator palettes. Every palette guarantees readable text by
 * construction: `text` on `bg` and `onAccent` on `accent` are picked at
 * ≥ 4.5:1 contrast, so beginners cannot land on unreadable combinations.
 * The contrast checker below guards the (optional) custom-color path.
 */

export interface EasyPalette {
  id: string;
  name: string;
  /** Label background. `null` means transparent — the material shows. */
  bg: string | null;
  text: string;
  muted: string;
  accent: string;
  onAccent: string;
  /** Dark palettes pair with light text and vice versa. */
  dark: boolean;
  /** Border/rule color — defaults to `muted` when unset. */
  border?: string;
  /**
   * QR foreground. Must stay near-black (≥ 8:1 on white) so codes scan —
   * `paletteQrColor` enforces the floor and falls back to #000.
   */
  qrColor?: string;
  /** Vial glass colors this palette looks best on (preview default + scoring). */
  glass?: readonly ("clear" | "amber" | "cobalt" | "frosted" | "opaque")[];
}

function p(
  id: string,
  name: string,
  bg: string | null,
  text: string,
  muted: string,
  accent: string,
  onAccent: string,
  dark = false,
  extra?: Pick<EasyPalette, "border" | "qrColor" | "glass">,
): EasyPalette {
  return { id, name, bg, text, muted, accent, onAccent, dark, ...extra };
}

/** Border color with the muted fallback. */
export function paletteBorder(palette: EasyPalette): string {
  return palette.border ?? palette.muted;
}

/** QR foreground, clamped to scannable-dark (≥ 8:1 against white). */
export function paletteQrColor(palette: EasyPalette): string {
  const candidate = palette.qrColor ?? "#000000";
  return contrastRatio(candidate, "#ffffff") >= 8 ? candidate : "#000000";
}

/** Suggested vial glass, best first — explicit hint or a dark/light default. */
export function paletteGlass(
  palette: EasyPalette,
): readonly ("clear" | "amber" | "cobalt" | "frosted" | "opaque")[] {
  return palette.glass ?? (palette.dark ? ["amber", "clear"] : ["clear", "amber"]);
}

export const EASY_PALETTES: readonly EasyPalette[] = [
  // --- Plain / clinical ------------------------------------------------------
  p("white-black", "White & black", "#ffffff", "#17171c", "#5c5c66", "#17171c", "#ffffff"),
  p("white-blue", "White & blue", "#ffffff", "#132a4c", "#4c6285", "#1d4ed8", "#ffffff"),
  p("white-green", "White & green", "#ffffff", "#173324", "#4e6656", "#0f766e", "#ffffff"),
  p("cream-brown", "Cream & brown", "#f6efe3", "#3a2b1c", "#7a6a56", "#8a5a2b", "#ffffff", false, { glass: ["amber", "clear"], qrColor: "#2c1a0e" }),
  p("gray-red", "Gray & red", "#f2f2f4", "#232329", "#5f5f68", "#b91c1c", "#ffffff"),
  p("black-white", "Black & white", "#141418", "#f5f5f7", "#a3a3ad", "#f5f5f7", "#141418", true),
  // --- Luxury / glossy -------------------------------------------------------
  p("gloss-black-gold", "Black & gold", "#101014", "#f2e8cf", "#b9ae90", "#d4af5f", "#141418", true),
  p("white-silver", "White & silver", "#fbfbfc", "#26262c", "#71717c", "#6f747f", "#ffffff"),
  p("deep-red-black", "Deep red & black", "#1c0f12", "#f6e7e9", "#c2a3a8", "#e11d48", "#ffffff", true),
  p("navy-white", "Navy & white", "#12233f", "#f4f7fb", "#9fb0c8", "#f4f7fb", "#12233f", true, { glass: ["cobalt", "clear"], qrColor: "#0a1526" }),
  p("emerald-gold", "Emerald & gold", "#0e2a22", "#eef4ee", "#9ab8ab", "#d4af5f", "#14241d", true),
  p("rose-cream", "Rose & cream", "#f9f1ec", "#4a2c33", "#8a6b72", "#b0566b", "#ffffff"),
  // --- Holographic pairings --------------------------------------------------
  p("holo-black", "Black & holographic", "#131318", "#f5f5f7", "#a3a3ad", "#cdd6f4", "#131318", true),
  p("holo-white", "White & holographic", "#ffffff", "#232330", "#6a6a78", "#6a58cf", "#ffffff"),
  p("silver-black", "Silver & black", "#e9eaee", "#1a1a20", "#565662", "#1a1a20", "#ffffff"),
  p("purple-prism", "Purple prism", "#231a3f", "#f1ecfd", "#b3a6d8", "#a78bfa", "#231a3f", true),
  p("blue-prism", "Blue prism", "#12224a", "#eaf1ff", "#9cb1de", "#60a5fa", "#0f1c3d", true, { glass: ["cobalt", "frosted"] }),
  p("pastel-iris", "Pastel iridescent", "#f7f4fb", "#3d3654", "#7d7495", "#6f5cc9", "#ffffff"),
  // --- Neon ------------------------------------------------------------------
  p("neon-cyan-magenta", "Black, cyan & magenta", "#0b0b10", "#eefcff", "#8fd6e0", "#cb16b4", "#ffffff", true),
  p("neon-acid", "Black & acid green", "#0d100b", "#f2ffe8", "#a9c791", "#84cc16", "#101408", true),
  p("neon-violet-blue", "Purple & electric blue", "#170d2b", "#efeaff", "#a99cd6", "#4f46e5", "#ffffff", true),
  p("neon-pink-orange", "Pink & orange", "#1c0d14", "#fff0f4", "#d8a4b4", "#d61a44", "#ffffff", true),
  p("neon-white-pink", "White & neon pink", "#ffffff", "#231016", "#7a5560", "#db2777", "#ffffff"),
  p("neon-navy-cyan", "Navy & cyan", "#0d1b33", "#e8f8ff", "#8fb0c4", "#06b6d4", "#082330", true),
  // --- Botanical / kraft -----------------------------------------------------
  p("kraft-ink", "Kraft & ink", null, "#2c2014", "#5f4c36", "#2c2014", "#f4e8d6", false, { glass: ["amber", "clear"], qrColor: "#2c2014" }),
  p("sage-cream", "Sage & cream", "#eef1e6", "#2c3a2a", "#617257", "#4d7c58", "#ffffff"),
  // --- Clear film ------------------------------------------------------------
  p("clear-dark", "Clear with dark print", null, "#17171c", "#4b4b55", "#17171c", "#ffffff"),
  p("clear-white", "Clear with white print", null, "#ffffff", "#d8d8de", "#ffffff", "#17171c", true, { glass: ["amber", "cobalt"] }),
] as const;

export function getEasyPalette(id: string): EasyPalette {
  return EASY_PALETTES.find((pal) => pal.id === id) ?? EASY_PALETTES[0]!;
}

// ---------------------------------------------------------------------------
// Contrast math (WCAG relative luminance) — guards custom colors.
// ---------------------------------------------------------------------------

function channel(hex: string, index: number): number {
  const v = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const h =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex.slice(0, 7);
  return 0.2126 * channel(h, 0) + 0.7152 * channel(h, 1) + 0.0722 * channel(h, 2);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white — whichever reads better on the given background. */
export function readableOn(bg: string): string {
  return contrastRatio(bg, "#17171c") >= contrastRatio(bg, "#ffffff")
    ? "#17171c"
    : "#ffffff";
}
