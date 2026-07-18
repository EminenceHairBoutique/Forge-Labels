import { createDocument } from "@/lib/document/defaults";
import type { LabelObject, TextObject } from "@/lib/document/schema";
import { availableWeights, getFontFamily } from "@/lib/fonts/registry";
import { getVialPreset, VIAL_PRESETS } from "@/lib/vials/presets";
import { buildEasyLabel, type EasyBuildInput } from "./instantiate";
import { contrastRatio, getEasyPalette, EASY_PALETTES } from "./palettes";
import { getMaterial, getMaterialOption, MATERIALS, type MaterialDef } from "./materials";
import { EASY_TEMPLATES, type EasyTemplateDef } from "./templates";
import { FONT_PAIRINGS, getPairing, roleFamily, roleWeights } from "./typography";
import type { SlotId } from "./slots";
import { SLOTS } from "./slots";

/**
 * Template quality gates (§21 of the overhaul brief). Every template is
 * built across real vial geometries, stress content, material rules, and
 * code toggles; each check produces an ACTIONABLE error string. The unit
 * suite asserts the whole registry is clean, and
 * `npm run validate:templates` prints a per-template report.
 */

export interface TemplateIssue {
  templateId: string;
  /** Which build surfaced it — "10ml-serum/long/holographic@maximum". */
  context: string;
  severity: "error" | "warning";
  message: string;
}

interface SizeSpec {
  id: string;
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  safeMm: number;
  /** A real vial geometry (drops/hidden codes here are design failures). */
  real?: boolean;
  /** The size where the declared content density must fit in full. */
  densityAnchor?: boolean;
}

function sizeFromPreset(presetId: string): SizeSpec {
  const preset = getVialPreset(presetId);
  if (!preset) throw new Error(`Unknown vial preset ${presetId}`);
  const doc = createDocument({ preset });
  return {
    id: presetId,
    widthMm: doc.label.widthMm,
    heightMm: doc.label.heightMm,
    bleedMm: doc.label.bleedMm,
    safeMm: doc.label.safeMm,
    real: true,
  };
}

/** Real geometries from the calculator + the §6 edge shapes. */
export function validationSizes(): SizeSpec[] {
  return [
    sizeFromPreset("10ml-serum"),
    sizeFromPreset("20ml-serum"),
    { ...sizeFromPreset("30ml-serum"), densityAnchor: true },
    { id: "narrow", widthMm: 30, heightMm: 20, bleedMm: 1.5, safeMm: 1.6 },
    { id: "wide-wrap", widthMm: 78, heightMm: 25, bleedMm: 1.5, safeMm: 1.6 },
    { id: "short", widthMm: 55, heightMm: 12, bleedMm: 1.5, safeMm: 1.4 },
    { id: "tall", widthMm: 30, heightMm: 40, bleedMm: 1.5, safeMm: 1.6 },
  ];
}

/**
 * The geometries a template must survive. Universal templates run the
 * full standard matrix; vial-locked templates (§3 compatibility) run on
 * exactly the presets they can appear on — eligibility filtering keeps
 * them off every other geometry, so validating there would gate nothing
 * real. Their density anchor becomes the largest compatible label.
 */
export function sizesForTemplate(t: EasyTemplateDef): SizeSpec[] {
  if (t.compatibleVialTypes === "all" && t.compatibleVolumesMl === "all") {
    return validationSizes();
  }
  const ids =
    t.compatibleVialTypes !== "all"
      ? [...t.compatibleVialTypes]
      : VIAL_PRESETS.filter((p) => !p.isCustom).map((p) => p.id);
  const compatible = ids.filter((id) => {
    const preset = getVialPreset(id);
    if (!preset) return false;
    return (
      t.compatibleVolumesMl === "all" ||
      (preset.nominalVolumeMl !== null &&
        t.compatibleVolumesMl.includes(preset.nominalVolumeMl))
    );
  });
  const sizes = compatible.map(sizeFromPreset);
  if (sizes.length > 0) {
    const largest = sizes.reduce((a, b) =>
      b.widthMm * b.heightMm > a.widthMm * a.heightMm ? b : a,
    );
    largest.densityAnchor = true;
  }
  return sizes;
}

