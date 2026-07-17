import type { LabelDocument } from "@/lib/document/schema";
import { parseCsv } from "@/lib/batch/csv";
import { buildFamilyVariant, suggestPaletteForStrength, type FamilyOverrides } from "./family";
import { getMaterial, type MaterialDef } from "./materials";
import type { TextMeasure } from "./layout";

/**
 * Product-series generator (§14): many matching labels from one design.
 * Each row becomes a sibling project that keeps the brand, typography,
 * material, layout, dimensions, and notice — changing only the
 * product-specific fields, with optional per-row accent color coding.
 */

export interface SeriesRow {
  productName: string;
  abbreviation?: string;
  /** Combined into the strength slot ("10" + "mg" → "10 mg"). */
  amount?: string;
  unit?: string;
  catalog?: string;
  lot?: string;
  batch?: string;
  retest?: string;
  qr?: string;
  barcode?: string;
  /**
   * Accent coding: "auto" picks the conventional strength color; a
   * palette id uses it directly; empty keeps the source palette.
   */
  accent?: string;
}

export const SERIES_MAX_ROWS = 100;

export function rowStrength(row: SeriesRow): string | undefined {
  const amount = row.amount?.trim();
  if (!amount) return undefined;
  const unit = row.unit?.trim();
  return unit ? `${amount} ${unit}` : amount;
}

export function rowOverrides(
  row: SeriesRow,
  material: MaterialDef,
): FamilyOverrides {
  const strength = rowStrength(row);
  let paletteId: string | undefined;
  if (row.accent && row.accent !== "auto") {
    paletteId = row.accent;
  } else if (row.accent === "auto" && strength) {
    paletteId = suggestPaletteForStrength(strength, material)?.id;
  }
  return {
    productName: row.productName,
    abbreviation: row.abbreviation,
    strength,
    catalog: row.catalog,
    lot: row.lot,
    batch: row.batch,
    retest: row.retest,
    qr: row.qr,
    barcode: row.barcode,
    paletteId,
  };
}

/** Build one sibling document for a row (pure; measurer injectable). */
export function buildSeriesVariant(
  source: LabelDocument,
  row: SeriesRow,
  measure?: TextMeasure,
): LabelDocument {
  const material = source.easy ? getMaterial(source.easy.materialId) : undefined;
  if (!material) throw new Error("Series labels need an Easy Creator project.");
  return buildFamilyVariant(source, rowOverrides(row, material), measure);
}

// ---------------------------------------------------------------------------
// CSV import — reuses the RFC-4180 batch parser; headers map loosely
// ("Compound", "product name", "ABBR" all land where you'd expect).
// ---------------------------------------------------------------------------

const HEADER_ALIASES: Record<keyof SeriesRow, string[]> = {
  productName: ["product", "productname", "product name", "compound", "compound name", "name"],
  abbreviation: ["abbreviation", "abbr", "short name", "shortname"],
  amount: ["amount", "strength", "dose amount", "quantity"],
  unit: ["unit", "units"],
  catalog: ["catalog", "catalog number", "cat", "cat#", "catalogue"],
  lot: ["lot", "lot number", "lot#"],
  batch: ["batch", "batch number", "batch#"],
  retest: ["retest", "retest date"],
  qr: ["qr", "qr url", "url", "link", "verification url", "coa url"],
  barcode: ["barcode", "bar code", "gtin", "sku barcode"],
  accent: ["accent", "color", "colour", "accent color", "palette"],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export interface SeriesCsvResult {
  rows: SeriesRow[];
  errors: string[];
  /** Headers that matched nothing (ignored, reported honestly). */
  ignored: string[];
}

export function parseSeriesCsv(text: string): SeriesCsvResult {
  const parsed = parseCsv(text, { maxRows: SERIES_MAX_ROWS });
  const errors = parsed.errors.map((e) => `Row ${e.row}: ${e.message}`);
  const mapping = new Map<number, keyof SeriesRow>();
  const ignored: string[] = [];
  parsed.headers.forEach((header, index) => {
    const norm = normalizeHeader(header);
    const field = (Object.keys(HEADER_ALIASES) as (keyof SeriesRow)[]).find((key) =>
      HEADER_ALIASES[key].includes(norm),
    );
    if (field && ![...mapping.values()].includes(field)) mapping.set(index, field);
    else ignored.push(header);
  });
  if (![...mapping.values()].includes("productName")) {
    errors.push(
      'No product column found — name one of your columns "Compound", "Product", or "Name".',
    );
    return { rows: [], errors, ignored };
  }
  const rows: SeriesRow[] = [];
  for (const record of parsed.rows) {
    const row: Partial<SeriesRow> = {};
    mapping.forEach((field, index) => {
      const value = record[index]?.trim();
      if (value) row[field] = value;
    });
    if (row.productName) rows.push(row as SeriesRow);
  }
  if (parsed.truncated) {
    errors.push(`Only the first ${SERIES_MAX_ROWS} rows were read.`);
  }
  return { rows, errors, ignored };
}
