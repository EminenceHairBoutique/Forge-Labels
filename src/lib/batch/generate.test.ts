import { describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import type { LabelDocument, LabelObject } from "@/lib/document/schema";
import { createDocument } from "@/lib/document/defaults";
import { barcode, text } from "@/lib/templates/authoring";
import { generateBatchZip, type BatchJob } from "./generate";
import { rowFileName } from "./filename";
import { validateRow, recordForRow } from "./validate";
import { extractTokens } from "./tokens";

function makeDoc(objects: LabelObject[]): LabelDocument {
  return { ...createDocument(), objects };
}

const DOC = makeDoc([
  text({ id: "t", text: "Lot {{lot}}", xMm: 20, yMm: 10, widthMm: 30, fontSizePt: 8 }),
]);

function job(overrides: Partial<BatchJob> = {}): BatchJob {
  return {
    doc: DOC,
    headers: ["lot"],
    rows: [["A1"], ["B2"], ["C3"]],
    mapping: { lot: 0 },
    dpi: 300,
    mode: "sticker",
    baseName: "test",
    skipInvalid: true,
    ...overrides,
  };
}

/** Deterministic fake renderer: encodes the substituted text as bytes. */
async function stubRender(doc: LabelDocument): Promise<Uint8Array> {
  const t = doc.objects[0] as { text: string };
  return new TextEncoder().encode(`PNG:${t.text}`);
}

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

describe("generateBatchZip", () => {
  it("exports one entry per row plus manifest and README", async () => {
    const result = await generateBatchZip(job(), {}, stubRender);
    expect(result.exported).toBe(3);
    expect(result.skipped).toBe(0);

    const entries = unzipSync(await blobBytes(result.blob));
    const names = Object.keys(entries);
    expect(names).toEqual([
      "test-row-001.png",
      "test-row-002.png",
      "test-row-003.png",
      "manifest.csv",
      "README.txt",
    ]);
    expect(strFromU8(entries["test-row-001.png"]!)).toBe("PNG:Lot A1");
    const manifest = strFromU8(entries["manifest.csv"]!);
    expect(manifest).toContain("file,row,lot");
    expect(manifest).toContain("test-row-002.png,2,B2");
  });

  it("names files from a chosen column with collision suffixes", async () => {
    const result = await generateBatchZip(
      job({ rows: [["A1"], ["A1"], ["B2"]], filenameColumn: 0 }),
      {},
      stubRender,
    );
    const names = Object.keys(unzipSync(await blobBytes(result.blob)));
    expect(names).toContain("test-A1.png");
    expect(names).toContain("test-A1-2.png");
    expect(names).toContain("test-B2.png");
  });

  it("skips rows failing validation when skipInvalid is on", async () => {
    const doc = makeDoc([
      barcode({
        id: "b",
        value: "{{ean}}",
        xMm: 30,
        yMm: 10,
        widthMm: 30,
        heightMm: 12,
        symbology: "ean13",
      }),
    ]);
    const result = await generateBatchZip(
      job({
        doc,
        headers: ["ean"],
        rows: [["4006381333931"], ["not-a-number"]],
        mapping: { ean: 0 },
      }),
      {},
      stubRender,
    );
    expect(result.exported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("fails fast on invalid rows when skipInvalid is off", async () => {
    const doc = makeDoc([
      barcode({
        id: "b",
        value: "{{ean}}",
        xMm: 30,
        yMm: 10,
        widthMm: 30,
        heightMm: 12,
        symbology: "ean13",
      }),
    ]);
    await expect(
      generateBatchZip(
        job({
          doc,
          headers: ["ean"],
          rows: [["nope"]],
          mapping: { ean: 0 },
          skipInvalid: false,
        }),
        {},
        stubRender,
      ),
    ).rejects.toThrow(/failed validation/);
  });

  it("honors the abort signal between rows", async () => {
    const controller = new AbortController();
    let rendered = 0;
    await expect(
      generateBatchZip(
        job(),
        { signal: controller.signal },
        async (doc) => {
          rendered += 1;
          controller.abort();
          return stubRender(doc);
        },
      ),
    ).rejects.toThrow(/cancelled/);
    expect(rendered).toBe(1);
  });

  it("reports progress with a size estimate after the first row", async () => {
    const seen: number[] = [];
    let estimate: number | undefined;
    await generateBatchZip(
      job(),
      {
        onProgress: (p) => {
          seen.push(p.done);
          estimate ??= p.estimatedZipBytes;
        },
      },
      stubRender,
    );
    expect(seen).toEqual([1, 2, 3]);
    expect(estimate).toBe("PNG:Lot A1".length * 3);
  });
});

describe("validateRow + recordForRow", () => {
  it("maps headers to record values", () => {
    expect(recordForRow(["a", "b"], ["1"])).toEqual({ a: "1", b: "" });
  });

  it("reports QR-empty and barcode errors per row", () => {
    const doc = makeDoc([
      text({ id: "t", text: "{{x}}", xMm: 10, yMm: 5, widthMm: 20, fontSizePt: 8 }),
    ]);
    const refs = extractTokens(doc);
    const issues = validateRow(doc, refs, { x: "" }, 0);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe("warning");
  });
});

describe("rowFileName", () => {
  it("zero-pads row numbers and sanitizes column values", () => {
    const used = new Set<string>();
    expect(rowFileName("base", 6, undefined, used)).toBe("base-row-007.png");
    expect(rowFileName("base", 0, "Lot #42!", used)).toBe("base-Lot-42.png");
  });
});