interface Scenario {
  id: string;
  fields: Partial<Record<SlotId, string>>;
  enabled: SlotId[];
  /** Uploaded-logo aspect ratio (w/h) when `fields.logo` is set. */
  logoAspect?: number;
}

/** 1×1 transparent PNG — layout only needs the string, never the pixels. */
const LOGO_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const BASE_FIELDS: Partial<Record<SlotId, string>> = {
  brand: "AURELIS LABS",
  "product-name": "Retinol Serum",
  subtitle: "Overnight renewal complex",
  strength: "0.5% · 10 mg",
  volume: "10 mL / 0.34 fl oz",
};

export const VALIDATION_SCENARIOS: Scenario[] = [
  {
    id: "minimal",
    fields: { brand: "AURELIS", "product-name": "Serum" },
    enabled: ["brand", "product-name"],
  },
  {
    id: "baseline",
    fields: BASE_FIELDS,
    enabled: ["brand", "product-name", "subtitle", "strength", "volume"],
  },
  {
    id: "long",
    fields: {
      brand: "EMINENCE LABORATORIES INTERNATIONAL",
      "product-name": "Extended Recovery Peptide Concentrate",
      subtitle: "Triple-action overnight renewal complex",
      strength: "0.5 % · 25 mg / mL",
      volume: "30 mL / 1.0 fl oz",
    },
    enabled: ["brand", "product-name", "subtitle", "strength", "volume"],
  },
  {
    id: "detailed",
    fields: {
      ...BASE_FIELDS,
      description: "A stabilized retinol complex for nightly use on face and neck.",
      ingredients: "Aqua, Glycerin, Retinol, Squalane, Tocopherol, Carbomer, Phenoxyethanol",
      directions: "Apply 2–3 drops nightly after cleansing.",
      storage: "Store below 25 °C away from light",
      warning: "External use only. Keep out of reach of children.",
      lot: "LOT 2401-A",
      expiry: "EXP 06/2027",
      website: "aurelislabs.example",
      verification: "VERIFY X7K2-99B1",
    },
    enabled: [
      "brand", "product-name", "subtitle", "strength", "volume",
      "description", "ingredients", "directions", "storage", "warning",
      "lot", "expiry", "website", "verification",
    ],
  },
  {
    id: "qr",
    fields: { ...BASE_FIELDS, qr: "https://aurelislabs.example/verify" },
    enabled: ["brand", "product-name", "strength", "volume", "qr"],
  },
  {
    // §34: logo present (a wide 2.5:1 mark) — every other scenario is the
    // logo-absent case. The engine must place it, keep its aspect, and
    // never let it collide with text.
    id: "logo",
    fields: { ...BASE_FIELDS, logo: LOGO_DATA_URL },
    enabled: ["brand", "product-name", "strength", "volume", "logo"],
    logoAspect: 2.5,
  },
  {
    id: "barcode",
    fields: { ...BASE_FIELDS, barcode: "FL-2401-A" },
    enabled: ["brand", "product-name", "strength", "volume", "barcode"],
  },
  {
    id: "codes-detailed",
    fields: {
      ...BASE_FIELDS,
      ingredients: "Aqua, Glycerin, Retinol, Squalane, Tocopherol",
      warning: "External use only.",
      lot: "LOT 2401-A",
      qr: "https://aurelislabs.example/v",
      barcode: "FL-2401-A",
    },
    enabled: [
      "brand", "product-name", "subtitle", "strength", "volume",
      "ingredients", "warning", "lot", "qr", "barcode",
    ],
  },
];

/**
 * Extra stress cases for research/pharmaceutical/biotechnology templates:
 * the working research label, and the full science-data sheet. All
 * scientific strings are FICTIONAL layout stress text — the app never
 * suggests real values.
 */
const RESEARCH_FIELDS: Partial<Record<SlotId, string>> = {
  brand: "VANTA RESEARCH",
  "product-name": "Peptide Complex RC-7",
  abbreviation: "RC-7",
  strength: "10 mg",
  volume: "10 mL",
  notice: "FOR RESEARCH USE ONLY",
  lot: "LOT 2401-A",
  batch: "BATCH 24-118",
  catalog: "CAT-2101",
  storage: "Store at 2–8 °C away from light",
};

