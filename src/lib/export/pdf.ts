import { PDFDocument, rgb, type PDFPage } from "@cantoo/pdf-lib";
import { mmToPt } from "@/lib/geometry/units";

/**
 * Print-ready PDF composition (wrapper around @cantoo/pdf-lib — keep all
 * direct pdf-lib usage inside this module so the backend can be swapped).
 *
 * Strategy: label artwork is embedded as a DPI-exact raster; physical size
 * comes from PDF box math (MediaBox/TrimBox/BleedBox in points), which is
 * exact regardless of raster resolution. Crop/registration marks are drawn
 * as vectors. Runs in the browser and in Node (unit tests).
 */

export interface SingleLabelPdfOptions {
  /** Finished (trim) label size. */
  widthMm: number;
  heightMm: number;
  /** Bleed included in the artwork on each side. */
  bleedMm: number;
  /** PNG bytes of the artwork covering trim + bleed. */
  pngBytes: Uint8Array;
  cropMarks: boolean;
  title?: string;
}

const MARK_SPACE_MM = 6; // page margin reserved for marks
const MARK_LENGTH_MM = 4;
const MARK_GAP_MM = 1; // gap between bleed edge and mark start
const MARK_WIDTH_PT = 0.35;

export async function createSingleLabelPdf(
  options: SingleLabelPdfOptions,
): Promise<Uint8Array> {
  const { widthMm, heightMm, bleedMm, cropMarks } = options;
  const margin = cropMarks ? MARK_SPACE_MM : 0;

  const pageWmm = widthMm + 2 * bleedMm + 2 * margin;
  const pageHmm = heightMm + 2 * bleedMm + 2 * margin;

  const pdf = await PDFDocument.create();
  pdf.setTitle(options.title ?? "Label");
  pdf.setProducer("Forge Labels");
  pdf.setCreator("Forge Labels");

  const page = pdf.addPage([mmToPt(pageWmm), mmToPt(pageHmm)]);

  // Artwork (trim + bleed) at exact physical size.
  const png = await pdf.embedPng(options.pngBytes);
  page.drawImage(png, {
    x: mmToPt(margin),
    y: mmToPt(margin),
    width: mmToPt(widthMm + 2 * bleedMm),
    height: mmToPt(heightMm + 2 * bleedMm),
  });

  // Print boxes: TrimBox = finished label; BleedBox = artwork extent.
  page.setTrimBox(
    mmToPt(margin + bleedMm),
    mmToPt(margin + bleedMm),
    mmToPt(widthMm),
    mmToPt(heightMm),
  );
  page.setBleedBox(
    mmToPt(margin),
    mmToPt(margin),
    mmToPt(widthMm + 2 * bleedMm),
    mmToPt(heightMm + 2 * bleedMm),
  );

  if (cropMarks) {
    drawCropMarks(page, {
      trimX: margin + bleedMm,
      trimY: margin + bleedMm,
      trimW: widthMm,
      trimH: heightMm,
      bleedMm,
    });
  }

  return pdf.save();
}

interface TrimRectMm {
  trimX: number;
  trimY: number;
  trimW: number;
  trimH: number;
  bleedMm: number;
}

/**
 * Standard corner crop marks: two short lines per corner aligned with the
 * trim edges, held clear of the bleed so they never print on the label.
 * Coordinates here are PDF points with the origin at the BOTTOM-left.
 */
function drawCropMarks(page: PDFPage, rect: TrimRectMm): void {
  const { trimX, trimY, trimW, trimH, bleedMm } = rect;
  const start = bleedMm + MARK_GAP_MM; // distance from trim edge to mark start
  const end = start + MARK_LENGTH_MM;
  const black = rgb(0, 0, 0);

  const line = (x1: number, y1: number, x2: number, y2: number) => {
    page.drawLine({
      start: { x: mmToPt(x1), y: mmToPt(y1) },
      end: { x: mmToPt(x2), y: mmToPt(y2) },
      thickness: MARK_WIDTH_PT,
      color: black,
    });
  };

  const xL = trimX;
  const xR = trimX + trimW;
  const yB = trimY;
  const yT = trimY + trimH;

  // Vertical marks (aligned with left/right trim edges), above and below.
  line(xL, yB - start, xL, yB - end);
  line(xR, yB - start, xR, yB - end);
  line(xL, yT + start, xL, yT + end);
  line(xR, yT + start, xR, yT + end);
  // Horizontal marks (aligned with top/bottom trim edges), left and right.
  line(xL - start, yB, xL - end, yB);
  line(xL - start, yT, xL - end, yT);
  line(xR + start, yB, xR + end, yB);
  line(xR + start, yT, xR + end, yT);
}
