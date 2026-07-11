import { describe, expect, it } from "vitest";
import { parseLabelDocument } from "@/lib/document/schema";
import { availableWeights, getFontFamily } from "@/lib/fonts/registry";
import { bleedRect, objectAabb } from "@/lib/render/geometry";
import { validateBarcodeValue } from "@/lib/codes/validate";
import { getVialPreset } from "@/lib/vials/presets";
import { applyTemplate } from "./apply";
import { ALL_TEMPLATES } from "./registry";
import { DEMO_BRANDS, TEMPLATE_CATEGORIES } from "./types";
import { createDocument } from "@/lib/document/defaults";

const CATEGORY_IDS = new Set(TEMPLATE_CATEGORIES.map((c) => c.id));
const BRANDS = new Set<string>(DEMO_BRANDS);

describe("template library", () => {
  it("has a healthy library size with unique ids", () => {
    expect(ALL_TEMPLATES.length).toBeGreaterThanOrEqual(12);
    const ids = ALL_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers most categories", () => {
    const covered = new Set(ALL_TEMPLATES.flatMap((t) => t.categories));
    expect(covered.size).toBeGreaterThanOrEqual(8);
  });

  for (const template of ALL_TEMPLATES) {
    describe(`template: ${template.id}`, () => {
      it("uses a fictional demo brand and valid categories", () => {
        expect(BRANDS.has(template.brand)).toBe(true);
        expect(template.categories.length).toBeGreaterThan(0);
        for (const c of template.categories) expect(CATEGORY_IDS.has(c)).toBe(true);
        expect(getVialPreset(template.presetId)).toBeDefined();
      });

      it("produces a schema-valid document", () => {
        expect(() => parseLabelDocument(template.doc)).not.toThrow();
      });

      it("references only bundled fonts and weights", () => {
        const check = (objects: typeof template.doc.objects) => {
          for (const obj of objects) {
            if (obj.type === "text") {
              expect(
                getFontFamily(obj.fontFamilyId),
                `unknown font ${obj.fontFamilyId}`,
              ).toBeDefined();
              expect(
                availableWeights(obj.fontFamilyId),
                `${obj.fontFamilyId} lacks weight ${obj.fontWeight}`,
              ).toContain(obj.fontWeight);
            }
            if (obj.type === "group") check(obj.children);
          }
        };
        check(template.doc.objects);
      });

      it("keeps objects inside the bleed area and text legible", () => {
        const bounds = bleedRect(template.doc);
        const epsilon = 0.75;
        for (const obj of template.doc.objects) {
          const box = objectAabb(obj);
          expect(box.x, `${obj.name || obj.type} left`).toBeGreaterThanOrEqual(
            bounds.x - epsilon,
          );
          expect(box.y, `${obj.name || obj.type} top`).toBeGreaterThanOrEqual(
            bounds.y - epsilon,
          );
          expect(
            box.x + box.width,
            `${obj.name || obj.type} right`,
          ).toBeLessThanOrEqual(bounds.x + bounds.width + epsilon);
          expect(
            box.y + box.height,
            `${obj.name || obj.type} bottom`,
          ).toBeLessThanOrEqual(bounds.y + bounds.height + epsilon);
          if (obj.type === "text") {
            expect(obj.fontSizePt, `${obj.name} font size`).toBeGreaterThanOrEqual(3.5);
          }
        }
      });

      it("encodes valid QR/barcode payloads", () => {
        for (const obj of template.doc.objects) {
          if (obj.type === "qrcode") {
            expect(obj.value.length).toBeGreaterThan(0);
          }
          if (obj.type === "barcode") {
            const v = validateBarcodeValue(obj.symbology, obj.value);
            expect(v.ok, `${template.id}: ${v.message}`).toBe(true);
          }
        }
      });
    });
  }

  it("applyTemplate rescales into a different label size", () => {
    const template = ALL_TEMPLATES[0]!;
    const target = createDocument({ preset: getVialPreset("30ml-dropper")! });
    const applied = applyTemplate(target, template.doc);

    expect(applied.label).toEqual(target.label);
    expect(applied.objects.length).toBe(template.doc.objects.length);
    expect(() => parseLabelDocument(applied)).not.toThrow();

    // Everything must land inside the target bleed area.
    const bounds = bleedRect(applied);
    for (const obj of applied.objects) {
      const box = objectAabb(obj);
      expect(box.x).toBeGreaterThanOrEqual(bounds.x - 0.75);
      expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 0.75);
    }
  });
});
