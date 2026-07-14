import { describe, expect, it } from "vitest";
import { migrateDocument } from "@/lib/document/migrate";
import { runPreflight } from "@/lib/preflight/rules";
import { createDocument } from "@/lib/document/defaults";
import { parseLabelDocument, type LabelObject, type TextObject } from "@/lib/document/schema";
import { getVialPreset } from "@/lib/vials/presets";
import { buildEasyDocument, DEFAULT_ENABLED, defaultEasyFields } from "./create-doc";
import {
  buildFamilyVariant,
  parseStrengthMg,
  suggestPaletteForStrength,
} from "./family";
import { buildEasyLabel } from "./instantiate";
import { contrastRatio, EASY_PALETTES, getEasyPalette } from "./palettes";
import { getMaterial, getMaterialOption } from "./materials";
import { EASY_TEMPLATES, getEasyTemplate } from "./templates";
import { recommendTemplates } from "./recommend";
import { approximateMeasure, fitRow, squeezeFactor, stackZones } from "./layout";
import { nextEasyMeta } from "./meta";
import { toPlainIssues } from "./plain-preflight";
import { buildSpecSheet } from "./spec-sheet";
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

describe("schema migration", () => {
  it("upgrades a stored v1 document with only a version stamp", () => {
    const v1 = JSON.parse(JSON.stringify({ ...createDocument(), schemaVersion: 1 }));
    delete v1.easy;
    const migrated = migrateDocument(v1);
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.easy).toBeUndefined();
  });

  it("upgrades a v2 easy document without touching its meta", () => {
    const v2 = JSON.parse(JSON.stringify({ ...buildEasyDocument(spec()), schemaVersion: 2 }));
    const migrated = migrateDocument(v2);
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.easy?.templateId).toBe(v2.easy.templateId);
    expect(migrated.easy?.pairingId).toBeUndefined();
  });

  it("round-trips v3 documents with slots and easy metadata", () => {
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

describe("material-aware rules", () => {
  it("neon at maximum intensity puts the hero on an accent panel with readable text", () => {
    const doc = buildEasyDocument(
      spec({
        materialId: "neon",
        materialOptionId: "neon-pink",
        paletteId: "neon-cyan-magenta",
        intensity: "maximum",
      }),
    );
    const panel = doc.objects.find((o) => o.slot === "accent:hero-panel");
    expect(panel?.type).toBe("rect");
    if (panel?.type === "rect" && panel.fill.type === "solid") {
      expect(panel.fill.color).toBe("#cb16b4"); // the palette accent
    }
    const name = textObjects(doc.objects).find((o) => o.slot === "product-name")!;
    expect(name.fill).toEqual({ type: "solid", color: "#ffffff" }); // onAccent
  });

  it("neon at subtle intensity keeps the plain background and no panel", () => {
    const doc = buildEasyDocument(
      spec({
        materialId: "neon",
        materialOptionId: "neon-pink",
        paletteId: "neon-cyan-magenta",
        intensity: "subtle",
      }),
    );
    expect(doc.objects.some((o) => o.slot === "accent:hero-panel")).toBe(false);
    expect(doc.background.type).toBe("solid");
  });

  it("declares sheen only for glossy and matte (preview-only property)", () => {
    expect(getMaterial("glossy")!.rules.sheen).toBe("gloss");
    expect(getMaterial("matte")!.rules.sheen).toBe("matte");
    expect(getMaterial("plain")!.rules.sheen).toBeUndefined();
    expect(getMaterial("holographic")!.rules.sheen).toBeUndefined();
  });
});

describe("one-click fix tweaks", () => {
  it("nameScale makes the product name bigger without breaking bounds", () => {
    const plain = buildEasyDocument(spec());
    const base = textObjects(plain.objects).find((o) => o.slot === "product-name")!;

    const material = getMaterial("plain")!;
    const build = buildEasyLabel({
      template: getEasyTemplate("clinical-frame")!,
      widthMm: plain.label.widthMm,
      heightMm: plain.label.heightMm,
      bleedMm: plain.label.bleedMm,
      safeMm: plain.label.safeMm,
      material,
      option: getMaterialOption(material, "plain-white"),
      intensity: "subtle",
      palette: getEasyPalette("white-black"),
      fields: { brand: "AURELIS LABS", "product-name": "Retinol Serum" },
      enabled: DEFAULT_ENABLED,
      tweaks: { nameScale: 1.5 },
    });
    const bigger = build.objects.find(
      (o): o is TextObject => o.type === "text" && o.slot === "product-name",
    )!;
    expect(bigger.fontSizePt).toBeGreaterThan(base.fontSizePt);
    expect(bigger.yMm + bigger.heightMm / 2).toBeLessThanOrEqual(plain.label.heightMm);
  });

  it("tweaks merge and persist through nextEasyMeta", () => {
    const meta = {
      templateId: "clinical-frame",
      materialId: "plain",
      materialOptionId: "plain-white",
      paletteId: "white-black",
    };
    const withTight = nextEasyMeta(meta, { tweaks: { tight: true } });
    expect(withTight.tweaks).toEqual({ tight: true });
    const withBoth = nextEasyMeta(withTight, { tweaks: { nameScale: 1.15 } });
    expect(withBoth.tweaks).toEqual({ tight: true, nameScale: 1.15 });
    // A later unrelated change keeps them.
    const later = nextEasyMeta(withBoth, { paletteId: "white-blue" });
    expect(later.tweaks).toEqual({ tight: true, nameScale: 1.15 });
  });
});

describe("nextEasyMeta (material switching)", () => {
  const base = {
    templateId: "clinical-frame",
    materialId: "holographic",
    materialOptionId: "rainbow-prism",
    intensity: "bold" as const,
    paletteId: "holo-black",
  };

  it("keeps the palette when the new material offers it", () => {
    const meta = nextEasyMeta(
      { ...base, paletteId: "silver-black" },
      { material: { materialId: "metallic", optionId: "gold-metallic" } },
    );
    expect(meta.paletteId).toBe("silver-black"); // metallic offers it too
    expect(meta.materialOptionId).toBe("gold-metallic");
  });

  it("falls back to the new material's default palette and intensity", () => {
    const meta = nextEasyMeta(base, {
      material: { materialId: "plain", optionId: "plain-white" },
    });
    expect(meta.paletteId).toBe("white-black");
    expect(meta.intensity).toBe("subtle"); // plain's default, not holo's bold
  });

  it("revalidates an option id that belongs to the old material", () => {
    const meta = nextEasyMeta(base, {
      material: { materialId: "neon", optionId: "rainbow-prism" },
    });
    expect(meta.materialOptionId).toBe("neon-pink"); // neon's default
  });
});

describe("template families", () => {
  it("ships at least 12 genuinely distinct layout archetypes", () => {
    expect(EASY_TEMPLATES.length).toBeGreaterThanOrEqual(12);
    const ids = new Set(EASY_TEMPLATES.map((t) => t.id));
    expect(ids.size).toBe(EASY_TEMPLATES.length);
    // Distinct DNA: no two templates share pairing + alignment + layout +
    // decor shape + row structure — color swaps alone can't pass this.
    const dna = EASY_TEMPLATES.map(
      (t) =>
        `${t.pairingId}/${t.align}/${t.split ? "split" : "stack"}/${t.verticalRow?.edge ?? "-"}/${t.codePlacement ?? "corner"}/${t.decor.map((d) => d.kind).sort().join(",")}/${t.rows.map((r) => `${r.slot}:${r.zone}${r.chip ? ":chip" : ""}${r.monogram ? ":mono" : ""}`).join("|")}`,
    );
    expect(new Set(dna).size).toBe(dna.length);
  });

  it("gives QR-focused layouts a larger code", () => {
    const fields = defaultEasyFields({ qr: "https://example.com" });
    const enabled = new Set<SlotId>([...DEFAULT_ENABLED, "qr"]);
    const normal = buildEasyDocument(spec({ fields, enabled }));
    const qrFirst = buildEasyDocument(
      spec({ templateId: "qr-forward", fields, enabled }),
    );
    const qrA = normal.objects.find((o) => o.slot === "qr")!;
    const qrB = qrFirst.objects.find((o) => o.slot === "qr")!;
    expect(qrB.widthMm).toBeGreaterThan(qrA.widthMm);
  });
});

describe("product-family generator", () => {
  const source = () =>
    buildEasyDocument(
      spec({
        fields: defaultEasyFields({
          brand: "AURELIS LABS",
          "product-name": "Retinol Serum",
          strength: "10 mg",
          warning: "External use only.",
        }),
        enabled: new Set<SlotId>([...DEFAULT_ENABLED, "warning"]),
      }),
    );

  it("changes only the product fields and preserves the brand identity", () => {
    const original = source();
    const variant = buildFamilyVariant(original, {
      productName: "Retinol Serum Night",
      strength: "20 mg",
      lot: "LOT-9",
    });
    expect(variant.easy).toMatchObject({
      templateId: original.easy!.templateId,
      materialId: original.easy!.materialId,
    });
    expect(variant.label).toEqual(original.label);
    const texts = textObjects(variant.objects);
    expect(texts.find((o) => o.slot === "brand")!.text).toBe("AURELIS LABS");
    expect(texts.find((o) => o.slot === "product-name")!.text).toBe(
      "Retinol Serum Night",
    );
    expect(texts.find((o) => o.slot === "strength")!.text).toBe("20 mg");
    expect(texts.find((o) => o.slot === "lot")!.text).toBe("LOT-9");
    expect(texts.find((o) => o.slot === "warning")!.text).toBe("External use only.");
  });

  it("keeps free objects added in the Advanced Editor", () => {
    const original = source();
    const withFree = {
      ...original,
      objects: [
        ...original.objects,
        { ...original.objects.find((o) => o.type === "text")!, id: "free-1", slot: undefined, name: "Free note" },
      ],
    };
    const variant = buildFamilyVariant(withFree, { productName: "Other" });
    expect(variant.objects.some((o) => o.id === "free-1")).toBe(true);
  });

  it("suggests strength colors by hue (5→blue, 10→purple, 20→red, 30→gold)", () => {
    const material = getMaterial("plain")!;
    expect(suggestPaletteForStrength("5 mg", material)?.id).toBe("white-blue");
    expect(suggestPaletteForStrength("20 mg", material)?.id).toBe("gray-red");
    expect(suggestPaletteForStrength("no number", material)).toBeNull();
    expect(parseStrengthMg("0.5% · 10 mg")).toBe(0.5);
  });
});

describe("plain-language preflight (§10/§17)", () => {
  const qrSpec = (extra: Record<string, unknown> = {}) =>
    spec({
      fields: defaultEasyFields({ qr: "https://example.com" }),
      enabled: new Set<SlotId>([...DEFAULT_ENABLED, "qr"]),
      ...extra,
    });

  it("translates technical rules and offers a working QR fix", () => {
    const doc = buildEasyDocument(qrSpec());
    const issues = runPreflight(doc);
    expect(issues.some((i) => i.ruleId === "qr-module-small")).toBe(true);

    const plain = toPlainIssues(issues, doc);
    const qrIssue = plain.find((p) => p.ruleId === "qr-module-small")!;
    expect(qrIssue.message).toMatch(/too small to scan/i);
    expect(qrIssue.message).not.toMatch(/module/i); // no jargon
    expect(qrIssue.fix?.change).toEqual({ tweaks: { qrBoost: true } });

    // Applying the fix genuinely enlarges the code.
    const qrBefore = doc.objects.find((o) => o.slot === "qr")!;
    const material = getMaterial("plain")!;
    const build = buildEasyLabel({
      template: getEasyTemplate("clinical-frame")!,
      widthMm: doc.label.widthMm,
      heightMm: doc.label.heightMm,
      bleedMm: doc.label.bleedMm,
      safeMm: doc.label.safeMm,
      material,
      option: getMaterialOption(material, "plain-white"),
      intensity: "subtle",
      palette: getEasyPalette("white-black"),
      fields: defaultEasyFields({ qr: "https://example.com" }),
      enabled: new Set<SlotId>([...DEFAULT_ENABLED, "qr"]),
      tweaks: { qrBoost: true },
    });
    const qrAfter = build.objects.find((o) => o.slot === "qr")!;
    expect(qrAfter.widthMm).toBeGreaterThan(qrBefore.widthMm);
  });

  it("collapses repeated issues and falls back to technical text for unknown rules", () => {
    const doc = buildEasyDocument(spec());
    const plain = toPlainIssues(
      [
        { ruleId: "font-small", severity: "warning", message: "a" },
        { ruleId: "font-small", severity: "warning", message: "b" },
        { ruleId: "brand-new-rule", severity: "info", message: "Technical detail here." },
      ],
      doc,
    );
    expect(plain.filter((p) => p.ruleId === "font-small")).toHaveLength(1);
    expect(plain.find((p) => p.ruleId === "brand-new-rule")!.message).toBe(
      "Technical detail here.",
    );
  });
});

describe("printer specification sheet (§11)", () => {
  it("states size, shape, material, and container in printer language", () => {
    const doc = buildEasyDocument(spec());
    const sheet = buildSpecSheet(doc, "Retinol Serum");
    expect(sheet).toContain("Size: 74.0 mm × 26.0 mm");
    expect(sheet).toMatch(/Rectangle with 1\.5 mm rounded corners/);
    expect(sheet).toContain("Bleed: 2.0 mm per side");
    expect(sheet).toContain("Plain — White (White polypropylene)");
    expect(sheet).toMatch(/Container: cylindrical, ⌀ 24\.5 mm/);
    expect(sheet).toContain("Gap between label ends");
  });

  it("requires white ink for light artwork on clear film", () => {
    const doc = buildEasyDocument(
      spec({
        materialId: "clear",
        materialOptionId: "clear-film",
        paletteId: "clear-white", // white print on transparent film
      }),
    );
    const sheet = buildSpecSheet(doc, "Clear Label");
    expect(sheet).toMatch(/White ink: REQUIRED/);
  });
});

describe("QR survives template changes (§23 case 7)", () => {
  it("keeps a scannable, in-bounds QR on every template", () => {
    for (const template of EASY_TEMPLATES) {
      const doc = buildEasyDocument(
        spec({
          templateId: template.id,
          fields: defaultEasyFields({ qr: "https://example.com" }),
          enabled: new Set<SlotId>([...DEFAULT_ENABLED, "qr"]),
        }),
      );
      const qr = doc.objects.find((o) => o.slot === "qr");
      expect(qr, template.id).toBeDefined();
      if (qr?.type !== "qrcode") continue;
      expect(qr.widthMm, template.id).toBeGreaterThanOrEqual(9);
      expect(qr.fgColor).toBe("#000000");
      expect(qr.bgColor).toBe("#ffffff");
      expect(qr.quietModules).toBeGreaterThanOrEqual(4);
      expect(qr.xMm - qr.widthMm / 2).toBeGreaterThanOrEqual(-0.01);
      expect(qr.xMm + qr.widthMm / 2).toBeLessThanOrEqual(doc.label.widthMm + 0.01);
      expect(qr.yMm + qr.heightMm / 2).toBeLessThanOrEqual(doc.label.heightMm + 0.01);
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
    expect(picks[0]!.template.id).toBe("luxury-center");
    const families = picks.map((p) => p.template.family);
    expect(new Set(families).size).toBe(families.length);
  });

  it("matches futuristic style to the futuristic archetype", () => {
    const material = getMaterial("neon")!;
    const picks = recommendTemplates({ styleId: "futuristic", material });
    expect(picks[0]!.template.id).toBe("futuristic-band");
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
