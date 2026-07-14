import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { openSync } from "fontkit";
import {
  FONT_FAMILIES,
  availableWeights,
  fontFileUrl,
  hasWeight,
  resolveWeight,
} from "./registry";

/**
 * The font manifest is a shipping contract: the editor (FontFace), the SVG
 * and vector-PDF exporters (fontkit outlining), and the raster measurer all
 * read these exact files. A missing file or a weight that doesn't resolve
 * would silently fall back and change printed output — so the whole library
 * is validated here, file by file.
 */

const FONTS_DIR = path.join(process.cwd(), "public", "fonts");

// Every character class the layout engine and templates rely on.
const REQUIRED_GLYPHS = "ABCXYZabcxyz0189.,%()-/ ";

describe("font manifest", () => {
  it("has unique kebab-case ids and unique names", () => {
    const ids = FONT_FAMILIES.map((f) => f.id);
    const names = FONT_FAMILIES.map((f) => f.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("covers all four categories with a healthy library", () => {
    expect(FONT_FAMILIES.length).toBeGreaterThanOrEqual(38);
    for (const category of ["sans", "serif", "display", "mono"] as const) {
      expect(FONT_FAMILIES.some((f) => f.category === category)).toBe(true);
    }
  });

  it("declares files as <id>-<weight>.ttf with unique weights", () => {
    for (const family of FONT_FAMILIES) {
      expect(family.files.length).toBeGreaterThan(0);
      const weights = family.files.map((f) => f.weight);
      expect(new Set(weights).size).toBe(weights.length);
      for (const file of family.files) {
        expect(file.file).toBe(`${family.id}-${file.weight}.ttf`);
        expect(file.bytes).toBeGreaterThan(0);
      }
    }
  });

  it("matches the files on disk exactly (no missing, no orphans, no drift)", () => {
    const onDisk = new Set(
      readdirSync(FONTS_DIR).filter((f) => f.endsWith(".ttf")),
    );
    const declared = new Set(
      FONT_FAMILIES.flatMap((f) => f.files.map((file) => file.file)),
    );
    expect([...declared].filter((f) => !onDisk.has(f))).toEqual([]);
    expect([...onDisk].filter((f) => !declared.has(f))).toEqual([]);
    for (const family of FONT_FAMILIES) {
      for (const file of family.files) {
        expect(
          statSync(path.join(FONTS_DIR, file.file)).size,
          `${file.file} byte size drifted from the manifest`,
        ).toBe(file.bytes);
      }
    }
  });

  it("every file is a parseable static TrueType with the required glyphs", () => {
    for (const family of FONT_FAMILIES) {
      for (const file of family.files) {
        const opened = openSync(path.join(FONTS_DIR, file.file));
        expect(opened.type, `${file.file} is a collection, not a single font`).not.toBe("TTC");
        const font = opened as Extract<typeof opened, { hasGlyphForCodePoint: unknown }>;
        // A variable font here would silently outline its default weight in
        // SVG/PDF exports — reject any font carrying variation axes.
        const axes = (font as unknown as { variationAxes: object }).variationAxes;
        expect(Object.keys(axes ?? {}), `${file.file} is a variable font`).toEqual([]);
        for (const ch of REQUIRED_GLYPHS) {
          expect(
            font.hasGlyphForCodePoint(ch.codePointAt(0)!),
            `${file.file} lacks a glyph for "${ch}"`,
          ).toBe(true);
        }
      }
    }
  });
});

describe("weight resolution", () => {
  it("resolves exact weights and finds the closest for missing ones", () => {
    expect(resolveWeight("inter", 600)).toBe(600);
    expect(resolveWeight("bebas-neue", 700)).toBe(400);
    expect(resolveWeight("montserrat", 500)).toBeOneOf([400, 600]);
  });

  it("hasWeight is exact — the validator's distinction from resolveWeight", () => {
    expect(hasWeight("inter", 600)).toBe(true);
    expect(hasWeight("inter", 550)).toBe(false);
    expect(hasWeight("no-such-family", 400)).toBe(false);
  });

  it("unknown families fall back to inter-400 rather than a broken URL", () => {
    expect(fontFileUrl("no-such-family", 400)).toBe("/fonts/inter-400.ttf");
    expect(availableWeights("no-such-family")).toEqual([]);
  });
});
