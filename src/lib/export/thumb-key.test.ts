import { describe, expect, it } from "vitest";
import { buildEasyDocument, DEFAULT_ENABLED, defaultEasyFields } from "@/lib/easy/create-doc";
import { getVialPreset } from "@/lib/vials/presets";
import { stableDocKey } from "./thumb-key";

const spec = (overrides: Record<string, unknown> = {}) => ({
  preset: getVialPreset("10ml-serum")!,
  templateId: "clinical-frame",
  materialId: "plain",
  materialOptionId: "plain-white",
  paletteId: "white-black",
  fields: defaultEasyFields({
    brand: "AURELIS LABS",
    "product-name": "Retinol Serum",
  }),
  enabled: DEFAULT_ENABLED,
  ...overrides,
});

describe("stableDocKey", () => {
  it("ignores freshly-minted object ids — identical layouts share a key", () => {
    // Two engine builds of the same spec differ ONLY in object ids.
    const a = buildEasyDocument(spec());
    const b = buildEasyDocument(spec());
    expect(a.objects[0]!.id).not.toBe(b.objects[0]!.id);
    expect(stableDocKey(a, 480)).toBe(stableDocKey(b, 480));
  });

  it("changes when anything visual changes", () => {
    const base = stableDocKey(buildEasyDocument(spec()), 480);
    const otherPalette = stableDocKey(
      buildEasyDocument(spec({ paletteId: "black-white" })),
      480,
    );
    const otherText = stableDocKey(
      buildEasyDocument(
        spec({ fields: defaultEasyFields({ "product-name": "Other Name" }) }),
      ),
      480,
    );
    expect(otherPalette).not.toBe(base);
    expect(otherText).not.toBe(base);
  });

  it("keys include the raster size", () => {
    const doc = buildEasyDocument(spec());
    expect(stableDocKey(doc, 480)).not.toBe(stableDocKey(doc, 720));
  });
});