export const RESEARCH_SCENARIOS: Scenario[] = [
  {
    id: "research",
    fields: RESEARCH_FIELDS,
    enabled: [
      "brand", "product-name", "abbreviation", "strength", "volume",
      "notice", "lot", "batch", "catalog", "storage",
    ],
  },
  {
    id: "research-detailed",
    fields: {
      ...RESEARCH_FIELDS,
      purity: "≥ 99% (HPLC)",
      formula: "C42H68N12O14",
      "molecular-weight": "965.1 g/mol",
      cas: "0000-00-0",
      sequence: "H-Gly-Glu-Pro-Thr-Ala-OH",
      retest: "RETEST 01/2027",
      produced: "MFG 01/2026",
      sku: "SKU 10442",
      coa: "COA 24-118",
      website: "vantaresearch.example",
      qr: "https://vantaresearch.example/coa/24-118",
    },
    enabled: [
      "brand", "product-name", "abbreviation", "strength", "volume",
      "notice", "lot", "batch", "catalog", "storage", "purity", "formula",
      "molecular-weight", "cas", "sequence", "retest", "produced", "sku",
      "coa", "website", "qr",
    ],
  },
];

const RESEARCH_CATEGORIES = new Set(["research", "pharmaceutical", "biotechnology"]);

/** Scenarios where dropping a wanted code is an honest collapse, not a bug. */
const CODES_MAY_DROP = new Set(["codes-detailed", "research-detailed"]);

