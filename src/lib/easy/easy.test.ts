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
import { EASY_TEMPLATES, getEasyTemplate, templateFitsVial } from "./templates";
import { recommendTemplates } from "./recommend";
import { sizesForTemplate } from "./validate";
import { scanCompliance } from "./compliance";
import { densitySlotSet } from "./density";
import { getNotice, noticeIdForText } from "./notices";
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
    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.easy).toBeUndefined();
  });

  it("upgrades a v2 easy document without touching its meta", () => {
    const v2 = JSON.parse(JSON.stringify({ ...buildEasyDocument(spec()), schemaVersion: 2 }));
    const migrated = migrateDocument(v2);
    expect(migrated.schemaVersion).toBe(4);
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
          // Rotated (vertical) rows swap their extents around the center.
          const rotated = obj.rotationDeg % 180 !== 0;
          const w = rotated ? obj.heightMm : obj.widthMm;
          const h = rotated ? obj.widthMm : obj.heightMm;
          expect(obj.xMm - w / 2).toBeGreaterThanOrEqual(-0.01);
          expect(obj.xMm + w / 2).toBeLessThanOrEqual(doc.label.widthMm + 0.01);
          expect(obj.yMm - h / 2).toBeGreaterThanOrEqual(-0.01);
          expect(obj.yMm + h / 2).toBeLessThanOrEqual(doc.label.heightMm + 0.01);
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
    // §4 of the overhaul brief: at least 120 genuinely distinct layouts.
    expect(EASY_TEMPLATES.length).toBeGreaterThanOrEqual(120);
    const ids = new Set(EASY_TEMPLATES.map((t) => t.id));
    expect(ids.size).toBe(EASY_TEMPLATES.length);
    // Distinct DNA: no two templates share pairing + alignment + layout +
    // decor shape + row structure — color swaps alone can't pass this.
    const dna = EASY_TEMPLATES.map(
      (t) =>
        `${t.pairingId}/${t.align}/${t.split ? "split" : "stack"}/${t.verticalRow?.edge ?? "-"}/${t.codePlacement ?? "corner"}/${t.decor.map((d) => d.kind).sort().join(",")}/${t.rows.map((r) => `${r.slot}:${r.zone}${r.chip ? ":chip" : ""}${r.monogram ? ":mono" : ""}`).join("|")}`,
    );
    const dupes = dna.filter((d, i) => dna.indexOf(d) !== i);
    expect(dupes, `duplicate layout DNA:\n${dupes.join("\n")}`).toEqual([]);
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
  it("returns distinct families with the top pick tagged Best match", () => {
    const material = getMaterial("plain")!;
    const picks = recommendTemplates({ styleId: "luxury", material, preferDark: true });
    expect(picks.length).toBeGreaterThanOrEqual(3);
    expect(picks[0]!.tag).toBe("Best match");
    for (const pick of picks) expect(pick.reason).toMatch(/^Recommended because .+\.$/);
    expect(picks[0]!.template.id).toBe("luxury-center");
    const families = picks.map((p) => p.template.family);
    expect(new Set(families).size).toBe(families.length);
  });

  it("matches futuristic style to a strongly futuristic archetype", () => {
    const material = getMaterial("neon")!;
    const picks = recommendTemplates({ styleId: "futuristic", material });
    expect(picks[0]!.template.vibe.futuristic ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("labels the six §7 roles", () => {
    const picks = recommendTemplates({ material: getMaterial("plain")!, count: 6 });
    expect(picks).toHaveLength(6);
    expect(picks.map((p) => p.tag)).toEqual([
      "Best match",
      "Most professional",
      "Most minimal",
      "Most bold",
      "Most premium",
      "Alternative style",
    ]);
  });

  it("steers toward the asked content density and says so", () => {
    const picks = recommendTemplates({
      material: getMaterial("plain")!,
      density: "detailed",
      count: 6,
    });
    const detailed = picks.filter((p) => p.template.density === "detailed");
    expect(detailed.length).toBeGreaterThanOrEqual(1);
    expect(
      detailed.some((p) => p.reason.includes("every detail you plan to include")),
    ).toBe(true);
  });

  it("boosts QR-forward layouts when a QR code is wanted", () => {
    const withQr = recommendTemplates({
      material: getMaterial("plain")!,
      wantsQr: true,
      count: 6,
    });
    expect(
      withQr.some(
        (p) => (p.template.qrScale ?? 1) > 1 || p.template.codePlacement === "side",
      ),
    ).toBe(true);
  });

  it("never recommends a template the label is too small for", () => {
    const picks = recommendTemplates({
      material: getMaterial("plain")!,
      count: 12,
      labelWidthMm: 40,
      labelHeightMm: 14,
    });
    for (const pick of picks) {
      expect(pick.template.minHeightMm ?? 0).toBeLessThanOrEqual(14);
      expect(pick.template.minWidthMm ?? 0).toBeLessThanOrEqual(40);
    }
  });

  it("surfaces vial-locked templates only on their vial — and says why", () => {
    const material = getMaterial("plain")!;
    // On the 10 mL crimp-top vial the purpose-built layout leads.
    const onCrimp = recommendTemplates({
      material,
      count: 6,
      vialPresetId: "10ml-crimp",
      density: "detailed",
    });
    const crimpPick = onCrimp.find((p) => p.template.id === "crimp-dose");
    expect(crimpPick).toBeDefined();
    expect(crimpPick!.tag).toBe("Best match");
    expect(crimpPick!.reason).toContain("designed for this exact vial");
    // On other vials — or an unknown/custom container — it never appears.
    for (const presetId of ["10ml-serum", "30ml-serum", null, undefined]) {
      const picks = recommendTemplates({
        material,
        count: 12,
        vialPresetId: presetId,
        density: "detailed",
      });
      expect(picks.some((p) => p.template.id === "crimp-dose")).toBe(false);
    }
  });
});

describe("research platform core (v4)", () => {
  it("density modes pick the research vocabulary for research industries", () => {
    const essential = densitySlotSet("essential", "research-peptide");
    expect(essential.has("notice")).toBe(true);
    expect(essential.has("lot")).toBe(true);
    expect(essential.has("qr")).toBe(true);
    const detailed = densitySlotSet("detailed", "research-peptide");
    for (const slot of ["cas", "formula", "molecular-weight", "sequence", "purity", "coa"] as const) {
      expect(detailed.has(slot), slot).toBe(true);
    }
    const general = densitySlotSet("detailed", "skincare");
    expect(general.has("cas")).toBe(false);
    expect(general.has("ingredients")).toBe(true);
  });

  it("notice presets round-trip through free text", () => {
    expect(noticeIdForText("FOR RESEARCH USE ONLY")).toBe("ruo");
    expect(noticeIdForText("  for research   use only ")).toBe("ruo");
    expect(noticeIdForText("Custom lab wording")).toBe("custom");
    expect(getNotice("nhc")?.text).toBe("NOT FOR HUMAN CONSUMPTION");
  });

  it("compliance scan flags claims and identifiers but never the notice itself", () => {
    const findings = scanCompliance({
      description: "Treats muscle soreness. FDA approved.",
      warning: "Do not inject.",
      notice: "NOT FOR HUMAN CONSUMPTION",
      catalog: "NDC 0000-0000",
      "product-name": "Recovery Serum",
    });
    const phrases = findings.map((f) => `${f.slot}:${f.phrase}`);
    expect(phrases).toContain("description:treats");
    expect(phrases).toContain("description:fda approved");
    expect(phrases).toContain("warning:inject");
    expect(phrases).toContain("catalog:ndc");
    // The curated notice text is exempt from claim flags.
    expect(findings.some((f) => f.slot === "notice" && f.kind === "claim")).toBe(false);
    const identifier = findings.find((f) => f.kind === "identifier");
    expect(identifier?.message).toMatch(/authorized/i);
    // Clean content produces no findings.
    expect(scanCompliance({ "product-name": "Retinol Serum" })).toEqual([]);
  });

  it("meta transitions carry industry, density, notice review, and acknowledgments", () => {
    const doc = buildEasyDocument(spec({ industry: "research-peptide" }));
    expect(doc.easy?.industry).toBe("research-peptide");
    const base = doc.easy!;
    const withDensity = nextEasyMeta(base, { densityMode: "detailed" });
    expect(withDensity.densityMode).toBe("detailed");
    const withNotice = nextEasyMeta(base, { noticeId: "ruo" });
    expect(withNotice.noticeId).toBe("ruo");
    expect(withNotice.noticeReviewedAt).toBeUndefined();
    const reviewed = nextEasyMeta(withNotice, { noticeReviewed: 1700000000000 });
    expect(reviewed.noticeReviewedAt).toBe(1700000000000);
    const acked = nextEasyMeta(reviewed, {
      acknowledge: [{ slot: "description", phrase: "treats", at: 1700000000001 }],
    });
    expect(acked.complianceAck).toHaveLength(1);
    // Typing custom notice text switches the preset to "custom" and clears review.
    const custom = nextEasyMeta(reviewed, {
      field: { slot: "notice", value: "OUR OWN WORDING" },
    });
    expect(custom.noticeId).toBe("custom");
    expect(custom.noticeReviewedAt).toBeUndefined();
  });

  it("v4 documents parse with research slots and compliance metadata", () => {
    const doc = buildEasyDocument(spec({ industry: "lab-reagent" }));
    doc.easy!.densityMode = "standard";
    doc.easy!.noticeId = "ruo";
    doc.easy!.complianceAck = [{ slot: "warning", phrase: "inject", at: 1 }];
    const parsed = parseLabelDocument(JSON.parse(JSON.stringify(doc)));
    expect(parsed.easy?.densityMode).toBe("standard");
    expect(parsed.easy?.complianceAck?.[0]?.phrase).toBe("inject");
    expect(parsed.schemaVersion).toBe(4);
  });
});

describe("vial-locked templates", () => {
  it("templateFitsVial enforces preset and volume compatibility", () => {
    const crimp = getEasyTemplate("crimp-dose")!;
    expect(templateFitsVial(crimp, "10ml-crimp")).toBe(true);
    expect(templateFitsVial(crimp, "10ml-serum")).toBe(false);
    expect(templateFitsVial(crimp, "20ml-injection")).toBe(false);
    expect(templateFitsVial(crimp, null)).toBe(false);
    expect(templateFitsVial(crimp, "no-such-preset")).toBe(false);
    const universal = getEasyTemplate("clinical-blue")!;
    expect(templateFitsVial(universal, "10ml-crimp")).toBe(true);
    expect(templateFitsVial(universal, null)).toBe(true);
  });

  it("builds the crimp-top document at the vial's real wrap dimensions", () => {
    const preset = getVialPreset("10ml-crimp")!;
    const doc = buildEasyDocument({
      preset,
      templateId: "crimp-dose",
      materialId: "plain",
      materialOptionId: "plain-white",
      paletteId: getMaterial("plain")!.defaultPaletteId,
      fields: defaultEasyFields({ strength: "10 mg", volume: "10 mL" }),
      enabled: DEFAULT_ENABLED,
    });
    // Full wrap: π × 23.75 − 3 mm seam gap ≈ 71.6 mm; wall 32 − 4 ≈ 28 mm.
    expect(doc.label.widthMm).toBeCloseTo(Math.PI * preset.diameterMm - 3, 1);
    expect(doc.label.heightMm).toBeCloseTo(preset.straightWallHeightMm - 4, 1);
    expect(doc.vial.presetId).toBe("10ml-crimp");
    expect(doc.vial.capStyle).toBe("crimp");
    const slots = new Set(doc.objects.map((o) => o.slot));
    expect(slots.has("brand")).toBe(true);
    expect(slots.has("product-name")).toBe(true);
  });

  it("validates vial-locked templates on exactly their compatible geometries", () => {
    const crimp = getEasyTemplate("crimp-dose")!;
    const sizes = sizesForTemplate(crimp);
    expect(sizes.map((s) => s.id)).toEqual(["10ml-crimp"]);
    expect(sizes[0]!.real).toBe(true);
    expect(sizes[0]!.densityAnchor).toBe(true);
    // Universal templates keep the full matrix (3 vials + 4 edge shapes).
    const universal = getEasyTemplate("clinical-blue")!;
    expect(sizesForTemplate(universal).length).toBe(7);
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
