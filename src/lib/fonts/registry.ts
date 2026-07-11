import manifest from "../../../public/fonts/manifest.json";
import type { LabelDocument, LabelObject } from "@/lib/document/schema";

/**
 * Registry of bundled label fonts (static-weight TTFs in /public/fonts).
 * The same files back three consumers:
 * - CSS `FontFace` registration for canvas/editor rendering,
 * - fontkit glyph outlining for SVG export,
 * - pdf-lib embedding for PDF export.
 */

export interface FontFile {
  weight: number;
  file: string;
  bytes: number;
}

export interface FontFamily {
  id: string;
  name: string;
  category: "sans" | "serif" | "display" | "mono";
  files: FontFile[];
}

export const FONT_FAMILIES: FontFamily[] = manifest as FontFamily[];

export const DEFAULT_FONT_ID = "inter";

export function getFontFamily(id: string): FontFamily | undefined {
  return FONT_FAMILIES.find((f) => f.id === id);
}

/** CSS/canvas family name (FontFace registers under this exact name). */
export function fontCssFamily(id: string): string {
  return getFontFamily(id)?.name ?? "Inter";
}

export function availableWeights(id: string): number[] {
  return (getFontFamily(id)?.files ?? []).map((f) => f.weight);
}

/** Closest bundled weight to the requested one. */
export function resolveWeight(id: string, weight: number): number {
  const weights = availableWeights(id);
  if (weights.length === 0) return 400;
  return weights.reduce((best, w) =>
    Math.abs(w - weight) < Math.abs(best - weight) ? w : best,
  );
}

export function fontFileUrl(id: string, weight: number): string {
  const family = getFontFamily(id);
  const resolved = resolveWeight(id, weight);
  const file = family?.files.find((f) => f.weight === resolved);
  return `/fonts/${file?.file ?? "inter-400.ttf"}`;
}

// ---------------------------------------------------------------------------
// Runtime loading (browser)
// ---------------------------------------------------------------------------

const loaded = new Map<string, Promise<void>>();

/** Load one family+weight via the FontFace API (idempotent). */
export function loadFont(familyId: string, weight: number): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  const resolved = resolveWeight(familyId, weight);
  const key = `${familyId}:${resolved}`;
  const existing = loaded.get(key);
  if (existing) return existing;

  const cssName = fontCssFamily(familyId);
  const url = fontFileUrl(familyId, resolved);
  const face = new FontFace(cssName, `url(${url})`, {
    weight: String(resolved),
    style: "normal",
    display: "swap",
  });
  const promise = face
    .load()
    .then((f) => {
      document.fonts.add(f);
    })
    .catch((err) => {
      loaded.delete(key);
      throw err;
    });
  loaded.set(key, promise);
  return promise;
}

function collectFontUses(objects: LabelObject[], into: Set<string>): void {
  for (const o of objects) {
    if (o.type === "text") into.add(`${o.fontFamilyId}:${o.fontWeight}`);
    if (o.type === "group") collectFontUses(o.children, into);
  }
}

/**
 * Ensure every font used by the document is loaded and ready. MUST be
 * awaited before any canvas measurement or offscreen export render —
 * unloaded fonts silently fall back and change metrics.
 */
export async function loadFontsForDocument(doc: LabelDocument): Promise<void> {
  if (typeof document === "undefined") return;
  const uses = new Set<string>();
  collectFontUses(doc.objects, uses);
  uses.add(`${DEFAULT_FONT_ID}:400`);
  await Promise.all(
    [...uses].map((key) => {
      const [id, weight] = key.split(":");
      return loadFont(id!, Number(weight)).catch(() => {
        // A missing font falls back visibly rather than blocking the editor.
      });
    }),
  );
  await document.fonts.ready;
}
