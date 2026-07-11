import { describe, expect, it } from "vitest";
import { PDFDocument } from "@cantoo/pdf-lib";
import { mmToPt } from "@/lib/geometry/units";
import { createSingleLabelPdf } from "./pdf";

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function tinyPng(): Uint8Array {
  return Uint8Array.from(Buffer.from(TINY_PNG_BASE64, "base64"));
}

/** Golden dimension tests: PDF boxes must equal the mm spec in points. */
describe("createSingleLabelPdf", () => {
  const LABEL = { widthMm: 73.969, heightMm: 26, bleedMm: 2 };

  it("sets TrimBox to the exact finished size", async () => {
    const bytes = await createSingleLabelPdf({
      ...LABEL,
      pngBytes: tinyPng(),
      cropMarks: true,
      title: "Test label",
    });
    const pdf = await PDFDocument.load(bytes);
    const page = pdf.getPage(0);

    const trim = page.getTrimBox();
    expect(trim.width).toBeCloseTo(mmToPt(73.969), 6);
    expect(trim.height).toBeCloseTo(mmToPt(26), 6);

    const bleed = page.getBleedBox();
    expect(bleed.width).toBeCloseTo(mmToPt(73.969 + 4), 6);
    expect(bleed.height).toBeCloseTo(mmToPt(26 + 4), 6);

    // Page = trim + bleed + 6 mm mark margin on each side.
    const media = page.getMediaBox();
    expect(media.width).toBeCloseTo(mmToPt(73.969 + 4 + 12), 6);
    expect(media.height).toBeCloseTo(mmToPt(26 + 4 + 12), 6);

    // Trim box is centered.
    expect(trim.x).toBeCloseTo(mmToPt(8), 6);
    expect(trim.y).toBeCloseTo(mmToPt(8), 6);
  });

  it("omits the mark margin when crop marks are disabled", async () => {
    const bytes = await createSingleLabelPdf({
      ...LABEL,
      pngBytes: tinyPng(),
      cropMarks: false,
    });
    const pdf = await PDFDocument.load(bytes);
    const page = pdf.getPage(0);
    const media = page.getMediaBox();
    expect(media.width).toBeCloseTo(mmToPt(73.969 + 4), 6);
    expect(media.height).toBeCloseTo(mmToPt(26 + 4), 6);
    const trim = page.getTrimBox();
    expect(trim.x).toBeCloseTo(mmToPt(2), 6);
  });

  it("records metadata", async () => {
    const bytes = await createSingleLabelPdf({
      ...LABEL,
      pngBytes: tinyPng(),
      cropMarks: false,
      title: "AURELIS Serum",
    });
    // updateMetadata: false — load() would otherwise stamp its own Producer.
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(pdf.getTitle()).toBe("AURELIS Serum");
    expect(pdf.getProducer()).toBe("Forge Labels");
  });
});
