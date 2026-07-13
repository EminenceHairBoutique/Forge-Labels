import { describe, expect, it } from "vitest";
import { migrateDocument } from "@/lib/document/migrate";
import { createDocument } from "@/lib/document/defaults";
import { parseLabelDocument, type LabelObject, type TextObject } from "@/lib/document/schema";
import { getVialPreset } from "@/lib/vials/presets";
import { buildEasyDocument, DEFAULT_ENABLED, defaultEasyFields } from "./create-doc";
import { contrastRatio, EASY_PALETTES } from "./palettes";
import { getMaterial } from "./materials";
import { EASY_TEMPLATES } from "./templates";
import { recommendTemplates } from "./recommend";
import { approximateMeasure, fitRow, squeezeFactor, stackZones } from "./layout";
import type { SlotId } from "./slots";

function textObjects(objects: readonly LabelObject[]): TextObject[] {
  return objects.filter((o): o is TextObject => o.type === "text");
}

function spec(overrides: Record<string, unknown> = {}) {
  return {
    preset: getVialPreset("10ml-serum")!,
    templateId: "clinical-frame",
    materialId: "plain",
    materialOptionId: "plain-white",
    paletteId: "white-black",
    fields: defaultEasyFields({
      brand: "AURELIS LABS",
      "product-name": "Retinol Serum",
      strength: "0.5%",
      volume: "10 mL",
    }),
    enabled: DEFAULT_ENABLED,
    ...overrides,
  };
}

describe("schema v2 migration", () => {
  it("upgrades a stored v1 document with only a version stamp", () => {
    const v1 = JSON.parse(JSON.stringify({ ...createDocument(), schemaVersion: 1 }));
    delete v1.easy;
    const migrated = migrateDocument(v1);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.easy).toBeUndefined();
  });

  it("round-trips v2 documents with slots and easy metadata", () => {
    const doc = buildEasyDocument(spec());
    const restored = migrateDocument(JSON.parse(JSON.stringify(doc)));
    expect(restored).toEqual(doc);
  });
});

describe("buildEasyDocument", () => {
  it("produces a valid document with slot-tagged content", () => {
    const doc = parseLabelDocument(buildEasyDocument(spec()));
    const slots = new Set(doc.objects.map((o) => o.slot).filter(Boolean));
    expect(slots.has("brand")).toBe(true);
    expect(slots.has("product-name")).toBe(true);
    expect(doc.easy).toMatchObject({
      templateId: "clinical-frame",
      materialId: "plain",
      paletteId: "white-black",
    });
  });

  it.each(["10ml-serum", "20ml-serum", "30ml-serum"])(
    "keeps every content object inside the trim area on %s",
    (presetId) => {
      const preset = getVialPreset(presetId)!;
      for (const template of EASY_TEMPLATES) {
        const doc = buildEasyDocument(
          spec({ preset, templateId: template.id }),
        );
        for (const obj of textObjects(doc.objects)) {
          expect(obj.xMm - obj.widthMm / 2).toBeGreaterThanOrEqual(-0.01);
          expect(obj.xMm + obj.widthMm / 2).toBeLessThanOrEqual(doc.label.widthMm + 0.01);
          expect(obj.yMm - obj.heightMm / 2).toBeGreaterThanOrEqual(-0.01);
          expect(obj.yMm + obj.heightMm / 2).toBeLessThanOrEqual(doc.label.heightMm + 0.01);
        }
      }
    },
  );

  it("omits optional slots that are off and empty", () => {
    const doc = buildEasyDocument(spec());
    const slots = doc.objects.map((o) => o.slot);
    expect(slots).not.toContain("warning");
    expect(slots).not.toContain("qr");
  });

  it("shrinks a long product name instead of overflowing", () => {
    const short = buildEasyDocument(spec());
    const long = buildEasyDocument(
      spec({
        fields: defaultEasyFields({
          brand: "AURELIS LABS",
          "product-name":
            "Ultra-Concentrated Overnight Retinol Renewal Complex Advanced Professional Strength Formula Number Seven",
        }),
      }),
    );
    const shortName = textObjects(short.objects).find((o) => o.slot === "product-name")!;
    const longName = textObjects(long.objects).find((o) => o.slot === "product-name")!;
    expect(longName.fontSizePt).toBeLessThan(shortName.fontSizePt);
    expect(longName.yMm + longName.heightMm / 2).toBeLessThanOrEqual(
      long.label.heightMm,
    );
  });

  it("reserves footer space for an enabled QR code", () => {
    const withQr = buildEasyDocument(
      spec({
        fields: defaultEasyFields({
          brand: "AURELIS LABS",
          "product-name": "Retinol Serum",
          website: "aurelis.example",
          qr: "https://aurelis.example",
        }),
        enabled: new Set<SlotId>([...DEFAULT_ENABLED, "website", "qr"]),
      }),
    );
    const qr = withQr.objects.find((o) => o.slot === "qr");
    expect(qr?.type).toBe("qrcode");
    expect(qr!.widthMm).toBeGreaterThanOrEqual(9);
    // Footer text narrows so it never collides with the code.
    const website = textObjects(withQr.objects).find((o) => o.slot === "website")!;
    expect(website.xMm + website.widthMm / 2).toBeLessThanOrEqual(
      qr!.xMm - qr!.widthMm / 2 + 0.01,
    );
  });

  it("gives holographic maximum a finish background and keeps QR modules scannable", () => {
    const doc = buildEasyDocument(
      spec({
        materialId: "holographic",
        materialOptionId: "rainbow-prism",
        paletteId: "holo-black",
        intensity: "maximum",
        fields: defaultEasyFields({ qr: "https://example.com" }),
        enabled: new Set<SlotId>([...DEFAULT_ENABLED, "qr"]),
      }),
    );
    expect(doc.background.type).toBe("finish");
    const qr = doc.objects.find((o) => o.slot === "qr");
    expect(qr?.type).toBe("qrcode");
    if (qr?.type === "qrcode") {
      expect(qr.bgColor).toBe("#ffffff"); // opaque backing on busy material
      expect(qr.fgColor).toBe("#000000");
    }
  });
});

