import { contrastRatio, type EasyPalette } from "./palettes";

/**
 * A palette pulled from the user's uploaded logo. Pure math on RGBA
 * buffers (node-testable); the browser side feeds it a downsampled
 * ImageData (`paletteFromLogoSrc` in logo.ts). The COLORS are the
 * logo's; the CONTRAST is ours: every derived role is nudged along its
 * lightness axis until the same floors the curated palettes guarantee
 * hold — "use my brand colors" can never produce an unreadable label.
 */

export const LOGO_PALETTE_ID = "logo";

export interface PixelSource {
  data: Uint8ClampedArray | readonly number[];
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Color plumbing (hue-preserving adjustments happen in HSL)
// ---------------------------------------------------------------------------

function toHex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function fromHex(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  if (s === 0) {
    const v = l * 255;
    return toHex(v, v, v);
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t0: number) => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return toHex(channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255);
}

/**
 * Walk a color's HSL lightness away from the reference until the contrast
 * floor holds (hue and saturation stay put — it's still "their" color).
 * Returns null when even the extreme can't reach the floor.
 */
function ensureContrast(hex: string, vs: string, floor: number): string | null {
  if (contrastRatio(hex, vs) >= floor) return hex;
  const [h, s, l] = rgbToHsl(...fromHex(hex));
  const darken = contrastRatio("#000000", vs) >= contrastRatio("#ffffff", vs);
  for (let i = 1; i <= 48; i++) {
    const candidate = hslToHex(h, s, Math.max(0, Math.min(1, l + (darken ? -i : i) * 0.02)));
    if (contrastRatio(candidate, vs) >= floor) return candidate;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

/**
 * Dominant opaque colors of a logo bitmap, most populous first. 16-level
 * per-channel bucketing with per-bucket averaging (so a bucket reports
 * its real shade, not its corner), transparent and near-white pixels
 * skipped (logo backgrounds), similar shades merged.
 */
export function extractDominantColors(pixels: PixelSource, max = 5): string[] {
  const buckets = new Map<
    number,
    { count: number; r: number; g: number; b: number }
  >();
  const { data } = pixels;
  for (let i = 0; i + 3 < data.length; i += 4) {
    const a = data[i + 3]!;
    if (a < 200) continue;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    if (r >= 246 && g >= 246 && b >= 246) continue; // white background
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }
  const ranked = [...buckets.values()]
    .filter((b) => b.count >= 4)
    .sort((a, b) => b.count - a.count)
    .map((b) => ({
      count: b.count,
      rgb: [b.r / b.count, b.g / b.count, b.b / b.count] as const,
    }));

  const picked: { rgb: readonly [number, number, number] }[] = [];
  for (const candidate of ranked) {
    if (picked.length >= max) break;
    const distinct = picked.every((p) => {
      const dr = p.rgb[0] - candidate.rgb[0];
      const dg = p.rgb[1] - candidate.rgb[1];
      const db = p.rgb[2] - candidate.rgb[2];
      return Math.sqrt(dr * dr + dg * dg + db * db) >= 48;
    });
    if (distinct) picked.push(candidate);
  }
  return picked.map((p) => toHex(...p.rgb));
}

// ---------------------------------------------------------------------------
// Palette derivation
// ---------------------------------------------------------------------------

/**
 * Build a light Easy palette around the logo's colors, or null when the
 * logo has no usable color (all-white / transparent / washed out — an
 * honest "no chip" beats a made-up palette). Floors match the strictest
 * uses the engine has: accent can carry small BOLD rows (≥ 3.5:1), text
 * and muted carry small print (≥ 4.5:1, text pushed toward 7:1).
 */
export function paletteFromLogo(colors: readonly string[]): EasyPalette | null {
  if (colors.length === 0) return null;
  const scored = colors.map((hex) => {
    const [h, s, l] = rgbToHsl(...fromHex(hex));
    return { hex, h, s, l };
  });

  // Population order (input) breaks ties: the first sufficiently-saturated
  // color is the brand accent; a weakly-tinted logo still qualifies at a
  // lower bar; a gray/white logo yields nothing.
  const accentSeed =
    scored.find((c) => c.s >= 0.25 && c.l >= 0.08 && c.l <= 0.92) ??
    scored.find((c) => c.s >= 0.12 && c.l >= 0.08 && c.l <= 0.92);
  if (!accentSeed) return null;

  const bg = "#ffffff";
  const accent = ensureContrast(accentSeed.hex, bg, 3.5);
  if (!accent) return null;

  // Text: the darkest logo color if it can carry body copy, else neutral.
  const darkest = [...scored].sort((a, b) => a.l - b.l)[0]!;
  const text =
    (darkest.hex !== accentSeed.hex || colors.length === 1
      ? ensureContrast(darkest.hex, bg, 7)
      : null) ??
    ensureContrast(accentSeed.hex, bg, 7) ??
    "#17171c";

  // Muted: the text hue, lifted as light as small print allows.
  const [th, ts, tl] = rgbToHsl(...fromHex(text));
  let muted = text;
  for (let i = 1; i <= 24; i++) {
    const candidate = hslToHex(th, Math.min(ts, 0.35), Math.min(1, tl + i * 0.02));
    if (contrastRatio(candidate, bg) < 4.6) break;
    muted = candidate;
  }

  // The accent is ≥ 3.5:1 against white, so white type on the accent chip
  // clears the same floor by symmetry; black wins only when it reads better.
  const onAccent =
    contrastRatio("#17171c", accent) > contrastRatio("#ffffff", accent)
      ? "#17171c"
      : "#ffffff";

  return {
    id: LOGO_PALETTE_ID,
    name: "From your logo",
    bg,
    text,
    muted,
    accent,
    onAccent,
    dark: false,
    border: muted,
    qrColor: contrastRatio(text, "#ffffff") >= 8 ? text : "#000000",
  };
}
