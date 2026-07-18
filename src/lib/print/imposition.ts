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

/**
 * Precut label-sheet presets: the standard die-cut grids shared by many
 * sheet brands (deliberately unbranded — the packaging states the label
 * size and count, which is what these names lead with). All are
 * symmetric grids, which is how the centered imposition reproduces their
 * factory margins exactly.
 */
export interface SheetPresetDef {
  id: string;
  /** "A4 · 21 labels · 63.5 × 38.1 mm" — count + sticker size first. */
  name: string;
  pageId: "letter" | "a4";
  /** Die-cut sticker size. */
  cellWidthMm: number;
  cellHeightMm: number;
  columns: number;
  rows: number;
  spacingXMm: number;
  spacingYMm: number;
}

export const SHEET_PRESETS: readonly SheetPresetDef[] = [
  { id: "letter-30", name: "Letter · 30 labels · 66.7 × 25.4 mm", pageId: "letter", cellWidthMm: 66.675, cellHeightMm: 25.4, columns: 3, rows: 10, spacingXMm: 3.175, spacingYMm: 0 },
  { id: "letter-10", name: "Letter · 10 labels · 101.6 × 50.8 mm", pageId: "letter", cellWidthMm: 101.6, cellHeightMm: 50.8, columns: 2, rows: 5, spacingXMm: 4.8, spacingYMm: 0 },
  { id: "letter-80", name: "Letter · 80 labels · 44.5 × 12.7 mm", pageId: "letter", cellWidthMm: 44.45, cellHeightMm: 12.7, columns: 4, rows: 20, spacingXMm: 7.62, spacingYMm: 0 },
  { id: "a4-21", name: "A4 · 21 labels · 63.5 × 38.1 mm", pageId: "a4", cellWidthMm: 63.5, cellHeightMm: 38.1, columns: 3, rows: 7, spacingXMm: 2.5, spacingYMm: 0 },
  { id: "a4-24", name: "A4 · 24 labels · 63.5 × 33.9 mm", pageId: "a4", cellWidthMm: 63.5, cellHeightMm: 33.9, columns: 3, rows: 8, spacingXMm: 2.5, spacingYMm: 0 },
  { id: "a4-14", name: "A4 · 14 labels · 99.1 × 38.1 mm", pageId: "a4", cellWidthMm: 99.1, cellHeightMm: 38.1, columns: 2, rows: 7, spacingXMm: 2.5, spacingYMm: 0 },
  { id: "a4-65", name: "A4 · 65 labels · 38.1 × 21.2 mm", pageId: "a4", cellWidthMm: 38.1, cellHeightMm: 21.2, columns: 5, rows: 13, spacingXMm: 2.5, spacingYMm: 0 },
] as const;

export function getSheetPreset(id: string): SheetPresetDef | undefined {
  return SHEET_PRESETS.find((p) => p.id === id);
}

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
  /**
   * Precut-sheet mode: the grid and cell size come from the die-cut sheet
   * instead of being auto-fitted, and the label's TRIM centers inside
   * each sticker. Mismatched sizes produce plain-language issues, never
   * silent scaling.
   */
  sheet?: {
    columns: number;
    rows: number;
    cellWidthMm: number;
    cellHeightMm: number;
  };
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
  /** Cell size: trim + 2×bleed, or the die-cut sticker in sheet mode. */
  cellWidthMm: number;
  cellHeightMm: number;
  /**
   * Where the label's TRIM sits inside each cell. Auto mode: the bleed.
   * Sheet mode: centered in the sticker — the renderer and preview both
   * place from this, so they can't disagree.
   */
  trimInsetXMm: number;
  trimInsetYMm: number;
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
  const sheet = input.sheet;
  const cellW = sheet ? sheet.cellWidthMm : input.labelWidthMm + 2 * input.bleedMm;
  const cellH = sheet ? sheet.cellHeightMm : input.labelHeightMm + 2 * input.bleedMm;
  const trimInsetX = sheet
    ? (sheet.cellWidthMm - input.labelWidthMm) / 2
    : input.bleedMm;
  const trimInsetY = sheet
    ? (sheet.cellHeightMm - input.labelHeightMm) / 2
    : input.bleedMm;
  const printW = input.pageWidthMm - 2 * input.marginMm;
  const printH = input.pageHeightMm - 2 * input.marginMm;

  const empty: ImpositionResult = {
    columns: 0,
    rows: 0,
    perPage: 0,
    cellWidthMm: cellW,
    cellHeightMm: cellH,
    trimInsetXMm: trimInsetX,
    trimInsetYMm: trimInsetY,
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
  if (!sheet && (cellW > printW || cellH > printH)) {
    issues.push(
      "The label (including bleed) is larger than the printable area. Use a bigger page or smaller margins.",
    );
    return empty;
  }

  if (sheet) {
    // The die-cut grid is fixed — check it fits, then say plainly how the
    // label relates to the sticker. Never scale artwork to a sheet.
    const gridW = sheet.columns * cellW + (sheet.columns - 1) * input.spacingXMm;
    const gridH = sheet.rows * cellH + (sheet.rows - 1) * input.spacingYMm;
    if (gridW > input.pageWidthMm + 0.05 || gridH > input.pageHeightMm + 0.05) {
      issues.push("This sheet layout doesn't fit the selected page size.");
      return empty;
    }
    const wDiff = input.labelWidthMm - sheet.cellWidthMm;
    const hDiff = input.labelHeightMm - sheet.cellHeightMm;
    if (wDiff > 0.1 || hDiff > 0.1) {
      issues.push(
        `Your label (${input.labelWidthMm.toFixed(1)} × ${input.labelHeightMm.toFixed(1)} mm) is larger than this sheet's stickers (${sheet.cellWidthMm.toFixed(1)} × ${sheet.cellHeightMm.toFixed(1)} mm) — it will be cut off at the sticker edge.`,
      );
    } else if (wDiff < -6 || hDiff < -6) {
      issues.push(
        `Your label is noticeably smaller than this sheet's stickers (${sheet.cellWidthMm.toFixed(1)} × ${sheet.cellHeightMm.toFixed(1)} mm) — it prints centered with a blank border around it.`,
      );
    }
    if (
      input.bleedMm > 0.05 &&
      (input.bleedMm > trimInsetX + Math.min(input.spacingXMm, 4) ||
        input.bleedMm > trimInsetY + Math.min(input.spacingYMm, 4))
    ) {
      issues.push(
        "The artwork's bleed extends past the sticker onto its neighbors — fine for edge-to-edge designs, but neighbors of unused cells will show a sliver of color.",
      );
    }
  }

  const columns = sheet
    ? sheet.columns
    : Math.floor((printW + input.spacingXMm) / (cellW + input.spacingXMm));
  const rows = sheet
    ? sheet.rows
    : Math.floor((printH + input.spacingYMm) / (cellH + input.spacingYMm));
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
    trimInsetXMm: trimInsetX,
    trimInsetYMm: trimInsetY,
    originXMm: originX,
    originYMm: originY,
    pages,
    pageCount,
    placedCount: placed,
    usedAreaRatio: Math.min((perPage * labelArea) / pageArea, 1),
    issues,
  };
}
