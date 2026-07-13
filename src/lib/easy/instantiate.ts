import { newObjectId } from "@/lib/document/ids";
import { resolveWeight } from "@/lib/fonts/registry";
import type {
  Background,
  BarcodeObject,
  Fill,
  LabelDocument,
  LabelObject,
  QrObject,
  RectObject,
  TextObject,
} from "@/lib/document/schema";
import type { EasyPalette } from "./palettes";
import type { Intensity, MaterialDef, MaterialOption } from "./materials";
import type { ColorRole, DecorFill, EasyTemplateDef, RowDef } from "./templates";
import type { SlotId } from "./slots";
import {
  approximateMeasure,
  fitRow,
  PT_TO_MM,
  squeezeFactor,
  stackZones,
  type TextMeasure,
} from "./layout";

/**
 * The Easy layout engine: template definition + geometry + material +
 * palette + field values → real document objects, every one tagged with
 * its `slot`. Deterministic, pure (measurer injectable), and safe by
 * construction: rows live inside the safe area, codes reserve their own
 * space, contrast panels appear automatically on full-effect materials,
 * and overflow squeezes instead of spilling.
 *
 * Engine-owned objects are identified by `obj.slot` — regeneration
 * replaces exactly those and leaves free objects (added in the Advanced
 * Editor) untouched, in order, on top.
 */

export interface EasyBuildInput {
  template: EasyTemplateDef;
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  safeMm: number;
  material: MaterialDef;
  option: MaterialOption;
  intensity: Intensity;
  palette: EasyPalette;
  fields: Partial<Record<SlotId, string>>;
  enabled: ReadonlySet<SlotId>;
  measure?: TextMeasure;
}

export interface EasyBuildResult {
  background: Background;
  substrateId: string;
  /** Engine objects, back-to-front, all carrying `slot`. */
  objects: LabelObject[];
  /** Plain-language notes ("Product name was shrunk to fit"). */
  notes: string[];
}

/** How the material's effect is applied at the chosen intensity. */
interface EffectPlan {
  finishBackground: boolean;
  heroPanel: boolean;
  footerPanel: boolean;
}

function effectPlan(
  material: MaterialDef,
  intensity: Intensity,
  finishId: string | undefined,
): EffectPlan {
  const coverage = material.rules.coverage[intensity];
  const hasFinish = Boolean(finishId);
  const fullEffectBg = hasFinish && (coverage === "background" || coverage === "panel");
  return {
    finishBackground: fullEffectBg,
    // Text never sits raw on a reflective pattern: at "panel" coverage the
    // hero gets an opaque panel; small print always gets one on effect bgs.
    heroPanel:
      material.rules.contrastPanelOnFullEffect && coverage === "panel" && hasFinish,
    footerPanel: material.rules.contrastPanelOnFullEffect && fullEffectBg,
  };
}

function roleColor(palette: EasyPalette, role: ColorRole): string {
  switch (role) {
    case "text":
      return palette.text;
    case "muted":
      return palette.muted;
    case "accent":
      return palette.accent;
    case "onAccent":
      return palette.onAccent;
  }
}

function decorFill(fill: DecorFill, palette: EasyPalette, finishId?: string): Fill {
  if ("effect" in fill && finishId) {
    return { type: "finish", finishId, intensity: 0.85, scale: 1, angleDeg: 0 };
  }
  const role = "role" in fill ? fill.role : "accent";
  return { type: "solid", color: roleColor(palette, role) };
}

const MM = (n: number) => Math.round(n * 100) / 100;

