import { PDFDocument, StandardFonts, rgb, type PDFPage } from "@cantoo/pdf-lib";
import { mmToPt } from "@/lib/geometry/units";
import type { ImpositionResult } from "@/lib/print/imposition";

/**
 * Print-sheet PDF. The label artwork PNG is embedded ONCE and drawn per
 * cell (PDF XObject reuse), so a 30-up sheet costs one image — no giant
 * sheet canvas ever exists (critical for 600 DPI on low-memory devices).
 * Marks are vector. PDF y-axis is bottom-up; imposition is top-down.
 */

export interface SheetPdfOptions {
  pageWidthMm: number;
  pageHeightMm: number;
  imposition: ImpositionResult;
  /** Label artwork covering trim + bleed. */
  labelPngBytes: Uint8Array;
  labelWidthMm: number;
  labelHeightMm: number;
  bleedMm: number;
  /** Hairline rectangle at each label's trim (scissor guide). */
  cutLines: boolean;
  /** Corner crop marks per cell. */
  cropMarks: boolean;
  title?: string;
}

export async function createSheetPdf(options: SheetPdfOptions): Promise<Uint8Array> {
  const {
    imposition,
    pageWidthMm,
    pageHeightMm,
    labelWidthMm,
    labelHeightMm,
    bleedMm,
  } = options;

  const pdf = await PDFDocument.create();
  pdf.setTitle(options.title ?? "Label sheet");
  pdf.setProducer("Forge Labels");
  pdf.setCreator("Forge Labels");

  const png = await pdf.embedPng(options.labelPngBytes);
  const cellW = imposition.cellWidthMm;
  const cellH = imposition.cellHeightMm;

  for (const cells of imposition.pages) {
    const page = pdf.addPage([mmToPt(pageWidthMm), mmToPt(pageHeightMm)]);
    for (const cell of cells) {
      // Flip y: imposition yMm measures from the page top.
      const yTop = cell.yMm;
      const yPdf = pageHeightMm - yTop - cellH;
      page.drawImage(png, {
        x: mmToPt(cell.xMm),
        y: mmToPt(yPdf),
        width: mmToPt(cellW),
        height: mmToPt(cellH),
      });

      const trimX = cell.xMm + bleedMm;
      const trimYTop = yTop + bleedMm;
      const trimYPdf = pageHeightMm - trimYTop - labelHeightMm;

      if (options.cutLines) {
        page.drawRectangle({
          x: mmToPt(trimX),
          y: mmToPt(trimYPdf),
          width: mmToPt(labelWidthMm),
          height: mmToPt(labelHeightMm),
          borderColor: rgb(0.62, 0.62, 0.62),
          borderWidth: 0.25,
        });
      }
      if (options.cropMarks) {
        drawCellCropMarks(page, {
          xMm: trimX,
          yPdfMm: trimYPdf,
          widthMm: labelWidthMm,
          heightMm: labelHeightMm,
          bleedMm,
        });
      }
    }
  }

  return pdf.save();
}

function drawCellCropMarks(
  page: PDFPage,
  rect: { xMm: number; yPdfMm: number; widthMm: number; heightMm: number; bleedMm: number },
): void {
  const len = 2.5;
  const gap = rect.bleedMm + 0.5;
  const black = rgb(0, 0, 0);
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    page.drawLine({
      start: { x: mmToPt(x1), y: mmToPt(y1) },
      end: { x: mmToPt(x2), y: mmToPt(y2) },
      thickness: 0.3,
      color: black,
    });

  const xL = rect.xMm;
  const xR = rect.xMm + rect.widthMm;
  const yB = rect.yPdfMm;
  const yT = rect.yPdfMm + rect.heightMm;

  line(xL, yT + gap, xL, yT + gap + len);
  line(xR, yT + gap, xR, yT + gap + len);
  line(xL, yB - gap, xL, yB - gap - len);
  line(xR, yB - gap, xR, yB - gap - len);
  line(xL - gap, yT, xL - gap - len, yT);
  line(xL - gap, yB, xL - gap - len, yB);
  line(xR + gap, yT, xR + gap + len, yT);
  line(xR + gap, yB, xR + gap + len, yB);
}

// ---------------------------------------------------------------------------
// Calibration page
// ---------------------------------------------------------------------------

/**
 * A page that verifies "100% scale" printing and measures the printer's
 * offset: two 100 mm reference bars plus mm-graduated rulers from the
 * top-left corner. Instructions are printed on the page itself.
 */
export async function createCalibrationPdf(
  pageWidthMm: number,
  pageHeightMm: number,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Printer calibration page");
  pdf.setProducer("Forge Labels");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([mmToPt(pageWidthMm), mmToPt(pageHeightMm)]);
  const black = rgb(0, 0, 0);
  const gray = rgb(0.45, 0.45, 0.45);

  const text = (
    value: string,
    xMm: number,
    yMmFromTop: number,
    size: number,
    options?: { bold?: boolean; color?: ReturnType<typeof rgb> },
  ) => {
    page.drawText(value, {
      x: mmToPt(xMm),
      y: mmToPt(pageHeightMm - yMmFromTop),
      size,
      font: options?.bold ? bold : font,
      color: options?.color ?? black,
    });
  };

  const line = (x1: number, y1: number, x2: number, y2: number, thickness = 0.4) =>
    page.drawLine({
      start: { x: mmToPt(x1), y: mmToPt(pageHeightMm - y1) },
      end: { x: mmToPt(x2), y: mmToPt(pageHeightMm - y2) },
      thickness,
      color: black,
    });

  // Corner rulers (0–60 mm) along the top and left edges, from (10,10).
  for (let mm = 0; mm <= 60; mm++) {
    const major = mm % 10 === 0;
    const mid = mm % 5 === 0;
    const tick = major ? 4 : mid ? 2.8 : 1.6;
    line(10 + mm, 10, 10 + mm, 10 + tick, major ? 0.4 : 0.25);
    line(10, 10 + mm, 10 + tick, 10 + mm, major ? 0.4 : 0.25);
    if (major && mm > 0) {
      text(String(mm), 10 + mm - 1.5, 8.2, 5, { color: gray });
      text(String(mm), 4.5, 10 + mm + 1, 5, { color: gray });
    }
  }

  // 100 mm reference bars.
  line(30, 90, 130, 90, 0.6);
  line(30, 88, 30, 92, 0.6);
  line(130, 88, 130, 92, 0.6);
  text("This bar must measure exactly 100 mm", 30, 96, 8);

  line(30, 110, 30, 210, 0.6);
  line(28, 110, 32, 110, 0.6);
  line(28, 210, 32, 210, 0.6);
  text("100 mm", 34, 160, 8);

  // Instructions.
  text("Forge Labels — printer calibration", 30, 34, 13, { bold: true });
  const instructions = [
    "1. Print this page at 100% scale (disable any “fit to page” option).",
    "2. Confirm both reference bars measure exactly 100 mm with a ruler.",
    "3. Measure the distance from the paper edges to the ruler origins;",
    "   both should be exactly 10 mm.",
    "4. Enter the differences as X/Y offsets in the print-sheet dialog:",
    "   positive X shifts labels right, positive Y shifts them down.",
  ];
  instructions.forEach((lineText, i) => {
    text(lineText, 30, 44 + i * 6, 9, { color: gray });
  });

  return pdf.save();
}