describe("curated palettes protect contrast", () => {
  it.each(EASY_PALETTES.map((p) => [p.id, p] as const))("%s", (_id, palette) => {
    if (palette.bg) {
      expect(contrastRatio(palette.text, palette.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.muted, palette.bg)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(palette.accent, palette.bg)).toBeGreaterThanOrEqual(2.5);
    }
    expect(contrastRatio(palette.onAccent, palette.accent)).toBeGreaterThanOrEqual(3);
  });
});

describe("recommendTemplates", () => {
  it("returns distinct families with the top pick tagged Recommended", () => {
    const material = getMaterial("plain")!;
    const picks = recommendTemplates({ styleId: "luxury", material, preferDark: true });
    expect(picks.length).toBeGreaterThanOrEqual(3);
    expect(picks[0]!.tag).toBe("Recommended");
    expect(picks[0]!.template.family).toBe("luxury");
    const families = picks.map((p) => p.template.family);
    expect(new Set(families).size).toBe(families.length);
  });

  it("matches futuristic style to the futuristic family", () => {
    const material = getMaterial("neon")!;
    const picks = recommendTemplates({ styleId: "futuristic", material });
    expect(picks[0]!.template.family).toBe("futuristic");
  });
});

describe("layout primitives", () => {
  const baseText = {
    id: "t1",
    type: "text",
    name: "",
    xMm: 0,
    yMm: 0,
    widthMm: 40,
    heightMm: 1,
    rotationDeg: 0,
    opacity: 1,
    locked: false,
    visible: true,
    printLayer: "artwork",
    text: "Hello",
    fontFamilyId: "inter",
    fontWeight: 400,
    fontSizePt: 10,
    lineHeight: 1.2,
    letterSpacingEm: 0,
    align: "left",
    textTransform: "none",
    fill: { type: "solid", color: "#000000" },
    autoFit: false,
  } as TextObject;

  it("fitRow shrinks until the line budget fits and flags the floor", () => {
    const long = { ...baseText, text: "word ".repeat(40) };
    const fit = fitRow(long, { prefPt: 12, minPt: 5, maxLines: 2 }, approximateMeasure);
    expect(fit.fontSizePt).toBeLessThan(12);
    const floor = fitRow(
      { ...long, text: "word ".repeat(400) },
      { prefPt: 12, minPt: 5, maxLines: 1 },
      approximateMeasure,
    );
    expect(floor.fontSizePt).toBe(5);
    expect(floor.atMinimum).toBe(true);
  });

  it("stackZones pins header up, footer down, hero centered", () => {
    const item = (h: number) => ({ heightMm: h, spacingBeforeMm: 0 });
    const tops = stackZones(
      { header: [item(2)], hero: [item(4)], footer: [item(2)] },
      { topMm: 3, bottomMm: 23 },
    );
    expect(tops.header[0]).toBe(3);
    expect(tops.footer[0]).toBe(21);
    // Hero centers between header bottom (5) and footer top (21): (5+21-4)/2 = 11
    expect(tops.hero[0]).toBeCloseTo(11, 5);
  });

  it("squeezeFactor only kicks in on overflow and respects the floor", () => {
    expect(squeezeFactor(10, 20)).toBe(1);
    expect(squeezeFactor(20, 10)).toBeCloseTo(0.55, 5);
    expect(squeezeFactor(12, 10)).toBeCloseTo(10 / 12, 5);
  });
});
