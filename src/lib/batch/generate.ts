import { Zip, ZipPassThrough, strToU8 } from "fflate";
import type { LabelDocument } from "@/lib/document/schema";
import { rowFileName } from "./filename";
import { extractTokens, substituteTokens } from "./tokens";
import { validateRow, type RowIssue } from "./validate";

/**
 * Batch generation: substitute each CSV row into the document, render it
 * through the standard raster exporter, and stream the PNGs into a ZIP.
 * Rows render sequentially (one Konva stage alive at a time) with an
 * event-loop yield between rows so progress paints and Cancel is honored.
 * PNGs are stored uncompressed in the ZIP (they don't re-compress) and each
 * row's bytes are handed to the zip stream immediately — memory stays ~1×
 * the output size instead of zipSync's input-map + output ~2×.
 */

export interface BatchJob {
  doc: LabelDocument;
  headers: string[];
  rows: string[][];
  /** token → CSV column index (tokens absent from the map stay literal). */
  mapping: Record<string, number>;
  dpi: 300 | 600;
  mode: "print" | "sticker";
  baseName: string;
  /** Column index whose value names each file; default row numbers. */
  filenameColumn?: number;
  /** Skip rows with validation errors (otherwise they fail the export). */
  skipInvalid: boolean;
}

export interface BatchProgress {
  done: number;
  total: number;
  skipped: number;
  estimatedZipBytes?: number;
}

export interface BatchResult {
  blob: Blob;
  issues: RowIssue[];
  skipped: number;
  exported: number;
}

/** Hard output ceiling — beyond this the tab will likely die anyway. */
export const MAX_ZIP_BYTES = 400 * 1024 * 1024;
/** Advisory threshold surfaced in the progress UI. */
export const WARN_ZIP_BYTES = 150 * 1024 * 1024;

async function defaultRenderRow(
  doc: LabelDocument,
  options: { dpi: 300 | 600; mode: "print" | "sticker" },
): Promise<Uint8Array> {
  const { exportRaster } = await import("@/lib/export/raster");
  const raster = await exportRaster(doc, {
    dpi: options.dpi,
    mode: options.mode,
    format: "png",
  });
  return new Uint8Array(await raster.blob.arrayBuffer());
}

export async function generateBatchZip(
  job: BatchJob,
  hooks: {
    onProgress?: (progress: BatchProgress) => void;
    signal?: AbortSignal;
  } = {},
  renderRow: (
    doc: LabelDocument,
    options: { dpi: 300 | 600; mode: "print" | "sticker" },
  ) => Promise<Uint8Array> = defaultRenderRow,
): Promise<BatchResult> {
  const refs = extractTokens(job.doc);
  const issues: RowIssue[] = [];
  const usedNames = new Set<string>();
  const manifest: string[] = [
    ["file", "row", ...job.headers].map(csvEscape).join(","),
  ];

  const chunks: Uint8Array[] = [];
  let zipError: Error | null = null;
  let finished!: () => void;
  const done = new Promise<void>((resolve) => {
    finished = resolve;
  });
  const zip = new Zip((err, chunk, final) => {
    if (err) zipError = err;
    else chunks.push(chunk);
    if (final) finished();
  });
  const addFile = (name: string, bytes: Uint8Array) => {
    const entry = new ZipPassThrough(name);
    zip.add(entry);
    entry.push(bytes, true);
    if (zipError) throw zipError;
  };

  let exported = 0;
  let skipped = 0;
  let estimatedZipBytes: number | undefined;
  let totalBytes = 0;

  for (let r = 0; r < job.rows.length; r++) {
    if (hooks.signal?.aborted) throw new Error("Batch export cancelled.");

    const row = job.rows[r]!;
    // Record keyed by token name via the mapping (unmapped tokens stay
    // literal in the output — reported during setup, not here).
    const record: Record<string, string> = {};
    for (const [token, column] of Object.entries(job.mapping)) {
      record[token] = row[column] ?? "";
    }

    const rowIssues = validateRow(job.doc, refs, record, r);
    issues.push(...rowIssues);
    const hasError = rowIssues.some((i) => i.severity === "error");
    if (hasError) {
      if (!job.skipInvalid) {
        zip.terminate();
        throw new Error(
          `Row ${r + 1} failed validation: ${rowIssues[0]!.objectName} — ${rowIssues[0]!.message}`,
        );
      }
      skipped += 1;
      hooks.onProgress?.({
        done: r + 1,
        total: job.rows.length,
        skipped,
        estimatedZipBytes,
      });
      continue;
    }

    const rowDoc = substituteTokens(job.doc, record);
    const bytes = await renderRow(rowDoc, { dpi: job.dpi, mode: job.mode });
    totalBytes += bytes.byteLength;
    if (estimatedZipBytes === undefined) {
      estimatedZipBytes = bytes.byteLength * job.rows.length;
    }
    if (totalBytes > MAX_ZIP_BYTES) {
      zip.terminate();
      throw new Error(
        "The batch exceeds 400 MB. Reduce the row count or switch to 300 DPI.",
      );
    }

    const filenameValue =
      job.filenameColumn !== undefined ? row[job.filenameColumn] : undefined;
    const fileName = rowFileName(job.baseName, r, filenameValue, usedNames);
    addFile(fileName, bytes);
    manifest.push([fileName, String(r + 1), ...row].map(csvEscape).join(","));
    exported += 1;

    hooks.onProgress?.({
      done: r + 1,
      total: job.rows.length,
      skipped,
      estimatedZipBytes,
    });
    // Let the UI paint between rows.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  addFile("manifest.csv", strToU8(`${manifest.join("\n")}\n`));
  addFile(
    "README.txt",
    strToU8(
      `Forge Labels — batch export\n\n` +
        `Label: ${job.doc.label.widthMm.toFixed(2)} × ${job.doc.label.heightMm.toFixed(2)} mm` +
        ` (${job.mode === "print" ? `bleed ${job.doc.label.bleedMm} mm included` : "die-cut trim size"}, ${job.dpi} DPI)\n` +
        `Rows exported: ${exported}${skipped > 0 ? ` · skipped: ${skipped} (see manifest)` : ""}\n\n` +
        `manifest.csv maps each PNG back to its source row.\n` +
        `Print at 100% scale and verify one label on your vial before a full run.\n`,
    ),
  );

  zip.end();
  await done;
  if (zipError) throw zipError;

  return {
    blob: new Blob(chunks as unknown as BlobPart[], { type: "application/zip" }),
    issues,
    skipped,
    exported,
  };
}

function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