function scenariosForTemplate(t: EasyTemplateDef): Scenario[] {
  return t.category.some((c) => RESEARCH_CATEGORIES.has(c))
    ? [...VALIDATION_SCENARIOS, ...RESEARCH_SCENARIOS]
    : VALIDATION_SCENARIOS;
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function objBox(o: LabelObject): Box {
  // Rotated ±90 text swaps its extents around the center.
  const rotated = o.rotationDeg % 180 !== 0;
  const w = rotated ? o.heightMm : o.widthMm;
  const h = rotated ? o.widthMm : o.heightMm;
  return {
    left: o.xMm - w / 2,
    right: o.xMm + w / 2,
    top: o.yMm - h / 2,
    bottom: o.yMm + h / 2,
  };
}

function intersects(a: Box, b: Box, tolerance = 0.3): boolean {
  return (
    a.left < b.right - tolerance &&
    b.left < a.right - tolerance &&
    a.top < b.bottom - tolerance &&
    b.top < a.bottom - tolerance
  );
}

/** Solid backing color under a text object's glyph anchor, if any engine rect covers it. */
function backingAt(
  objects: LabelObject[],
  target: TextObject,
): string | null {
  // Glyphs sit at the aligned edge of the text box, not its center.
  const box = objBox(target);
  const anchorX =
    target.align === "left"
      ? box.left + Math.min(1, target.widthMm / 4)
      : target.align === "right"
        ? box.right - Math.min(1, target.widthMm / 4)
        : target.xMm;
  let color: string | null = null;
  for (const o of objects) {
    if (o === target) break; // only things painted BELOW the text
    if (o.type !== "rect" && o.type !== "ellipse") continue;
    if (o.fill.type !== "solid") continue;
    // Hairline rules can't act as a reading surface.
    if (o.heightMm < 1.2 || o.widthMm < 1.2) continue;
    const cover = objBox(o);
    if (
      anchorX >= cover.left &&
      anchorX <= cover.right &&
      target.yMm >= cover.top &&
      target.yMm <= cover.bottom
    ) {
      color = o.fill.color;
    }
  }
  return color;
}

interface MaterialCase {
  material: MaterialDef;
  optionId: string;
  intensity: EasyBuildInput["intensity"];
  label: string;
}

function materialCases(template: EasyTemplateDef): MaterialCase[] {
  const wants = (id: string) =>
    template.materials === "all" || template.materials.includes(id as never);
  const cases: MaterialCase[] = [];
  const plain = getMaterial("plain")!;
  if (wants("plain")) {
    cases.push({ material: plain, optionId: "plain-white", intensity: "subtle", label: "plain" });
  }
  const holo = getMaterial("holographic")!;
  if (wants("holographic")) {
    cases.push({ material: holo, optionId: "rainbow-prism", intensity: "maximum", label: "holographic@maximum" });
    cases.push({ material: holo, optionId: "rainbow-prism", intensity: "bold", label: "holographic@bold" });
  }
  const neon = getMaterial("neon")!;
  if (wants("neon")) {
    cases.push({ material: neon, optionId: "neon-pink", intensity: "bold", label: "neon@bold" });
  }
  const clear = getMaterial("clear")!;
  if (wants("clear")) {
    cases.push({ material: clear, optionId: "clear-film", intensity: "subtle", label: "clear" });
  }
  return cases.length > 0
    ? cases
    : [{ material: plain, optionId: "plain-white", intensity: "subtle", label: "plain" }];
}

/** Static (build-free) checks: metadata, fonts, structure. */
export function validateTemplateStatic(t: EasyTemplateDef): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  const err = (message: string) =>
    issues.push({ templateId: t.id, context: "static", severity: "error", message });

  if (t.category.length === 0) err("Template declares no browse category.");
  if (!t.family || !t.familyName) err("Template is missing family metadata.");

  const pairing = FONT_PAIRINGS.find((p) => p.id === t.pairingId);
  if (!pairing) {
    err(`Template references unknown font pairing "${t.pairingId}".`);
  } else {
    for (const role of ["display", "body", "technical"] as const) {
      const family = roleFamily(pairing, role);
      if (!getFontFamily(family)) {
        err(`Pairing "${pairing.id}" references unbundled font family "${family}".`);
      } else {
        for (const w of roleWeights(pairing, role)) {
          if (!availableWeights(family).includes(w)) {
            err(`Pairing "${pairing.id}" wants ${family}@${w}, which is not bundled.`);
          }
        }
      }
    }
    for (const row of t.rows) {
      if (row.weight === undefined) continue;
      const family = roleFamily(pairing, row.font);
      if (!availableWeights(family).includes(row.weight)) {
        err(
          `Row "${row.slot}" asks for ${family}@${row.weight} — template references an unavailable font weight (bundled: ${availableWeights(family).join("/")}).`,
        );
      }
    }
  }

  const rowSlots = t.rows.map((r) => r.slot);
  const dupes = rowSlots.filter((s, i) => rowSlots.indexOf(s) !== i);
  if (dupes.length > 0) err(`Slots appear in more than one row: ${[...new Set(dupes)].join(", ")}.`);
  if (t.verticalRow && rowSlots.includes(t.verticalRow.slot)) {
    err(`Slot "${t.verticalRow.slot}" is both a vertical row and a normal row.`);
  }
  if (t.verticalRow && t.verticalRow.edge === "right" && t.codePlacement === "side") {
    err("A right-edge vertical row cannot share the edge with side-placed codes.");
  }
  if (!rowSlots.includes("product-name")) err("Template has no product-name row.");
  if (!rowSlots.includes("brand") && t.verticalRow?.slot !== "brand") {
    err("Template has no brand row.");
  }
  if (t.split && !t.rows.some((r) => r.column === "right")) {
    err("Split layout declared but no row is assigned to the right column.");
  }
  if (!t.split && t.rows.some((r) => r.column === "right")) {
    err("Rows assigned to the right column but the template declares no split.");
  }
  for (const slot of rowSlots) {
    if (!(slot in SLOTS)) err(`Row references unknown slot "${slot}".`);
  }
  for (const paletteRef of [t.materials === "all" ? [] : t.materials].flat()) {
    if (!MATERIALS.some((m) => m.id === paletteRef)) {
      err(`Template limits itself to unknown material "${paletteRef}".`);
    }
  }
  if (t.compatibleVialTypes !== "all") {
    for (const id of t.compatibleVialTypes) {
      if (!getVialPreset(id)) err(`Template targets unknown vial preset "${id}".`);
    }
  }
  if (
    (t.compatibleVialTypes !== "all" || t.compatibleVolumesMl !== "all") &&
    sizesForTemplate(t).length === 0
  ) {
    err("Vial compatibility rules match no known vial preset — the template could never appear.");
  }
  return issues;
}

