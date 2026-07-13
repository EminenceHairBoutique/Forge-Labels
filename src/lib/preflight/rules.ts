import type { LabelDocument, LabelObject, PrintLayer } from "@/lib/document/schema";
import { objectAabb, bleedRect, safeRect } from "@/lib/render/geometry";
import { createQrMatrix, qrTotalModules, MIN_QR_MODULE_MM } from "@/lib/codes/qr";
import { validateBarcodeValue } from "@/lib/codes/validate";
import { getSubstrate } from "@/lib/finishes/types";
import { effectiveLayer } from "@/lib/print/layers";

/**
 * Print-readiness checks. Pure functions over the document — every issue
 * carries the offending object id so the UI can jump to it.
 */

export type PreflightSeverity = "error" | "warning" | "info";

export interface PreflightIssue {
  ruleId: string;
  severity: PreflightSeverity;
  message: string;
  objectId?: string;
}

const MIN_FONT_ERROR_PT = 3.5;
const MIN_FONT_WARN_PT = 5;
const MIN_IMAGE_DPI_ERROR = 140;
const MIN_IMAGE_DPI_WARN = 250;
const THIN_LINE_PT = 0.4;

function objectLabel(obj: LabelObject): string {
  return obj.name || obj.type;
}

function walk(
  objects: LabelObject[],
  visit: (obj: LabelObject) => void,
): void {
  for (const obj of objects) {
    visit(obj);
    if (obj.type === "group") walk(obj.children, visit);
  }
}