export function buildEasyLabel(input: EasyBuildInput): EasyBuildResult {
  const {
    template,
    widthMm,
    heightMm,
    bleedMm,
    safeMm,
    material,
    option,
    intensity,
    palette,
    fields,
    enabled,
  } = input;
  const measure = input.measure ?? approximateMeasure;
  const notes: string[] = [];
  const plan = effectPlan(material, intensity, option.finishId);

  // --- Background & substrate ----------------------------------------------
  let background: Background;
  if (plan.finishBackground && option.finishId) {
    background = {
      type: "finish",
      finishId: option.finishId,
      intensity: intensity === "maximum" ? 1 : 0.85,
      scale: 1,
      angleDeg: 0,
    };
  } else if (material.rules.transparentSubstrate || palette.bg === null) {
    background = { type: "none" };
  } else {
    background = { type: "solid", color: palette.bg };
  }

  const scaleH = heightMm / 26; // template numbers are tuned at 26 mm

  // Side stripes shrink the text column so type never sits on them.
  const stripeInset = (edge: "left" | "right") =>
    template.decor.reduce(
      (inset, d) =>
        d.kind === "stripe" && d.edge === edge
          ? Math.max(inset, Math.max(widthMm * d.widthFactor, 1.2) + 1)
          : inset,
      0,
    );
  // Edge bands push the content zones inward the same way.
  const bandInset = (edge: "top" | "bottom") =>
    template.decor.reduce(
      (inset, d) =>
        d.kind === "band" && d.edge === edge
          ? Math.max(inset, heightMm * d.heightFactor + 1)
          : inset,
      0,
    );
  const safeLeft = safeMm + stripeInset("left");
  const safeRight = widthMm - safeMm - stripeInset("right");
  const safeTop = Math.max(safeMm, bandInset("top"));
  const safeBottom = heightMm - Math.max(safeMm, bandInset("bottom"));
  const safeW = safeRight - safeLeft;

  const objects: LabelObject[] = [];

  // --- Decor (behind everything) --------------------------------------------
  const decorRects: LabelObject[] = [];
  for (const decor of template.decor) {
    if (decor.kind === "band") {
      // Bands overhang the trim edge into the bleed so they print edge-to-edge.
      const bandH = MM(heightMm * decor.heightFactor + bleedMm);
      decorRects.push(rect({
        slot: `accent:band-${decor.edge}`,
        xMm: widthMm / 2,
        yMm: decor.edge === "top" ? bandH / 2 - bleedMm : heightMm - bandH / 2 + bleedMm,
        widthMm: widthMm + bleedMm * 2,
        heightMm: bandH,
        fill: decorFill(decor.fill, palette, option.finishId),
      }));
    } else if (decor.kind === "stripe") {
      const stripeW = MM(Math.max(widthMm * decor.widthFactor, 1.2));
      decorRects.push(rect({
        slot: `accent:stripe-${decor.edge}`,
        xMm: decor.edge === "left" ? (stripeW - bleedMm) / 2 : widthMm - (stripeW - bleedMm) / 2,
        yMm: heightMm / 2,
        widthMm: stripeW + bleedMm,
        heightMm: heightMm + bleedMm * 2,
        fill: decorFill(decor.fill, palette, option.finishId),
      }));
    } else if (decor.kind === "border") {
      decorRects.push({
        ...rect({
          slot: "accent:border",
          xMm: widthMm / 2,
          yMm: heightMm / 2,
          widthMm: widthMm - decor.insetMm * 2,
          heightMm: heightMm - decor.insetMm * 2,
          fill: { type: "none" },
        }),
        stroke: { color: roleColor(palette, decor.color), widthPt: decor.strokePt },
        cornerRadiusMm: 0.8,
      });
    }
    // underline-hero is positioned after the hero rows are laid out.
  }
  objects.push(...decorRects);

  // --- Code boxes (QR / barcode) reserve footer space ------------------------
  const gap = 1.6 * scaleH;
  const qrOn = enabled.has("qr") && Boolean(fields.qr?.trim());
  const barcodeOn = enabled.has("barcode") && Boolean(fields.barcode?.trim());
  const qrEdge = qrOn ? MM(Math.min(Math.max(heightMm * 0.42, 9), 16)) : 0;
  const barcodeW = barcodeOn ? MM(Math.min(Math.max(widthMm * 0.32, 16), 34)) : 0;
  const barcodeH = barcodeOn ? MM(Math.min(Math.max(heightMm * 0.24, 6.5), 11)) : 0;

  const codeRight = template.codeCorner === "bottom-right";
  const codeReserveW = Math.max(
    qrOn ? qrEdge + gap : 0,
    barcodeOn ? barcodeW + gap : 0,
  );
  const footerW = MM(Math.max(safeW - codeReserveW, safeW * 0.45));
  const footerLeft = codeRight ? safeLeft : safeLeft + codeReserveW;

  // --- Rows ------------------------------------------------------------------
  interface LaidRow {
    def: RowDef;
    obj: TextObject;
    heightMm: number;
    spacingBeforeMm: number;
  }

  const displayFont = template.fonts.display;
  const bodyFont = template.fonts.body;

  const activeRows = template.rows.filter((row) => {
    const value = fields[row.slot]?.trim();
    return enabled.has(row.slot) && Boolean(value);
  });

  const buildRow = (row: RowDef, squeeze = 1): LaidRow => {
    const isFooter = row.zone === "footer";
    const columnW = isFooter ? footerW : safeW;
    const fontFamilyId = row.font === "display" ? displayFont : bodyFont;
    const fontWeight = resolveWeight(
      fontFamilyId,
      row.weight ?? (row.font === "display" ? template.fonts.displayWeight : template.fonts.bodyWeight),
    ) as TextObject["fontWeight"];
    const prefPt = Math.max((row.sizeFactor * heightMm) / PT_TO_MM / 1.28, row.minPt) * squeeze;

    const base: TextObject = {
      id: newObjectId(),
      type: "text",
      name: "",
      slot: row.slot,
      xMm: 0, // positioned later
      yMm: 0,
      widthMm: columnW,
      heightMm: 1,
      rotationDeg: 0,
      opacity: 1,
      locked: false,
      visible: true,
      printLayer: "artwork",
      text: fields[row.slot]!.trim(),
      fontFamilyId,
      fontWeight,
      fontSizePt: prefPt,
      lineHeight: row.zone === "footer" ? 1.25 : 1.12,
      letterSpacingEm: row.letterSpacingEm ?? 0,
      align: template.align === "center" && !isFooter ? "center" : template.align,
      textTransform: row.casing === "uppercase" ? "uppercase" : "none",
      fill: { type: "solid", color: roleColor(palette, row.color) },
      autoFit: false,
    };

    const fitted = fitRow(
      base,
      { prefPt, minPt: row.minPt, maxLines: row.maxLines },
      measure,
    );
    if (fitted.atMinimum) {
      notes.push(
        `"${base.text.length > 24 ? `${base.text.slice(0, 21)}…` : base.text}" was shrunk to fit — shorter text will look better.`,
      );
    }
    return {
      def: row,
      obj: { ...base, fontSizePt: MM(fitted.fontSizePt), heightMm: MM(fitted.heightMm) },
      heightMm: fitted.heightMm,
      spacingBeforeMm: (row.spacingBefore ?? 0.8) * scaleH,
    };
  };

  let laid = activeRows.map((row) => buildRow(row));

  // Overflow guard: squeeze everything proportionally if the stack is tall.
  const codeFooterHeight = Math.max(qrOn ? qrEdge : 0, barcodeOn ? barcodeH : 0);
  const availableH = safeBottom - safeTop - (codeFooterHeight > 0 ? 0 : 0);
  const totalH = laid.reduce((sum, r) => sum + r.heightMm + r.spacingBeforeMm, 0);
  const factor = squeezeFactor(totalH, availableH);
  if (factor < 1) {
    laid = activeRows.map((row) => buildRow(row, factor));
    notes.push("Everything was scaled down slightly to fit — consider turning off a field.");
  }

  // --- Zone placement --------------------------------------------------------
  const zones = { header: [] as LaidRow[], hero: [] as LaidRow[], footer: [] as LaidRow[] };
  for (const row of laid) zones[row.def.zone].push(row);

  // Codes occupy footer height: keep footer text clear of them vertically
  // only when text shares the same column (it doesn't — column was narrowed),
  // so the stack bottom stays the safe bottom.
  const tops = stackZones(
    {
      header: zones.header.map((r) => ({ heightMm: r.heightMm, spacingBeforeMm: r.spacingBeforeMm })),
      hero: zones.hero.map((r) => ({ heightMm: r.heightMm, spacingBeforeMm: r.spacingBeforeMm })),
      footer: zones.footer.map((r) => ({ heightMm: r.heightMm, spacingBeforeMm: r.spacingBeforeMm })),
    },
    { topMm: safeTop, bottomMm: safeBottom },
  );

  const placed: TextObject[] = [];
  const placeRows = (rows: LaidRow[], topList: number[]) => {
    rows.forEach((row, i) => {
      const isFooter = row.def.zone === "footer";
      const columnW = isFooter ? footerW : safeW;
      const left = isFooter ? footerLeft : safeLeft;
      placed.push({
        ...row.obj,
        xMm: MM(left + columnW / 2),
        yMm: MM(topList[i]! + row.heightMm / 2),
      });
    });
  };
  placeRows(zones.header, tops.header);
  placeRows(zones.hero, tops.hero);
  placeRows(zones.footer, tops.footer);

  // --- Hero contrast panel / underline --------------------------------------
  const heroRows = placed.filter((o) =>
    zones.hero.some((r) => r.obj.slot === o.slot),
  );
  if (heroRows.length > 0) {
    const heroTop = Math.min(...heroRows.map((o) => o.yMm - o.heightMm / 2));
    const heroBottom = Math.max(...heroRows.map((o) => o.yMm + o.heightMm / 2));
    if (plan.heroPanel) {
      const pad = 1.6 * scaleH;
      objects.push(rect({
        slot: "accent:hero-panel",
        xMm: widthMm / 2,
        yMm: MM((heroTop + heroBottom) / 2),
        widthMm: MM(Math.min(safeW + pad, widthMm - 2)),
        heightMm: MM(heroBottom - heroTop + pad * 2),
        fill: { type: "solid", color: palette.bg ?? (palette.dark ? "#141418" : "#ffffff") },
        cornerRadiusMm: 1,
      }));
    }
    const underline = template.decor.find((d) => d.kind === "underline-hero");
    if (underline && underline.kind === "underline-hero") {
      const w = MM(Math.max(widthMm * underline.widthFactor, 6));
      const productRow = heroRows.find((o) => o.slot === "product-name");
      if (productRow) {
        objects.push({
          ...rect({
            slot: "accent:underline",
            xMm:
              template.align === "center"
                ? widthMm / 2
                : MM(safeLeft + w / 2),
            yMm: MM(productRow.yMm + productRow.heightMm / 2 + 1.1 * scaleH),
            widthMm: w,
            heightMm: MM(Math.max(underline.strokePt * PT_TO_MM, 0.35)),
            fill: decorFill(underline.fill, palette, option.finishId),
          }),
        });
      }
    }
  }

  // --- Footer contrast panel on full-effect backgrounds ---------------------
  const footerObjects = placed.filter((o) =>
    zones.footer.some((r) => r.obj.slot === o.slot),
  );
  if (plan.footerPanel && (footerObjects.length > 0 || qrOn || barcodeOn)) {
    const contentTop = footerObjects.length
      ? Math.min(...footerObjects.map((o) => o.yMm - o.heightMm / 2))
      : safeBottom;
    const codesTop = safeBottom - Math.max(qrOn ? qrEdge : 0, barcodeOn ? barcodeH : 0);
    const top = Math.min(contentTop, codesTop) - 1.2 * scaleH;
    objects.push(rect({
      slot: "accent:footer-panel",
      xMm: widthMm / 2,
      yMm: MM((top + safeBottom + 1.2 * scaleH) / 2),
      widthMm: MM(Math.min(safeW + 3.2 * scaleH, widthMm - 1.6)),
      heightMm: MM(safeBottom - top + 2.4 * scaleH),
      fill: { type: "solid", color: palette.bg ?? (palette.dark ? "#141418" : "#ffffff") },
      cornerRadiusMm: 1,
    }));
  }

  objects.push(...placed);

  // --- QR / barcode objects ---------------------------------------------------
  if (qrOn) {
    const x = codeRight ? safeRight - qrEdge / 2 : safeLeft + qrEdge / 2;
    const qr: QrObject = {
      id: newObjectId(),
      type: "qrcode",
      name: "QR code",
      slot: "qr",
      xMm: MM(x),
      yMm: MM(safeBottom - qrEdge / 2),
      widthMm: qrEdge,
      heightMm: qrEdge,
      rotationDeg: 0,
      opacity: 1,
      locked: false,
      visible: true,
      printLayer: "artwork",
      qrType: "url",
      value: fields.qr!.trim(),
      ecLevel: "M",
      fgColor: "#000000",
      bgColor: "#ffffff",
      moduleShape: "square",
      quietModules: 4,
    };
    objects.push(qr);
  }
  if (barcodeOn) {
    const x = codeRight && !qrOn ? safeRight - barcodeW / 2 : safeLeft + barcodeW / 2;
    const barcode: BarcodeObject = {
      id: newObjectId(),
      type: "barcode",
      name: "Barcode",
      slot: "barcode",
      xMm: MM(qrOn && codeRight ? safeLeft + barcodeW / 2 : x),
      yMm: MM(safeBottom - barcodeH / 2),
      widthMm: barcodeW,
      heightMm: barcodeH,
      rotationDeg: 0,
      opacity: 1,
      locked: false,
      visible: true,
      printLayer: "artwork",
      symbology: "code128",
      value: fields.barcode!.trim(),
      showText: true,
      fgColor: "#000000",
      bgColor: "#ffffff",
    };
    objects.push(barcode);
  }

  return { background, substrateId: option.substrateId, objects, notes };
}

function rect(props: {
  slot: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  fill: Fill;
  cornerRadiusMm?: number;
}): RectObject {
  return {
    id: newObjectId(),
    type: "rect",
    name: "",
    slot: props.slot,
    xMm: MM(props.xMm),
    yMm: MM(props.yMm),
    widthMm: MM(Math.max(props.widthMm, 0.2)),
    heightMm: MM(Math.max(props.heightMm, 0.2)),
    rotationDeg: 0,
    opacity: 1,
    locked: false,
    visible: true,
    printLayer: "artwork",
    cornerRadiusMm: props.cornerRadiusMm ?? 0,
    fill: props.fill,
  };
}

/**
 * Merge an engine rebuild into an existing document: engine objects
 * (anything with `slot`) are replaced wholesale; free objects keep their
 * relative order and stay on top.
 */
export function mergeEasyObjects(
  current: LabelDocument,
  build: EasyBuildResult,
): LabelDocument {
  const free = current.objects.filter((o) => !o.slot);
  return {
    ...current,
    background: build.background,
    substrateId: build.substrateId,
    objects: [...build.objects, ...free],
  };
}