/** Full matrix validation for one template. */
export function validateTemplate(t: EasyTemplateDef): TemplateIssue[] {
  const issues: TemplateIssue[] = [...validateTemplateStatic(t)];
  if (issues.some((i) => i.severity === "error")) return issues; // fonts broken — builds would lie

  const sizes = sizesForTemplate(t);
  const materials = materialCases(t);
  const scenarios = scenariosForTemplate(t);

  for (const size of sizes) {
    if (t.minHeightMm && size.heightMm < t.minHeightMm) continue; // honestly hidden at this size
    if (t.minWidthMm && size.widthMm < t.minWidthMm) continue;
    for (const scenario of scenarios) {
      // The material axis runs on the real vial sizes with the core
      // scenarios; edge sizes always run on plain to keep the matrix sane.
      const cases =
        size.real && ["baseline", "detailed", "qr"].includes(scenario.id)
          ? materials
          : materials.slice(0, 1);
      for (const mc of cases) {
        issues.push(...checkBuild(t, size, scenario, mc));
      }
    }
  }
  return issues;
}

function checkBuild(
  t: EasyTemplateDef,
  size: SizeSpec,
  scenario: Scenario,
  mc: MaterialCase,
): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  const context = `${size.id}/${scenario.id}/${mc.label}`;
  const push = (severity: "error" | "warning", message: string) =>
    issues.push({ templateId: t.id, context, severity, message });

  const material = mc.material;
  const option = getMaterialOption(material, mc.optionId);
  // Same choice the recommender makes: a material palette matching the
  // template's color mode, else the material default.
  const wantDark = t.colorMode === "dark";
  const candidates = material.paletteIds.map(getEasyPalette);
  const palette = candidates.find((p) => p.dark === wantDark) ?? candidates[0]!;

  const enabled = new Set<SlotId>(scenario.enabled);
  let build;
  try {
    build = buildEasyLabel({
      template: t,
      widthMm: size.widthMm,
      heightMm: size.heightMm,
      bleedMm: size.bleedMm,
      safeMm: size.safeMm,
      material,
      option,
      intensity: mc.intensity,
      palette,
      fields: scenario.fields,
      enabled,
      logoAspect: scenario.logoAspect,
    });
  } catch (e) {
    push("error", `Engine threw: ${e instanceof Error ? e.message : String(e)}`);
    return issues;
  }

  const texts = build.objects.filter((o): o is TextObject => o.type === "text");
  const qr = build.objects.find((o) => o.type === "qrcode");
  const barcode = build.objects.find((o) => o.type === "barcode");
  const logo = build.objects.find((o) => o.type === "image" && o.slot === "logo");

  // 1a. Logo (§34): when enabled it must render, keep its aspect ratio,
  //     and stay clear of every text row — unless honestly dropped.
  const hiddenEarly = new Set(build.hiddenSlots);
  if (enabled.has("logo") && scenario.fields.logo && !hiddenEarly.has("logo")) {
    if (!logo) {
      push("error", "Logo enabled but no logo object was produced.");
    } else {
      const aspect = logo.widthMm / logo.heightMm;
      const want = scenario.logoAspect ?? 1;
      if (Math.abs(aspect - want) / want > 0.02) {
        push(
          "error",
          `Logo aspect drifted: placed ${aspect.toFixed(2)}:1, uploaded ${want.toFixed(2)}:1.`,
        );
      }
      const logoBox = objBox(logo);
      for (const text of texts) {
        if (intersects(logoBox, objBox(text))) {
          push("error", `Logo overlaps the "${text.slot}" text.`);
          break;
        }
      }
    }
  }

  // 1. Slot presence: every enabled slot with content and a row must render
  //    (unless it honestly collapsed — minLabelHeightMm or an announced drop).
  const hidden = new Set(build.hiddenSlots);
  for (const slot of scenario.enabled) {
    if (SLOTS[slot].kind === "qr" || SLOTS[slot].kind === "barcode") continue;
    const row =
      t.rows.find((r) => r.slot === slot) ??
      (t.verticalRow?.slot === slot ? t.verticalRow : undefined);
    if (!row) continue; // template legitimately doesn't carry this slot
    if ("minLabelHeightMm" in row && row.minLabelHeightMm && size.heightMm < row.minLabelHeightMm) continue;
    if (hidden.has(slot)) continue; // engine said so out loud
    if (!scenario.fields[slot]?.trim()) continue;
    const count = texts.filter((o) => o.slot === slot).length;
    if (count !== 1) {
      push("error", `Slot "${slot}" rendered ${count} objects (expected 1).`);
    }
  }

  // 1b. Density honesty: a template claiming "detailed" must actually hold
  //     the detailed scenario on a 30 mL label without hiding fields; any
  //     template must hold the baseline scenario on real vials.
  if (
    t.density === "detailed" &&
    size.densityAnchor &&
    scenario.id === "detailed" &&
    build.hiddenSlots.length > 0
  ) {
    push(
      "error",
      `Declares density "detailed" but hides ${build.hiddenSlots.join(", ")} in the detailed scenario on ${size.id}.`,
    );
  }
  if (size.real && scenario.id === "baseline" && build.hiddenSlots.length > 0) {
    push("error", `Hides ${build.hiddenSlots.join(", ")} even in the baseline scenario.`);
  }
  if (enabled.has("qr") && scenario.fields.qr && !qr && !hidden.has("qr")) {
    push("error", "QR enabled but no QR object was produced.");
  }
  if (
    enabled.has("barcode") &&
    scenario.fields.barcode &&
    !barcode &&
    !hidden.has("barcode")
  ) {
    push("error", "Barcode enabled but no barcode object was produced.");
  }
  // Codes may only vanish on genuinely tiny labels — a real vial size that
  // hides a wanted code is a design failure, not an honest collapse.
  if (size.real) {
    for (const code of ["qr", "barcode"] as const) {
      if (enabled.has(code) && scenario.fields[code] && hidden.has(code) && !CODES_MAY_DROP.has(scenario.id)) {
        push("error", `The ${code === "qr" ? "QR code" : "barcode"} was dropped on a standard vial size.`);
      }
    }
  }

  // 2. Bounds: nothing escapes the trim box (with sub-safe tolerance).
  const slack = 0.65; // centered boxes may include internal padding
  for (const o of [
    ...texts,
    ...(qr ? [qr] : []),
    ...(barcode ? [barcode] : []),
    ...(logo ? [logo] : []),
  ]) {
    const box = objBox(o);
    if (
      box.left < -slack ||
      box.right > size.widthMm + slack ||
      box.top < -slack ||
      box.bottom > size.heightMm + slack
    ) {
      push(
        "error",
        `"${o.slot}" escapes the label edge (${box.left.toFixed(1)}–${box.right.toFixed(1)} × ${box.top.toFixed(1)}–${box.bottom.toFixed(1)} on ${size.widthMm}×${size.heightMm}).`,
      );
    }
  }

  // 3. Print-size floors (§10/§21).
  for (const o of texts) {
    if (o.fontSizePt < 3.95) {
      push("error", `"${o.slot}" falls below the allowed print size (${o.fontSizePt.toFixed(1)} pt < 4 pt).`);
    }
  }

  // 4. Hierarchy: the product name must not be out-shouted by small print.
  const productSize = texts.find((o) => o.slot === "product-name")?.fontSizePt;
  if (productSize) {
    for (const o of texts) {
      if (o.slot === "product-name" || o.slot === "brand" || o.slot === "strength") continue;
      if (o.fontSizePt > productSize + 0.01) {
        push("error", `"${o.slot}" (${o.fontSizePt.toFixed(1)} pt) overpowers the product name (${productSize.toFixed(1)} pt).`);
      }
    }
  }

  // 5. Code quality gates.
  if (qr) {
    if (qr.widthMm < 8.95) {
      push("error", `QR code is ${qr.widthMm.toFixed(1)} mm — below the 9 mm scannable floor.`);
    }
    for (const o of texts) {
      if (intersects(objBox(qr), objBox(o))) {
        push("error", `QR code overlaps "${o.slot}" — its quiet zone is compromised.`);
      }
    }
  }
  if (barcode) {
    if (barcode.widthMm < 15.9) {
      push("error", `Barcode is ${barcode.widthMm.toFixed(1)} mm wide — below the 16 mm floor.`);
    }
    for (const o of texts) {
      if (intersects(objBox(barcode), objBox(o))) {
        push("error", `Barcode overlaps "${o.slot}".`);
      }
    }
    if (qr && intersects(objBox(qr), objBox(barcode))) {
      push("error", "QR code and barcode overlap each other.");
    }
  }

  // 6. Text rows must not overlap each other.
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i]!;
      const b = texts[j]!;
      if (a.rotationDeg !== 0 || b.rotationDeg !== 0) continue; // vertical row has its own gutter
      if (intersects(objBox(a), objBox(b), 0.45)) {
        push("error", `Rows "${a.slot}" and "${b.slot}" overlap.`);
      }
    }
  }

  // 7. Contrast: every text reads against what's actually behind it.
  const effectBg = build.background.type === "finish";
  const transparentBg = build.background.type === "none";
  for (const o of texts) {
    if (o.fill.type !== "solid") continue; // effect-title fills are display, not body copy
    const backing = backingAt(build.objects, o);
    // Print floors: small regular text needs 4.5:1; small BOLD text stays
    // legible at 3.5:1 in print; display sizes need 3:1.
    const needed =
      o.fontSizePt >= 7 ? 3 : o.fontWeight >= 600 ? 3.5 : 4.5;
    if (backing) {
      const ratio = contrastRatio(o.fill.color, backing);
      if (ratio < needed - 0.05) {
        push(
          "error",
          `"${o.slot}" has ${ratio.toFixed(2)}:1 contrast on its panel (needs ${needed}:1).`,
        );
      }
    } else if (effectBg) {
      push("error", `"${o.slot}" sits raw on the effect background with no readability protection.`);
    } else if (transparentBg) {
      const lum = contrastRatio(o.fill.color, "#ffffff");
      const lumDark = contrastRatio(o.fill.color, "#000000");
      if (lum < 2.5 && lumDark < 2.5) {
        push(
          "warning",
          `Transparent design: "${o.slot}" is a mid-tone that may vanish over the product (add a panel or use a dark/light ink).`,
        );
      }
    } else if (build.background.type === "solid") {
      const ratio = contrastRatio(o.fill.color, build.background.color);
      if (ratio < needed - 0.05) {
        push("error", `"${o.slot}" has ${ratio.toFixed(2)}:1 contrast on the background (needs ${needed}:1).`);
      }
    }
  }

  return issues;
}