function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(full.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [lighter, darker] = la > lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const value = hex.replace("#", "").slice(0, 6);
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

export function runPreflight(doc: LabelDocument): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const bleed = bleedRect(doc);
  const safe = safeRect(doc);
  const substrate = getSubstrate(doc.substrateId);
  const transparentStock =
    substrate?.previewColor === null || doc.background.type === "none";

  const backgroundColor =
    doc.background.type === "solid" ? doc.background.color : null;

  walk(doc.objects, (obj) => {
    if (!obj.visible) return;
    const box = objectAabb(obj);
    const label = objectLabel(obj);

    // --- Position checks ---------------------------------------------------
    const outsideBleed =
      box.x + box.width < bleed.x ||
      box.y + box.height < bleed.y ||
      box.x > bleed.x + bleed.width ||
      box.y > bleed.y + bleed.height;
    const crossesBleed =
      !outsideBleed &&
      (box.x < bleed.x - 0.05 ||
        box.y < bleed.y - 0.05 ||
        box.x + box.width > bleed.x + bleed.width + 0.05 ||
        box.y + box.height > bleed.y + bleed.height + 0.05);

    if (outsideBleed) {
      issues.push({
        ruleId: "outside-canvas",
        severity: "warning",
        message: `“${label}” is entirely outside the artwork area and won't print.`,
        objectId: obj.id,
      });
    } else if (crossesBleed) {
      issues.push({
        ruleId: "crosses-bleed",
        severity: "warning",
        message: `“${label}” extends past the bleed and will be cut off.`,
        objectId: obj.id,
      });
    }

    const isCritical =
      obj.type === "text" || obj.type === "qrcode" || obj.type === "barcode";
    if (isCritical && !outsideBleed) {
      const insideSafe =
        box.x >= safe.x - 0.05 &&
        box.y >= safe.y - 0.05 &&
        box.x + box.width <= safe.x + safe.width + 0.05 &&
        box.y + box.height <= safe.y + safe.height + 0.05;
      if (!insideSafe) {
        issues.push({
          ruleId: "outside-safe",
          severity: "warning",
          message: `“${label}” sits outside the ${doc.label.safeMm} mm safe zone — cutting tolerance may clip it.`,
          objectId: obj.id,
        });
      }
    }

    // --- Type-specific checks ---------------------------------------------
    switch (obj.type) {
      case "text": {
        if (obj.fontSizePt < MIN_FONT_ERROR_PT) {
          issues.push({
            ruleId: "font-too-small",
            severity: "error",
            message: `“${label}” is ${obj.fontSizePt} pt — below the ${MIN_FONT_ERROR_PT} pt legibility floor.`,
            objectId: obj.id,
          });
        } else if (obj.fontSizePt < MIN_FONT_WARN_PT) {
          issues.push({
            ruleId: "font-small",
            severity: "warning",
            message: `“${label}” is ${obj.fontSizePt} pt; ${MIN_FONT_WARN_PT} pt+ prints more reliably on small labels.`,
            objectId: obj.id,
          });
        }
        if (
          backgroundColor &&
          obj.fill.type === "solid" &&
          contrastRatio(obj.fill.color, backgroundColor) < 2.5
        ) {
          issues.push({
            ruleId: "low-contrast",
            severity: "warning",
            message: `“${label}” has low contrast against the background — it may be hard to read in print.`,
            objectId: obj.id,
          });
        }
        if (obj.fill.type === "solid") {
          const { s, l } = hexToHsl(obj.fill.color);
          if (s > 0.92 && l > 0.42 && l < 0.62) {
            issues.push({
              ruleId: "out-of-gamut",
              severity: "info",
              message: `“${label}” uses a highly saturated screen color that may shift when converted to CMYK for print.`,
              objectId: obj.id,
            });
          }
        }
        break;
      }
      case "line": {
        if (obj.strokePt < THIN_LINE_PT) {
          issues.push({
            ruleId: "thin-line",
            severity: "warning",
            message: `“${label}” is ${obj.strokePt} pt thick — hairlines under ${THIN_LINE_PT} pt can drop out in print.`,
            objectId: obj.id,
          });
        }
        break;
      }
      case "image": {
        const cropW = obj.crop ? obj.crop.width : 1;
        const sourcePx = obj.naturalWidthPx * cropW;
        const effectiveDpi = sourcePx / (obj.widthMm / 25.4);
        if (effectiveDpi < MIN_IMAGE_DPI_ERROR) {
          issues.push({
            ruleId: "image-low-dpi",
            severity: "error",
            message: `“${label}” prints at ~${Math.round(effectiveDpi)} DPI — it will look pixelated. Use a larger source or shrink it.`,
            objectId: obj.id,
          });
        } else if (effectiveDpi < MIN_IMAGE_DPI_WARN) {
          issues.push({
            ruleId: "image-soft-dpi",
            severity: "warning",
            message: `“${label}” prints at ~${Math.round(effectiveDpi)} DPI; 250+ DPI keeps photos crisp.`,
            objectId: obj.id,
          });
        }
        break;
      }
      case "qrcode": {
        if (obj.value.trim().length === 0) {
          issues.push({
            ruleId: "qr-empty",
            severity: "error",
            message: `“${label}” has no content to encode.`,
            objectId: obj.id,
          });
          break;
        }
        try {
          const matrix = createQrMatrix(obj.value, obj.ecLevel);
          const moduleMm = obj.widthMm / qrTotalModules(matrix, obj.quietModules);
          if (moduleMm < MIN_QR_MODULE_MM) {
            issues.push({
              ruleId: "qr-module-small",
              severity: "warning",
              message: `“${label}” modules print at ${moduleMm.toFixed(2)} mm (min ${MIN_QR_MODULE_MM} mm) — it may not scan. Enlarge it or shorten the payload.`,
              objectId: obj.id,
            });
          }
        } catch {
          issues.push({
            ruleId: "qr-invalid",
            severity: "error",
            message: `“${label}” payload cannot be encoded as a QR code.`,
            objectId: obj.id,
          });
        }
        if (obj.quietModules < 4) {
          issues.push({
            ruleId: "qr-quiet-zone",
            severity: "warning",
            message: `“${label}” quiet zone is under the 4-module spec minimum.`,
            objectId: obj.id,
          });
        }
        break;
      }
      case "barcode": {
        const validation = validateBarcodeValue(obj.symbology, obj.value);
        if (!validation.ok) {
          issues.push({
            ruleId: "barcode-invalid",
            severity: "error",
            message: `“${label}”: ${validation.message}`,
            objectId: obj.id,
          });
        }
        if (obj.symbology !== "datamatrix" && obj.heightMm < 8) {
          issues.push({
            ruleId: "barcode-short",
            severity: "info",
            message: `“${label}” is under 8 mm tall — short bars are harder for handheld scanners.`,
            objectId: obj.id,
          });
        }
        break;
      }
      default:
        break;
    }

    // White artwork on transparent/metallic stock needs white ink.
    if (transparentStock) {
      const fill =
        "fill" in obj && obj.fill?.type === "solid" ? obj.fill.color : null;
      if (fill && relativeLuminance(fill) > 0.92) {
        issues.push({
          ruleId: "white-ink-needed",
          severity: "warning",
          message: `“${label}” is near-white on ${substrate?.name ?? "transparent stock"} — without a white-ink layer it will be invisible.`,
          objectId: obj.id,
        });
      }
    }
  });

  // --- Print-production layer checks ---------------------------------------
  // Effective layer inherits from group assignments (see lib/print/layers).
  const layerWalk = (objects: readonly LabelObject[], inherited: PrintLayer) => {
    for (const obj of objects) {
      if (!obj.visible) continue;
      const layer = effectiveLayer(obj.printLayer, inherited);
      if (obj.type === "group") {
        layerWalk(obj.children, layer);
        continue;
      }
      const label = obj.name || obj.type;
      if (layer === "white-ink" && !transparentStock) {
        issues.push({
          ruleId: "white-ink-on-opaque",
          severity: "info",
          message: `“${label}” is on the white-ink layer, but the substrate is opaque — white ink is usually only needed on clear or metallic stock.`,
          objectId: obj.id,
        });
      }
      if (
        layer === "die-cut" &&
        (obj.type === "text" ||
          obj.type === "image" ||
          obj.type === "qrcode" ||
          obj.type === "barcode")
      ) {
        issues.push({
          ruleId: "die-cut-content",
          severity: "warning",
          message: `“${label}” is on the die-cut layer — cut paths should be simple vector outlines, not ${obj.type === "text" ? "text" : "raster or code"} content.`,
          objectId: obj.id,
        });
      }
    }
  };
  layerWalk(doc.objects, "artwork");

  // --- Document-level checks -----------------------------------------------
  if (doc.label.bleedMm < 1) {
    issues.push({
      ruleId: "no-bleed",
      severity: "warning",
      message: `Bleed is ${doc.label.bleedMm} mm — most printers need 1.5–3 mm to avoid white edges after cutting.`,
    });
  }

  if (doc.background.type === "none" && !transparentStockIntended(doc)) {
    issues.push({
      ruleId: "transparent-bg",
      severity: "info",
      message:
        "The background is transparent. On white stock this prints as white; on clear or metallic stock the material shows through.",
    });
  }

  if (doc.objects.length === 0) {
    issues.push({
      ruleId: "empty-label",
      severity: "info",
      message: "The label has no objects yet.",
    });
  }

  return issues;
}

function transparentStockIntended(doc: LabelDocument): boolean {
  const substrate = getSubstrate(doc.substrateId);
  return substrate ? substrate.previewColor === null : false;
}

export function preflightSummary(issues: PreflightIssue[]): {
  errors: number;
  warnings: number;
  infos: number;
} {
  return {
    errors: issues.filter((i) => i.severity === "error").length,
    warnings: issues.filter((i) => i.severity === "warning").length,
    infos: issues.filter((i) => i.severity === "info").length,
  };
}
