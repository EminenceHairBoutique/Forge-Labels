import type { Fill, Stroke } from "@/lib/document/schema";
import { fontPtToMm } from "@/lib/geometry/units";

/**
 * Pure building blocks for the SVG exporter: number/XML formatting, base64,
 * and fill/stroke serialization that mirrors lib/render/fills.ts geometry.
 * Everything here is deterministic and environment-free (node + browser).
 */

/** Format a user-unit (mm) number: fixed precision, trailing zeros stripped. */
export function fmt(n: number, decimals = 4): string {
  if (!Number.isFinite(n)) return "0";
  const s = n.toFixed(decimals);
  const trimmed = s.includes(".") ? s.replace(/\.?0+$/, "") : s;
  return trimmed === "-0" ? "0" : trimmed;
}

/** Escape a string for use in XML attribute values or text nodes. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Sanitize an object id into an XML-safe id fragment. */
export function xmlId(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, "_");
}

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Pure base64 (no Buffer, no btoa) so it runs identically in node + browser. */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    out += BASE64_ALPHABET[b0 >> 2]!;
    out += BASE64_ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)]!;
    out += i + 1 < bytes.length ? BASE64_ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)]! : "=";
    out += i + 2 < bytes.length ? BASE64_ALPHABET[b2 & 0x3f]! : "=";
  }
  return out;
}

// ---------------------------------------------------------------------------
// Fills (mirrors fillToKonvaProps in lib/render/fills.ts)
// ---------------------------------------------------------------------------

export interface GradientStopLike {
  offset: number;
  color: string;
}

function stopsMarkup(stops: GradientStopLike[]): string {
  return stops
    .map((s) => `<stop offset="${fmt(s.offset)}" stop-color="${escapeXml(s.color)}"/>`)
    .join("");
}

/**
 * Linear gradient def matching fills.ts geometry: CSS-like angle where
 * 0° = up, endpoints computed across the given rect from its center so the
 * gradient exactly spans the box in the gradient direction.
 * `rect.x/y` offset the endpoints (used by the background, which spans
 * negative bleed coordinates); object fills pass x = y = 0.
 */
export function linearGradientDef(
  id: string,
  angleDeg: number,
  stops: GradientStopLike[],
  rect: { x: number; y: number; width: number; height: number },
): string {
  const rad = ((angleDeg - 90) * Math.PI) / 180; // 0° = up (CSS-like)
  const dirX = Math.cos(rad);
  const dirY = Math.sin(rad);
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const half = (Math.abs(dirX) * rect.width + Math.abs(dirY) * rect.height) / 2;
  return (
    `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" ` +
    `x1="${fmt(cx - dirX * half)}" y1="${fmt(cy - dirY * half)}" ` +
    `x2="${fmt(cx + dirX * half)}" y2="${fmt(cy + dirY * half)}">` +
    stopsMarkup(stops) +
    `</linearGradient>`
  );
}

/** Radial gradient def matching fills.ts: center of the box, radius max(w,h)/2. */
export function radialGradientDef(
  id: string,
  stops: GradientStopLike[],
  size: { width: number; height: number },
): string {
  const cx = size.width / 2;
  const cy = size.height / 2;
  const r = Math.max(size.width, size.height) / 2;
  return (
    `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" ` +
    `cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}">` +
    stopsMarkup(stops) +
    `</radialGradient>`
  );
}

/** Neutral gray used when a simulated finish fill cannot be vectorized. */
export const FINISH_FALLBACK_COLOR = "#c8c8cc";

export interface FillResolution {
  /** Value for the `fill` attribute ("none", a color, or url(#id)). */
  paint: string;
  /** Gradient def markup to hoist into <defs>, if any. */
  def?: string;
  /** Warning raised while resolving (finish fills). */
  warning?: string;
}

/**
 * Resolve a document Fill into an SVG paint. Gradient geometry is computed
 * over the object's local 0..w × 0..h box — the same numbers Konva receives —
 * so it must be referenced from inside the object's transformed group.
 * (For center-origin shapes this intentionally replicates the editor's
 * rendering, where Konva resolves the same coordinates in centered space.)
 */
export function resolveFillPaint(
  fill: Fill | undefined,
  size: { width: number; height: number },
  defId: string,
): FillResolution {
  if (!fill || fill.type === "none") return { paint: "none" };
  switch (fill.type) {
    case "solid":
      return { paint: fill.color };
    case "linear-gradient":
      return {
        paint: `url(#${defId})`,
        def: linearGradientDef(defId, fill.angleDeg, fill.stops, {
          x: 0,
          y: 0,
          width: size.width,
          height: size.height,
        }),
      };
    case "radial-gradient":
      return {
        paint: `url(#${defId})`,
        def: radialGradientDef(defId, fill.stops, size),
      };
    case "finish":
      return {
        paint: FINISH_FALLBACK_COLOR,
        warning: "Simulated finish fills are not vector; exported as flat gray.",
      };
  }
}

/** Stroke → SVG attributes (pt widths/dashes converted to mm). */
export function strokeAttrs(stroke: Stroke | undefined): string {
  if (!stroke || stroke.widthPt <= 0) return "";
  let attrs =
    ` stroke="${escapeXml(stroke.color)}"` +
    ` stroke-width="${fmt(fontPtToMm(stroke.widthPt))}"`;
  if (stroke.dash && stroke.dash.length > 0) {
    attrs += ` stroke-dasharray="${stroke.dash.map((d) => fmt(fontPtToMm(d))).join(" ")}"`;
  }
  return attrs;
}
