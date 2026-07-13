import * as fontkit from "fontkit";
import type { Font } from "fontkit";
import {
  DEFAULT_FONT_ID,
  fontFileUrl,
  getFontFamily,
  resolveWeight,
} from "@/lib/fonts/registry";

/**
 * Font loading + parsing shared by the vector exporters (SVG and vector PDF).
 * fontkit works on plain Uint8Array in node and the browser.
 */

export async function fetchFontBytes(
  familyId: string,
  weight: number,
): Promise<ArrayBuffer> {
  const res = await fetch(fontFileUrl(familyId, weight));
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${fontFileUrl(familyId, weight)}`);
  return res.arrayBuffer();
}

export class FontStore {
  private cache = new Map<string, Promise<Font | null>>();

  constructor(
    private load: (familyId: string, weight: number) => Promise<ArrayBuffer>,
    private onWarn: (message: string) => void,
    /** Names the consumer in substitution warnings ("SVG" | "vector PDF"). */
    private exportLabel = "SVG",
  ) {}

  /** Resolve a document (family, weight) to a parsed font, warning + falling
   *  back to Inter 400 when the family is unknown or its file fails to load. */
  async get(familyId: string, weight: number): Promise<Font | null> {
    const known = getFontFamily(familyId) !== undefined;
    if (!known) {
      this.onWarn(
        `Font "${familyId}" is not available; substituted Inter 400 in the ${this.exportLabel} export.`,
      );
    }
    const famId = known ? familyId : DEFAULT_FONT_ID;
    const resolved = resolveWeight(famId, known ? weight : 400);

    let font = await this.getExact(famId, resolved);
    if (!font) {
      this.onWarn(
        `Font file for "${famId}" (weight ${resolved}) could not be loaded; substituted Inter 400 in the ${this.exportLabel} export.`,
      );
      if (!(famId === DEFAULT_FONT_ID && resolved === 400)) {
        font = await this.getExact(DEFAULT_FONT_ID, 400);
      }
    }
    return font;
  }

  private getExact(familyId: string, weight: number): Promise<Font | null> {
    const key = `${familyId}:${weight}`;
    let cached = this.cache.get(key);
    if (!cached) {
      cached = this.load(familyId, weight)
        .then((bytes) => {
          // fontkit's runtime accepts any Uint8Array; its .d.ts still says
          // Buffer. No Buffer polyfill is required in the browser.
          const parsed = fontkit.create(new Uint8Array(bytes) as unknown as Buffer);
          return "fonts" in parsed ? (parsed.fonts[0] ?? null) : parsed;
        })
        .catch(() => null);
      this.cache.set(key, cached);
    }
    return cached;
  }
}
