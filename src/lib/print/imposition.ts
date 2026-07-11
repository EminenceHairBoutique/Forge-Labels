/**
 * Sheet imposition: lay out N copies of a label on printable pages.
 *
 * Pure math, mm units, property-tested. Cells include the label's bleed (so
 * adjacent artwork never overlaps) and the grid is centered inside the page
 * margins, then shifted by the user's printer-calibration offsets.
 */

export interface PageSizeDef {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
}

export const PAGE_SIZES: readonly PageSizeDef[] = [
  { id: "letter", name: "US Letter (8.5×11 in)", widthMm: 215.9, heightMm: 279.4 },
  { id: "a4", name: "A4 (210×297 mm)", widthMm: 210, heightMm: 297 },
  { id: "legal", name: "US Legal (8.5×14 in)", widthMm: 215.9, heightMm: 355.6 },
] as const;

export interface ImpositionInput {
  pageWidthMm: number;
  pageHeightMm: number;
  /** Finished label size (trim). */
  labelWidthMm: number;
  labelHeightMm: number;
  /** Artwork bleed per side; cells reserve room for it. */
  bleedMm: number;
  marginMm: number;
  spacingXMm: number;
  spacingYMm: number;
  /** Whole-grid calibration shift (printer alignment). */
  offsetXMm: number;
  offsetYMm: number;
  /** Total labels to place. */
  copies: number;
  /** Skip cells on the first page (reusing a partially-used sheet), 0-based. */
  startRow: number;
  startCol: number;
}

export interface PlacedCell {
  pageIndex: number;
  row: number;
  col: number;
  /** Top-left of the artwork cell (label + bleed), from the page top-left. */
  xMm: number;
  yMm: number;
}

export interface ImpositionResult {
  columns: number;
  rows: number;
  perPage: number;
  /** Artwork cell size (trim + 2×bleed). */
  cellWidthMm: number;
  cellHeightMm: number;
  /** Grid origin on a full page (before skips), from page top-left. */
  originXMm: number;
  originYMm: number;
  pages: PlacedCell[][];
  pageCount: number;
  placedCount: number;
  /** Fraction of the page covered by finished labels (waste indicator). */
  usedAreaRatio: number;
  issues: string[];
}

export function computeImposition(input: ImpositionInput): ImpositionResult {
  const issues: string[] = [];
  const cellW = input.labelWidthMm + 2 * input.bleedMm;
  const cellH = input.labelHeightMm + 2 * input.bleedMm;
  const printW = input.pageWidthMm - 2 * input.marginMm;
  const printH = input.pageHeightMm - 2 * input.marginMm;

  const empty: ImpositionResult = {
    columns: 0,
    rows: 0,
    perPage: 0,
    cellWidthMm: cellW,
    cellHeightMm: cellH,
    originXMm: input.marginMm,
    originYMm: input.marginMm,
    pages: [],
    pageCount: 0,
    placedCount: 0,
    usedAreaRatio: 0,
    issues,
  };

  if (printW <= 0 || printH <= 0) {
    issues.push("The margins leave no printable area on this page size.");
    return empty;
  }
  if (cellW > printW || cellH > printH) {
    issues.push(
      "The label (including bleed) is larger than the printable area. Use a bigger page or smaller margins.",
    );
    return empty;
  }

  const columns = Math.floor(
    (printW + input.spacingXMm) / (cellW + input.spacingXMm),
  );
  const rows = Math.floor((printH + input.spacingYMm) / (cellH + input.spacingYMm));
  const perPage = columns * rows;
  if (perPage === 0) {
    issues.push("Nothing fits with the current spacing.");
    return empty;
  }

  const gridW = columns * cellW + (columns - 1) * input.spacingXMm;
  const gridH = rows * cellH + (rows - 1) * input.spacingYMm;
  const originX = input.marginMm + (printW - gridW) / 2 + input.offsetXMm;
  const originY = input.marginMm + (printH - gridH) / 2 + input.offsetYMm;

  const startRow = Math.min(Math.max(input.startRow, 0), rows - 1);
  const startCol = Math.min(Math.max(input.startCol, 0), columns - 1);
  const skip = startRow * columns + startCol;
  if (skip !== input.startRow * columns + input.startCol) {
    issues.push("Start position was clamped to the grid.");
  }

  const copies = Math.max(Math.floor(input.copies), 0);
  const pages: PlacedCell[][] = [];
  let placed = 0;

  for (let index = skip; placed < copies; index++) {
    const pageIndex = Math.floor(index / perPage);
    const cellIndex = index % perPage;
    const row = Math.floor(cellIndex / columns);
    const col = cellIndex % columns;
    (pages[pageIndex] ??= []).push({
      pageIndex,
      row,
      col,
      xMm: originX + col * (cellW + input.spacingXMm),
      yMm: originY + row * (cellH + input.spacingYMm),
    });
    placed++;
  }

  // A skipped-over first page can exist with zero cells only when copies=0.
  const pageCount = pages.length;
  const labelArea = input.labelWidthMm * input.labelHeightMm;
  const pageArea = input.pageWidthMm * input.pageHeightMm;

  if (input.offsetXMm !== 0 || input.offsetYMm !== 0) {
    const minX = originX;
    const minY = originY;
    const maxX = originX + gridW;
    const maxY = originY + gridH;
    if (minX < 0 || minY < 0 || maxX > input.pageWidthMm || maxY > input.pageHeightMm) {
      issues.push("The calibration offset pushes some labels off the page.");
    }
  }

  return {
    columns,
    rows,
    perPage,
    cellWidthMm: cellW,
    cellHeightMm: cellH,
    originXMm: originX,
    originYMm: originY,
    pages,
    pageCount,
    placedCount: placed,
    usedAreaRatio: Math.min((perPage * labelArea) / pageArea, 1),
    issues,
  };
}