/** Validate the whole registry (plus registry-level uniqueness). */
export function validateAllTemplates(): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  const ids = new Set<string>();
  const familyNames = new Map<string, string>();
  for (const t of EASY_TEMPLATES) {
    if (ids.has(t.id)) {
      issues.push({ templateId: t.id, context: "registry", severity: "error", message: "Duplicate template id." });
    }
    ids.add(t.id);
    const existing = familyNames.get(t.family);
    if (existing && existing !== t.familyName) {
      issues.push({
        templateId: t.id,
        context: "registry",
        severity: "error",
        message: `Family "${t.family}" has two display names ("${existing}" vs "${t.familyName}").`,
      });
    }
    familyNames.set(t.family, t.familyName);
    issues.push(...validateTemplate(t));
  }
  // Every referenced palette must exist (guards against id typos).
  for (const m of MATERIALS) {
    for (const pid of m.paletteIds) {
      if (!EASY_PALETTES.some((p) => p.id === pid)) {
        issues.push({
          templateId: `material:${m.id}`,
          context: "registry",
          severity: "error",
          message: `Material references unknown palette "${pid}".`,
        });
      }
    }
  }
  // Pairings must be internally valid even if no template uses them yet.
  for (const p of FONT_PAIRINGS) {
    for (const role of ["display", "body", "technical"] as const) {
      const family = roleFamily(p, role);
      if (!getFontFamily(family)) {
        issues.push({
          templateId: `pairing:${p.id}`,
          context: "registry",
          severity: "error",
          message: `Pairing role ${role} references unbundled family "${family}".`,
        });
      }
    }
    if (getPairing(p.id).id !== p.id) {
      issues.push({
        templateId: `pairing:${p.id}`,
        context: "registry",
        severity: "error",
        message: "Duplicate pairing id.",
      });
    }
  }
  return issues;
}
