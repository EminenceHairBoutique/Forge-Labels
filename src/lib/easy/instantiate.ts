import { newObjectId } from "@/lib/document/ids";
import { resolveWeight } from "@/lib/fonts/registry";
import type {
  Background,
  BarcodeObject,
  EasyTweaks,
  EllipseObject,
  Fill,
  ImageObject,
  LabelDocument,
  LabelObject,
  QrObject,
  RectObject,
  TextObject,
} from "@/lib/document/schema";
import { paletteBorder, paletteQrColor, type EasyPalette } from "./palettes";
import type {
  EffectPlacement,
  Intensity,
  MaterialDef,
  MaterialOption,
} from "./materials";
import type {
  ColorRole,
  DecorFill,
  EasyTemplateDef,
  RowDef,
  ZoneId,
} from "./templates";
import { SLOTS, type SlotId } from "./slots";
import { getPairing, roleDefaultWeight, roleFamily, roleWeights } from "./typography";
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
 * palette + typography pairing + field values → real document objects,
 * every one tagged with its `slot`. Deterministic, pure (measurer
 * injectable), and safe by construction: rows live inside the safe area,
 * codes reserve their own space, contrast protection appears automatically
 * on full-effect materials, and overflow squeezes instead of spilling.
 *
 * Engine-owned objects are identified by `obj.slot` — regeneration
 * replaces exactly those and leaves free objects (added in the Advanced
 * Editor) untouched, in order, on top.
 */

export {
  EFFECT_PLACEMENTS,
  type EffectPlacement,
} from "./materials";

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
  /** One-click fix adjustments (see EasyMetaSchema.tweaks). */
  tweaks?: EasyTweaks;
  /** Font-pairing override (easy.pairingId) — template default when absent. */
  pairingId?: string;
  /** Effect placement override (easy.placement). */
  placement?: EffectPlacement;
  /** Aspect ratio (w/h) of the uploaded logo, when fields.logo is set. */
  logoAspect?: number;
}

export interface EasyBuildResult {
  background: Background;
  substrateId: string;
  /** Engine objects, back-to-front, all carrying `slot`. */
  objects: LabelObject[];
  /** Plain-language notes ("Product name was shrunk to fit"). */
  notes: string[];
  /**
   * Slots hidden because the label is too small to hold everything (§6
   * collapse). Their values stay in the form and reappear on a taller
   * label or when other fields are turned off.
   */
  hiddenSlots: SlotId[];
}

/** How the material's effect is applied for the resolved placement. */
interface EffectPlan {
  finishBackground: boolean;
  heroPanel: boolean;
  footerPanel: boolean;
  heroAccentPanel: boolean;
  /** Effect (or accent) frame around the label edge. */
  effectFrame: boolean;
  /** Product name rendered in the finish itself (or accent when no finish). */
  effectTitle: boolean;
}

function resolvePlacement(
  material: MaterialDef,
  intensity: Intensity,
  placement: EffectPlacement | undefined,
): EffectPlacement {
  if (placement && placement !== "auto") return placement;
  const coverage = material.rules.coverage[intensity];
  if (coverage === "background") return "full";
  if (coverage === "panel") return "panel";
  return "accents"; // "accents" and "band" both mean template-driven accents
}

function effectPlan(
  material: MaterialDef,
  intensity: Intensity,
  placement: EffectPlacement | undefined,
  finishId: string | undefined,
): EffectPlan {
  const resolved = resolvePlacement(material, intensity, placement);
  const hasFinish = Boolean(finishId);
  const protect = material.rules.contrastPanelOnFullEffect;
  const fullEffectBg = hasFinish && resolved === "full";
  const panelEffectBg = hasFinish && resolved === "panel";
  return {
    finishBackground: fullEffectBg || panelEffectBg,
    // Text never sits raw on a reflective pattern: "panel" gets an opaque
    // hero panel, "full" keeps the film visible everywhere and tight
    // readability chips go behind uncovered rows; small print always gets
    // its footer panel.
    heroPanel: protect && panelEffectBg,
    footerPanel: protect && (fullEffectBg || panelEffectBg),
    // Finish-less materials (neon) at panel/full placement: the hero sits
    // on an accent-colored panel with onAccent text — loud, but readable.
    heroAccentPanel: !hasFinish && (resolved === "panel" || resolved === "full"),
    effectFrame: resolved === "border",
    effectTitle: resolved === "title",
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
    case "border":
      return paletteBorder(palette);
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

/** Opaque panel color for contrast surfaces. */
function panelColor(palette: EasyPalette): string {
  return palette.bg ?? (palette.dark ? "#141418" : "#ffffff");
}

/**
 * Estimated rendered text width (mm) — the same average-advance model as
 * `approximateMeasure`, used to size chips that hug their text.
 */
function estimateTextWidthMm(obj: TextObject): number {
  const fontMm = obj.fontSizePt * PT_TO_MM;
  const text = obj.textTransform === "uppercase" ? obj.text.toUpperCase() : obj.text;
  const longest = text.split("\n").reduce((max, line) => Math.max(max, line.length), 0);
  return Math.min(longest * fontMm * 0.54 * (1 + obj.letterSpacingEm), obj.widthMm);
}

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
  const pairing = getPairing(input.pairingId ?? template.pairingId);
  const plan = effectPlan(material, intensity, input.placement, option.finishId);
  const tweaks = input.tweaks ?? {};

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

  const decorActive = template.decor.filter(
    (d) => heightMm >= (("minLabelHeightMm" in d ? d.minLabelHeightMm : 0) ?? 0),
  );

  // Side stripes shrink the text column so type never sits on them.
  const stripeInset = (edge: "left" | "right") =>
    decorActive.reduce(
      (inset, d) =>
        d.kind === "stripe" && d.edge === edge
          ? Math.max(inset, Math.max(widthMm * d.widthFactor, 1.2) + 1)
          : inset,
      0,
    );
  // Edge bands push the content zones inward the same way. Inset bands
  // start at the safe margin, so their occupied depth is safe + height.
  const bandInset = (edge: "top" | "bottom") =>
    decorActive.reduce(
      (inset, d) =>
        d.kind === "band" && d.edge === edge
          ? Math.max(
              inset,
              heightMm * d.heightFactor + (d.inset ? safeMm + 0.8 : 1),
            )
          : inset,
      0,
    );
  // Effect frames inset every side.
  const frameThickness = Math.max(
    plan.effectFrame ? 0.055 : 0,
    ...decorActive.map((d) => (d.kind === "frame-effect" ? d.thicknessFactor : 0)),
  );
  const frameInset =
    frameThickness > 0
      ? MM(Math.max(Math.min(widthMm, heightMm) * frameThickness, 1.2) + 0.8)
      : 0;

  // --- Vertical row gutter ---------------------------------------------------
  const vr = template.verticalRow;
  const vrValue = vr && enabled.has(vr.slot) ? fields[vr.slot]?.trim() : undefined;
  const vrPrefPt = vr
    ? Math.max((vr.sizeFactor * heightMm) / PT_TO_MM / 1.28, vr.minPt)
    : 0;
  const vrGutter = vr && vrValue ? vrPrefPt * PT_TO_MM * 1.5 + 1.6 : 0;

  // --- Code boxes (QR / barcode) sizing --------------------------------------
  const gap = 1.6 * scaleH;
  const qrWanted = enabled.has("qr") && Boolean(fields.qr?.trim());
  const barcodeWanted = enabled.has("barcode") && Boolean(fields.barcode?.trim());
  const roughAvailableH =
    heightMm -
    Math.max(safeMm, bandInset("top")) -
    Math.max(safeMm, bandInset("bottom")) -
    frameInset * 2;
  const roughTextW =
    widthMm - safeMm * 2 - stripeInset("left") - stripeInset("right") -
    (vrValue ? vrGutter : 0) - frameInset * 2;
  // The QR grows with the label but never dominates it: at most ~half the
  // usable height (more when the template or a fix explicitly asks for a
  // bigger code — the placement fallbacks still guard the layout).
  const qrIntent = (template.qrScale ?? 1) * (tweaks.qrBoost ? 1.35 : 1);
  const qrEdge = qrWanted
    ? MM(
        Math.min(
          Math.max(
            Math.min(
              heightMm * 0.42 * qrIntent,
              roughAvailableH * 0.52 * Math.max(1, qrIntent),
              roughTextW * 0.55,
            ),
            9,
          ),
          18,
        ),
      )
    : 0;
  const barcodeW = barcodeWanted ? MM(Math.min(Math.max(widthMm * 0.32, 16), 34)) : 0;
  const barcodeH = barcodeWanted ? MM(Math.min(Math.max(heightMm * 0.24, 6.5), 11)) : 0;

  const codePlacement = template.codePlacement ?? "corner";

  // Rows that will actually render (content + toggle + size gate).
  const activeRowsAll = template.rows.filter((row) => {
    const value = fields[row.slot]?.trim();
    if (!enabled.has(row.slot) || !value) return false;
    if (row.minLabelHeightMm && heightMm < row.minLabelHeightMm) return false;
    return true;
  });

  /**
   * Code placement fallbacks. When the floored text stack plus a
   * bottom-anchored code can't share the label's height, the code moves to
   * a full-height side column — exactly what a designer does on a short
   * wrap. When even that can't fit (tiny labels), the code is left off
   * WITH a plain-language note instead of printing something unscannable.
   * Decisions use per-row print floors (single-line estimate) so they are
   * stable and deterministic.
   */
  const rowFloorMm = (row: RowDef): number => {
    const minPt = Math.max(row.minPt, pairing.minimumPrintSizes[row.font]);
    const line = row.zone === "footer" ? 1.25 : 1.12;
    return minPt * PT_TO_MM * line + (row.spacingBefore ?? 0.8) * scaleH;
  };
  const inLeftColumn = (r: RowDef) => !(template.split && r.column === "right");
  const nonFooterFloor = activeRowsAll
    .filter((r) => inLeftColumn(r) && r.zone !== "footer")
    .reduce((sum, r) => sum + rowFloorMm(r), 0);
  const footerFloor = activeRowsAll
    .filter((r) => inLeftColumn(r) && r.zone === "footer")
    .reduce((sum, r) => sum + rowFloorMm(r), 0);
  const cornerFits = (codeH: number): boolean =>
    nonFooterFloor + Math.max(footerFloor, codeH + gap * 0.5) <=
    roughAvailableH + 0.2;

  /** Footer text keeps at least this much width beside corner codes. */
  const MIN_TEXT_W = 12;
  const centerFits = (codeH: number): boolean =>
    nonFooterFloor + footerFloor + codeH + gap <= roughAvailableH + 0.2;

  const hiddenCodes: SlotId[] = [];
  let qrSide = qrEdge; // side placement may shrink the QR toward the 9 mm floor
  let qrMode: "corner" | "side" | "center" | "center-stack" | "off" = "off";
  if (qrWanted && !template.split) {
    const wantCenter = codePlacement === "footer-center";
    if (codePlacement === "side") qrMode = "side";
    else if (wantCenter && centerFits(qrEdge) && qrEdge + 2 <= roughTextW) {
      qrMode = "center";
    } else if (
      !wantCenter &&
      cornerFits(qrEdge) &&
      qrEdge + gap + MIN_TEXT_W <= roughTextW
    ) {
      qrMode = "corner";
    } else if (centerFits(qrEdge) && qrEdge + 2 <= roughTextW) {
      qrMode = "center";
    } else {
      qrMode = "side";
    }
    if (qrMode === "side") {
      qrSide = MM(Math.max(9, Math.min(qrEdge, roughAvailableH - 1.5)));
      if (roughTextW - (qrSide + gap) < 10 || roughAvailableH < 10) {
        qrMode = "off";
        hiddenCodes.push("qr");
        notes.push(
          "This label is too small for a scannable QR code — it was left off. Use a bigger label to include it.",
        );
      }
    }
  } else if (qrWanted) {
    // Split layouts anchor codes at the right column's bottom; the QR
    // shrinks to the column (never below 9 mm) or is honestly left off.
    qrMode = "corner";
    const rightColWEst =
      (roughTextW - 2.2) * (1 - (template.split?.ratio ?? 0.56));
    if (qrEdge > rightColWEst) {
      qrSide = MM(Math.max(9, rightColWEst - 0.5));
      if (qrSide > rightColWEst) {
        qrMode = "off";
        hiddenCodes.push("qr");
        notes.push(
          "This label is too small for a scannable QR code — it was left off. Use a bigger label to include it.",
        );
      }
    } else {
      qrSide = qrEdge;
    }
  }
  let barcodeMode: "corner" | "side" | "center" | "center-stack" | "off" = "off";
  if (barcodeWanted && !template.split) {
    const wantCenter = codePlacement === "footer-center";
    const centerPairW = (qrMode === "center" ? qrEdge + gap : 0) + barcodeW;
    if (
      wantCenter &&
      qrMode !== "corner" &&
      centerFits(barcodeH) &&
      centerPairW + 2 <= roughTextW
    ) {
      barcodeMode = "center";
    } else if (
      (qrMode === "corner" || qrMode === "off" || qrMode === "side") &&
      !wantCenter &&
      cornerFits(barcodeH) &&
      barcodeW + gap + MIN_TEXT_W + (qrMode === "corner" ? qrEdge + gap : 0) <=
        roughTextW
    ) {
      barcodeMode = "corner";
    } else if (
      (qrMode === "corner" || qrMode === "center") &&
      // Codes can't share the bottom width — stack them bottom-center.
      qrEdge + barcodeH + gap * 2 + nonFooterFloor <= roughAvailableH + 0.2 &&
      Math.max(qrEdge, barcodeW) + 2 <= roughTextW
    ) {
      qrMode = "center-stack";
      barcodeMode = "center-stack";
    } else if (
      centerFits(barcodeH) &&
      barcodeW + 2 <= roughTextW &&
      (qrMode === "off" || qrMode === "side")
    ) {
      barcodeMode = "center";
    } else {
      barcodeMode = "side";
    }
    if (barcodeMode === "side") {
      if (qrMode === "side" && qrSide + barcodeH + gap * 2 > roughAvailableH) {
        // Shrink the side QR toward its floor to make room for the pair.
        qrSide = MM(Math.max(9, roughAvailableH - barcodeH - gap * 2));
      }
      const gutterW = Math.max(qrMode === "side" ? qrSide : 0, barcodeW) + gap;
      const sharedTooTall =
        qrMode === "side" && qrSide + barcodeH + gap * 2 > roughAvailableH + 0.2;
      if (
        barcodeH + 2 > roughAvailableH ||
        roughTextW - gutterW < 10 ||
        sharedTooTall
      ) {
        barcodeMode = "off";
      }
    }
    if (barcodeMode === "off") {
      hiddenCodes.push("barcode");
      notes.push(
        "This label is too small for a readable barcode — it was left off. Use a bigger label to include it.",
      );
    }
  } else if (barcodeWanted) {
    barcodeMode = "corner";
    const rightColWEst =
      (roughTextW - 2.2) * (1 - (template.split?.ratio ?? 0.56));
    if (barcodeW > rightColWEst) {
      barcodeMode = "off";
      hiddenCodes.push("barcode");
      notes.push(
        "This label is too small for a readable barcode — it was left off. Use a bigger label to include it.",
      );
    }
  }

  const qrOn = qrWanted && qrMode !== "off";
  const barcodeOn = barcodeWanted && barcodeMode !== "off";
  const sideQr = qrOn && qrMode === "side";
  const qrBox = sideQr || template.split ? qrSide : qrEdge;
  const sideBarcode = barcodeOn && barcodeMode === "side";
  const bottomCenterCodes =
    (qrOn && (qrMode === "center" || qrMode === "center-stack")) ||
    (barcodeOn && (barcodeMode === "center" || barcodeMode === "center-stack"));
  const stackedCenter = qrMode === "center-stack" && barcodeMode === "center-stack";
  /** Right-side gutter shared by side-placed codes. */
  const sideGutterW =
    sideQr || sideBarcode
      ? Math.max(sideQr ? qrBox : 0, sideBarcode ? barcodeW : 0) + gap
      : 0;

  // --- Text bounds -------------------------------------------------------------
  const safeLeft =
    Math.max(safeMm + stripeInset("left"), frameInset + safeMm * 0.6) +
    (vr?.edge === "left" && vrValue ? vrGutter : 0);
  const safeRight =
    Math.min(widthMm - safeMm - stripeInset("right"), widthMm - frameInset - safeMm * 0.6) -
    (vr?.edge === "right" && vrValue ? vrGutter : 0) -
    sideGutterW;
  const safeTop = Math.max(safeMm, bandInset("top"), frameInset + safeMm * 0.6);
  const safeBottom = Math.min(
    heightMm - Math.max(safeMm, bandInset("bottom")),
    heightMm - frameInset - safeMm * 0.6,
  );
  const safeW = safeRight - safeLeft;
  /** Codes anchor here (frame-aware bottom). */
  const codeBottom = safeBottom;
  // footer-center codes push ALL text zones up.
  const codeStackH = bottomCenterCodes
    ? stackedCenter
      ? qrBox + barcodeH + gap * 2
      : Math.max(
          qrOn && qrMode !== "side" ? qrBox : 0,
          barcodeOn && barcodeMode !== "side" ? barcodeH : 0,
        ) + gap
    : 0;
  const zoneTop = safeTop;
  const zoneBottom = safeBottom - codeStackH;

  const objects: LabelObject[] = [];

  const pushEffectFrame = (thicknessFactor: number): void => {
    const t = MM(Math.max(Math.min(widthMm, heightMm) * thicknessFactor, 1.2));
    const fill: Fill = option.finishId
      ? { type: "finish", finishId: option.finishId, intensity: 0.9, scale: 1, angleDeg: 0 }
      : { type: "solid", color: palette.accent };
    const w = widthMm + bleedMm * 2;
    objects.push(
      rect({ slot: "accent:frame-top", xMm: widthMm / 2, yMm: (t - bleedMm) / 2, widthMm: w, heightMm: t + bleedMm, fill }),
      rect({ slot: "accent:frame-bottom", xMm: widthMm / 2, yMm: heightMm - (t - bleedMm) / 2, widthMm: w, heightMm: t + bleedMm, fill }),
      rect({ slot: "accent:frame-left", xMm: (t - bleedMm) / 2, yMm: heightMm / 2, widthMm: t + bleedMm, heightMm: heightMm + bleedMm * 2, fill }),
      rect({ slot: "accent:frame-right", xMm: widthMm - (t - bleedMm) / 2, yMm: heightMm / 2, widthMm: t + bleedMm, heightMm: heightMm + bleedMm * 2, fill }),
    );
  };

  // --- Decor (behind everything) --------------------------------------------
  for (const decor of decorActive) {
    if (decor.kind === "band") {
      if (decor.inset) {
        const bandH = MM(heightMm * decor.heightFactor);
        objects.push(rect({
          slot: `accent:band-${decor.edge}`,
          xMm: widthMm / 2,
          yMm: decor.edge === "top" ? safeMm + bandH / 2 : heightMm - safeMm - bandH / 2,
          widthMm: widthMm - safeMm * 2,
          heightMm: bandH,
          fill: decorFill(decor.fill, palette, option.finishId),
          cornerRadiusMm: 0.8,
        }));
      } else {
        // Bands overhang the trim edge into the bleed so they print edge-to-edge.
        const bandH = MM(heightMm * decor.heightFactor + bleedMm);
        objects.push(rect({
          slot: `accent:band-${decor.edge}`,
          xMm: widthMm / 2,
          yMm: decor.edge === "top" ? bandH / 2 - bleedMm : heightMm - bandH / 2 + bleedMm,
          widthMm: widthMm + bleedMm * 2,
          heightMm: bandH,
          fill: decorFill(decor.fill, palette, option.finishId),
        }));
      }
    } else if (decor.kind === "stripe") {
      const stripeW = MM(Math.max(widthMm * decor.widthFactor, 1.2));
      objects.push(rect({
        slot: `accent:stripe-${decor.edge}`,
        xMm: decor.edge === "left" ? (stripeW - bleedMm) / 2 : widthMm - (stripeW - bleedMm) / 2,
        yMm: heightMm / 2,
        widthMm: stripeW + bleedMm,
        heightMm: heightMm + bleedMm * 2,
        fill: decorFill(decor.fill, palette, option.finishId),
      }));
    } else if (decor.kind === "border") {
      objects.push({
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
    } else if (decor.kind === "corners") {
      const len = MM(Math.max(decor.lengthMm, 1.5));
      const thick = MM(Math.max(decor.strokePt * PT_TO_MM, 0.3));
      const inset = decor.insetMm;
      const fill: Fill = { type: "solid", color: roleColor(palette, decor.color) };
      for (const [cx, cy, hx, vy] of [
        [inset, inset, 1, 1],
        [widthMm - inset, inset, -1, 1],
        [inset, heightMm - inset, 1, -1],
        [widthMm - inset, heightMm - inset, -1, -1],
      ] as const) {
        objects.push(rect({
          slot: "accent:corner-h",
          xMm: cx + (hx * len) / 2,
          yMm: cy + (vy * thick) / 2,
          widthMm: len,
          heightMm: thick,
          fill,
        }));
        objects.push(rect({
          slot: "accent:corner-v",
          xMm: cx + (hx * thick) / 2,
          yMm: cy + (vy * len) / 2,
          widthMm: thick,
          heightMm: len,
          fill,
        }));
      }
    } else if (decor.kind === "side-rail") {
      const railW = MM(Math.max(decor.strokePt * PT_TO_MM, 0.3));
      objects.push(rect({
        slot: `accent:rail-${decor.edge}`,
        xMm: decor.edge === "left" ? decor.insetMm + railW / 2 : widthMm - decor.insetMm - railW / 2,
        yMm: heightMm / 2,
        widthMm: railW,
        heightMm: heightMm - safeMm * 2,
        fill: { type: "solid", color: roleColor(palette, decor.color) },
      }));
    } else if (decor.kind === "frame-effect") {
      pushEffectFrame(decor.thicknessFactor);
    }
    // underline-hero / divider / medallion are positioned after row layout.
  }

  // Placement "border": an automatic frame in the effect (or accent color).
  if (plan.effectFrame) {
    if (option.finishId) {
      pushEffectFrame(0.055);
    } else {
      objects.push({
        ...rect({
          slot: "accent:border",
          xMm: widthMm / 2,
          yMm: heightMm / 2,
          widthMm: widthMm - 2.2,
          heightMm: heightMm - 2.2,
          fill: { type: "none" },
        }),
        stroke: { color: palette.accent, widthPt: 1.6 },
        cornerRadiusMm: 0.8,
      });
    }
  }

  // --- Split columns -----------------------------------------------------------
  const split = template.split;
  const splitRatio = split?.ratio ?? 0.56;
  const splitGap = split ? 2.2 * scaleH : 0;
  const leftColW = split ? MM((safeW - splitGap) * splitRatio) : safeW;
  const rightColW = split ? MM(safeW - splitGap - leftColW) : 0;
  const rightColLeft = safeLeft + leftColW + splitGap;
  if (split?.divider) {
    objects.push(rect({
      slot: "accent:split-divider",
      xMm: MM(safeLeft + leftColW + splitGap / 2),
      yMm: heightMm / 2,
      widthMm: 0.35,
      heightMm: MM(zoneBottom - zoneTop),
      fill: { type: "solid", color: paletteBorder(palette) },
    }));
  }

  // --- Rows ------------------------------------------------------------------
  interface LaidRow {
    def: RowDef;
    obj: TextObject;
    heightMm: number;
    spacingBeforeMm: number;
  }

  const isRight = (row: RowDef) => Boolean(split && row.column === "right");
  const activeRows = activeRowsAll;

  // Codes narrow the footer column (corner placement, single column). With
  // BOTH codes on, the QR takes the template's corner, the barcode the
  // opposite one, and footer text lives between them.
  const codeRight = template.codeCorner === "bottom-right";
  const cornerQr = qrOn && qrMode === "corner" && !split;
  const cornerBarcode = barcodeOn && barcodeMode === "corner" && !split;
  const barcodeOnLeft = cornerQr ? codeRight : !codeRight;
  let footerReserveLeft = 0;
  let footerReserveRight = 0;
  if (cornerQr) {
    if (codeRight) footerReserveRight += qrBox + gap;
    else footerReserveLeft += qrBox + gap;
  }
  if (cornerBarcode) {
    if (barcodeOnLeft) footerReserveLeft += barcodeW + gap;
    else footerReserveRight += barcodeW + gap;
  }
  const footerW = MM(
    Math.max(
      safeW - footerReserveLeft - footerReserveRight,
      Math.min(MIN_TEXT_W, safeW),
    ),
  );
  const footerLeft = safeLeft + footerReserveLeft;
  /** Vertical space bottom-anchored codes occupy. */
  const cornerCodeH = Math.max(
    cornerQr ? qrBox : 0,
    cornerBarcode ? barcodeH : 0,
  );
  /** Side-gutter codes center as a pair when both share the gutter. */
  const sidePairH =
    (sideQr ? qrBox : 0) + (sideBarcode ? barcodeH : 0) + (sideQr && sideBarcode ? gap : 0);

  const columnWidth = (row: RowDef): number => {
    if (isRight(row)) return rightColW;
    if (split) return leftColW;
    return row.zone === "footer" ? footerW : safeW;
  };

  const buildRow = (row: RowDef, squeeze = 1): LaidRow => {
    const isFooter = row.zone === "footer";
    const columnW = columnWidth(row);
    const fontFamilyId = roleFamily(pairing, row.font);
    // One-click fixes: bigger product name / larger small print.
    let sizeFactor = row.sizeFactor;
    let minPt = Math.max(row.minPt, pairing.minimumPrintSizes[row.font]);
    if (row.slot === "product-name" && tweaks.nameScale) {
      sizeFactor *= tweaks.nameScale;
    }
    if (tweaks.textBoost && isFooter) {
      sizeFactor *= 1.15;
      minPt += 1;
    }
    // The squeeze scales preferred sizes but can never break the print floor.
    const prefPt = Math.max(((sizeFactor * heightMm) / PT_TO_MM / 1.28) * squeeze, minPt);

    const value = fields[row.slot]!.trim();
    const text = row.monogram ? ([...value][0]?.toUpperCase() ?? "") : value;
    const casing =
      row.casing ??
      (pairing.uppercaseRoles.includes(row.font) ? ("uppercase" as const) : undefined);
    const onAccentText =
      row.chip === "fill" ||
      // The accent panel only spans the LEFT column's hero.
      (plan.heroAccentPanel && row.zone === "hero" && !isRight(row));
    // Text on loud accent surfaces is always at least semibold — bold small
    // print keeps its legibility at lower contrast ratios. `emphasis` rows
    // take the pairing's heaviest declared weight for the role.
    const roleW = roleWeights(pairing, row.font);
    const baseWeight =
      row.weight ??
      (row.emphasis ? Math.max(...roleW) : roleDefaultWeight(pairing, row.font));
    const fontWeight = resolveWeight(
      fontFamilyId,
      onAccentText ? Math.max(baseWeight, 600) : baseWeight,
    ) as TextObject["fontWeight"];
    const effectTitleRow = plan.effectTitle && row.slot === "product-name";
    const fill: Fill = effectTitleRow
      ? option.finishId
        ? { type: "finish", finishId: option.finishId, intensity: 1, scale: 0.7, angleDeg: 0 }
        : { type: "solid", color: palette.accent }
      : {
          type: "solid",
          color: roleColor(palette, onAccentText ? "onAccent" : row.color),
        };

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
      text,
      fontFamilyId,
      fontWeight,
      fontSizePt: prefPt,
      lineHeight: row.zone === "footer" ? 1.25 : 1.12,
      letterSpacingEm:
        row.letterSpacingEm ?? pairing.defaultTracking[row.font] ?? 0,
      align:
        row.align ??
        (isRight(row)
          ? "left"
          : template.align === "center" && !isFooter
            ? "center"
            : template.align),
      textTransform: casing === "uppercase" ? "uppercase" : "none",
      fill,
      autoFit: false,
    };

    const fitted = fitRow(base, { prefPt, minPt, maxLines: row.maxLines }, measure);
    if (fitted.atMinimum) {
      notes.push(
        `"${base.text.length > 24 ? `${base.text.slice(0, 21)}…` : base.text}" was shrunk to fit — shorter text will look better.`,
      );
    }
    return {
      def: row,
      obj: { ...base, fontSizePt: MM(fitted.fontSizePt), heightMm: MM(fitted.heightMm) },
      heightMm: fitted.heightMm,
      // Spacing shrinks with the squeeze so tight labels recover air too.
      spacingBeforeMm:
        ((row.spacingBefore ?? 0.8) * scaleH * (tweaks.tight ? 0.6 : 1) +
          (row.chip ? 1.2 * scaleH : 0)) *
        squeeze,
    };
  };

  // --- Logo (header item) ------------------------------------------------------
  const logoOn = enabled.has("logo") && Boolean(fields.logo?.trim());
  const logoAspect = Math.max(input.logoAspect ?? 1, 0.05);
  let logoH = 0;
  let logoW = 0;
  if (logoOn) {
    logoH = MM(Math.min(Math.max(heightMm * 0.16, 3.5), 12));
    logoW = MM(logoH * logoAspect);
    const maxW = (split ? leftColW : safeW) * 0.7;
    if (logoW > maxW) {
      logoW = MM(maxW);
      logoH = MM(logoW / logoAspect);
    }
  }

  // --- Fit & squeeze -----------------------------------------------------------
  const availableH = zoneBottom - zoneTop;
  const columnHeight = (rows: LaidRow[]) =>
    rows.reduce((sum, r) => sum + r.heightMm + r.spacingBeforeMm, 0);
  const floor = tweaks.tight ? 0.45 : 0.55;

  let rowSet = activeRows;
  const buildAll = (squeeze: number): LaidRow[] =>
    rowSet.map((row) => buildRow(row, squeeze));
  // Corner codes reserve real vertical space in the footer zone; split
  // layouts reserve it inside the right column. Both count against the
  // fit budget so the centered hero can never drift into a code.
  const stackHeight = (rows: LaidRow[]): number => {
    const left = rows.filter((r) => !isRight(r.def));
    const leftFooterH = columnHeight(left.filter((r) => r.def.zone === "footer"));
    const leftOtherH =
      columnHeight(left.filter((r) => r.def.zone !== "footer")) +
      (logoOn ? logoH + 1 : 0);
    const leftTotal =
      leftOtherH +
      Math.max(leftFooterH, cornerCodeH > 0 ? cornerCodeH + gap * 0.5 : 0);
    const rightCodesH =
      split && (qrOn || barcodeOn) && !sideQr && !bottomCenterCodes
        ? (qrOn ? qrBox + gap : 0) + (barcodeOn ? barcodeH + gap : 0)
        : 0;
    const rightTotal = columnHeight(rows.filter((r) => isRight(r.def))) + rightCodesH;
    return Math.max(leftTotal, rightTotal);
  };

  let laid = buildAll(1);
  let factor = 1;
  // Iterative shrink: wrapped rows change height nonlinearly under a
  // squeeze, so a single proportional pass can undershoot. Converge (or
  // stop honestly at the print floor).
  const shrinkToFit = (): boolean => {
    for (let i = 0; i < 8; i++) {
      const h = stackHeight(laid);
      if (h <= availableH + 0.2) return true;
      const next = Math.max(squeezeFactor(h, availableH, floor) * factor, floor);
      if (next >= factor - 0.001) return false; // pinned at the print floor
      factor = next;
      laid = buildAll(factor);
    }
    return stackHeight(laid) <= availableH + 0.2;
  };
  let fits = shrinkToFit();
  if (factor < 1) {
    notes.push("Everything was scaled down slightly to fit — consider turning off a field.");
  }

  // Even at the squeeze floor a small label can't hold every optional
  // field. Rather than let rows collide, collapse the least important
  // ones (§6) and say so in plain language — content is never lost, the
  // fields are still in the form and come back on a taller label.
  // Least-important first; volume/warning/strength are last resorts for
  // truly tiny labels (a 12 mm neck band honestly holds brand + name only).
  // Brand and product name are never dropped.
  const DROP_ORDER: SlotId[] = [
    "verification",
    "website",
    "subtitle",
    "description",
    "storage",
    "directions",
    "expiry",
    "lot",
    "ingredients",
    "volume",
    "warning",
    "strength",
  ];
  let dropIndex = 0;
  const hiddenSlots: SlotId[] = [...hiddenCodes];
  while (!fits && dropIndex < DROP_ORDER.length) {
    const slot = DROP_ORDER[dropIndex]!;
    dropIndex += 1;
    if (!rowSet.some((r) => r.slot === slot)) continue;
    rowSet = rowSet.filter((r) => r.slot !== slot);
    hiddenSlots.push(slot);
    notes.push(
      `This label is too small for everything — "${SLOTS[slot].label}" was hidden. Turn fields off yourself or use a taller label.`,
    );
    laid = buildAll(factor);
    fits = shrinkToFit();
  }

  // --- Zone placement ----------------------------------------------------------
  type ZoneRows = Record<ZoneId, LaidRow[]>;
  const emptyZones = (): ZoneRows => ({ header: [], hero: [], footer: [] });
  const leftZones = emptyZones();
  const rightZones = emptyZones();
  for (const row of laid) {
    (isRight(row.def) ? rightZones : leftZones)[row.def.zone].push(row);
  }

  const logoItem = logoOn ? [{ heightMm: logoH, spacingBeforeMm: 0 }] : [];
  const toItems = (rows: LaidRow[]) =>
    rows.map((r) => ({ heightMm: r.heightMm, spacingBeforeMm: r.spacingBeforeMm }));

  // Right-column codes (split layouts) raise the right column's floor.
  const splitCodesH =
    split && (qrOn || barcodeOn) && !sideQr && !bottomCenterCodes
      ? (qrOn ? qrBox + gap : 0) + (barcodeOn ? barcodeH + gap : 0)
      : 0;

  // Corner codes taller than the footer text stack would let the centered
  // hero drift down into them — a phantom footer spacer reserves the gap
  // (mirrors the reservation stackHeight made during the fit pass).
  const leftFooterItems = toItems(leftZones.footer);
  const leftFooterH = leftFooterItems.reduce(
    (sum, item) => sum + item.heightMm + item.spacingBeforeMm,
    0,
  );
  const codeSpacer =
    cornerCodeH + gap * 0.5 > leftFooterH
      ? [{ heightMm: cornerCodeH + gap * 0.5 - leftFooterH, spacingBeforeMm: 0 }]
      : [];

  const leftTops = stackZones(
    {
      header: [...logoItem, ...toItems(leftZones.header)],
      hero: toItems(leftZones.hero),
      footer: [...codeSpacer, ...leftFooterItems],
    },
    { topMm: zoneTop, bottomMm: zoneBottom },
  );
  const rightTops = split
    ? stackZones(
        {
          header: toItems(rightZones.header),
          hero: toItems(rightZones.hero),
          footer: toItems(rightZones.footer),
        },
        { topMm: zoneTop, bottomMm: zoneBottom - splitCodesH },
      )
    : null;

  const placed: TextObject[] = [];
  const chips: RectObject[] = [];
  const placeRows = (
    rows: LaidRow[],
    topList: number[],
    startIndex: number,
    columnLeft: (row: LaidRow) => number,
  ) => {
    rows.forEach((row, i) => {
      const columnW = row.obj.widthMm;
      const left = columnLeft(row);
      const obj: TextObject = {
        ...row.obj,
        xMm: MM(left + columnW / 2),
        yMm: MM(topList[startIndex + i]! + row.heightMm / 2),
      };
      placed.push(obj);
      if (row.def.chip) {
        chips.push(chipBehind(obj, row.def.chip, palette, scaleH));
      }
    });
  };

  const leftColumnLeft = (row: LaidRow) =>
    !split && row.def.zone === "footer" ? footerLeft : safeLeft;
  placeRows(leftZones.header, leftTops.header, logoOn ? 1 : 0, leftColumnLeft);
  placeRows(leftZones.hero, leftTops.hero, 0, leftColumnLeft);
  placeRows(leftZones.footer, leftTops.footer, codeSpacer.length, leftColumnLeft);
  if (rightTops) {
    placeRows(rightZones.header, rightTops.header, 0, () => rightColLeft);
    placeRows(rightZones.hero, rightTops.hero, 0, () => rightColLeft);
    placeRows(rightZones.footer, rightTops.footer, 0, () => rightColLeft);
  }

  // --- Contrast protection (chips on effect backgrounds) ------------------------
  if (plan.finishBackground) {
    // Any text on the reflective film that is NOT already covered by the
    // footer panel, the hero panel, or its own row chip gets a tight
    // opaque chip: at "full" placement that's header + hero rows, at
    // "panel" placement the header (and split right column) rows the hero
    // panel doesn't reach.
    const footerIds = new Set(
      [...leftZones.footer, ...rightZones.footer].map((r) => r.obj.id),
    );
    const heroPanelIds = plan.heroPanel
      ? new Set(leftZones.hero.map((r) => r.obj.id))
      : new Set<string>();
    // Only FILL chips are opaque — outline chips still need protection.
    const ownChipIds = new Set(
      laid.filter((r) => r.def.chip === "fill").map((r) => r.obj.id),
    );
    for (const row of placed) {
      if (footerIds.has(row.id) || heroPanelIds.has(row.id)) continue;
      if (ownChipIds.has(row.id)) continue;
      chips.push(readabilityChip(row, panelColor(palette), scaleH));
    }
  }

  /**
   * Distance below a row at which a rule (underline/divider) can sit
   * without touching the next row — squeezed layouts close the gaps, so
   * the offset adapts to the real space available.
   */
  const ruleOffset = (row: TextObject, baseFactor: number): number => {
    const bottom = row.yMm + row.heightMm / 2;
    let nextTop = Infinity;
    for (const o of placed) {
      const top = o.yMm - o.heightMm / 2;
      if (top <= bottom + 0.05) continue;
      const overlapX =
        row.xMm - row.widthMm / 2 < o.xMm + o.widthMm / 2 &&
        o.xMm - o.widthMm / 2 < row.xMm + row.widthMm / 2;
      if (overlapX) nextTop = Math.min(nextTop, top);
    }
    const gap = nextTop - bottom;
    return Math.max(Math.min(baseFactor * scaleH, gap * 0.45), 0.25);
  };

  // --- Hero contrast panel / underline / divider / medallion --------------------
  const heroRows = placed.filter((o) =>
    leftZones.hero.some((r) => r.obj.id === o.id),
  );
  if (heroRows.length > 0) {
    const heroTop = Math.min(...heroRows.map((o) => o.yMm - o.heightMm / 2));
    const heroBottom = Math.max(...heroRows.map((o) => o.yMm + o.heightMm / 2));
    if (plan.heroPanel || plan.heroAccentPanel) {
      // Pad the panel but never let it reach neighboring rows or codes.
      const pad = 1.6 * scaleH;
      const headerIds = new Set(leftZones.header.map((r) => r.obj.id));
      const footerIds = new Set(leftZones.footer.map((r) => r.obj.id));
      const headerBottomMax = Math.max(
        zoneTop,
        ...placed.filter((o) => headerIds.has(o.id)).map((o) => o.yMm + o.heightMm / 2),
      );
      const footerTopMin = Math.min(
        zoneBottom,
        cornerCodeH > 0 ? codeBottom - cornerCodeH : Infinity,
        ...placed.filter((o) => footerIds.has(o.id)).map((o) => o.yMm - o.heightMm / 2),
      );
      const panelTop = Math.max(heroTop - pad, headerBottomMax + 0.4);
      const panelBottom = Math.min(heroBottom + pad, footerTopMin - 0.4);
      objects.push(rect({
        slot: "accent:hero-panel",
        // Center on the TEXT column — side gutters shift it off label center.
        xMm: split ? MM(safeLeft + leftColW / 2) : MM((safeLeft + safeRight) / 2),
        yMm: MM((panelTop + panelBottom) / 2),
        widthMm: split
          ? MM(leftColW + pad)
          : MM(Math.min(safeW + pad, widthMm - 2)),
        heightMm: MM(Math.max(panelBottom - panelTop, heroBottom - heroTop)),
        fill: {
          type: "solid",
          color: plan.heroAccentPanel ? palette.accent : panelColor(palette),
        },
        cornerRadiusMm: 1,
      }));
    }
    const underline = decorActive.find((d) => d.kind === "underline-hero");
    if (underline && underline.kind === "underline-hero") {
      const w = MM(Math.max(widthMm * underline.widthFactor, 6));
      const productRow = heroRows.find((o) => o.slot === "product-name");
      if (productRow) {
        objects.push(rect({
          slot: "accent:underline",
          xMm: template.align === "center" ? widthMm / 2 : MM(safeLeft + w / 2),
          yMm: MM(productRow.yMm + productRow.heightMm / 2 + ruleOffset(productRow, 1.1)),
          widthMm: w,
          heightMm: MM(Math.max(underline.strokePt * PT_TO_MM, 0.35)),
          fill: decorFill(underline.fill, palette, option.finishId),
        }));
      }
    }
    const medallion = decorActive.find((d) => d.kind === "medallion");
    if (medallion && medallion.kind === "medallion") {
      const headerRows = placed.filter((o) =>
        leftZones.header.some((r) => r.obj.id === o.id),
      );
      const target = headerRows[0] ?? heroRows[0];
      if (target) {
        const d = MM(Math.max(heightMm * medallion.sizeFactor, 4));
        const ellipse: EllipseObject = {
          id: newObjectId(),
          type: "ellipse",
          name: "",
          slot: "accent:medallion",
          xMm: target.xMm,
          yMm: target.yMm,
          widthMm: d,
          heightMm: d,
          rotationDeg: 0,
          opacity: 1,
          locked: false,
          visible: true,
          printLayer: "artwork",
          fill: medallion.ring
            ? { type: "none" }
            : decorFill(medallion.fill, palette, option.finishId),
          ...(medallion.ring
            ? {
                stroke: {
                  color:
                    "role" in medallion.fill
                      ? roleColor(palette, medallion.fill.role)
                      : palette.accent,
                  widthPt: 1,
                },
              }
            : {}),
        };
        objects.push(ellipse);
      }
    }
  }
  for (const decor of decorActive) {
    if (decor.kind !== "divider") continue;
    const target = placed.find((o) => o.slot === decor.after);
    if (!target) continue;
    const w = MM(Math.max(safeW * decor.widthFactor, 4));
    objects.push(rect({
      slot: `accent:divider-${decor.after}`,
      xMm:
        template.align === "center" && !split
          ? widthMm / 2
          : MM(target.xMm - target.widthMm / 2 + w / 2),
      yMm: MM(target.yMm + target.heightMm / 2 + ruleOffset(target, 0.9)),
      widthMm: w,
      heightMm: MM(Math.max(decor.strokePt * PT_TO_MM, 0.3)),
      fill: decorFill(decor.fill, palette, option.finishId),
    }));
  }

  // --- Footer contrast panel on full-effect backgrounds ------------------------
  const footerObjects = placed.filter(
    (o) =>
      leftZones.footer.some((r) => r.obj.id === o.id) ||
      rightZones.footer.some((r) => r.obj.id === o.id),
  );
  if (plan.footerPanel && (footerObjects.length > 0 || qrOn || barcodeOn)) {
    const contentTop = footerObjects.length
      ? Math.min(...footerObjects.map((o) => o.yMm - o.heightMm / 2))
      : codeBottom;
    const codesTop = codeBottom - Math.max(qrOn ? qrBox : 0, barcodeOn ? barcodeH : 0);
    const top = Math.min(contentTop, codesTop) - 1.2 * scaleH;
    objects.push(rect({
      slot: "accent:footer-panel",
      xMm: MM((safeLeft + safeRight) / 2),
      yMm: MM((top + codeBottom + 1.2 * scaleH) / 2),
      widthMm: MM(Math.min(safeW + 3.2 * scaleH, widthMm - 1.6)),
      heightMm: MM(codeBottom - top + 2.4 * scaleH),
      fill: { type: "solid", color: panelColor(palette) },
      cornerRadiusMm: 1,
    }));
  }

  // --- Logo object ---------------------------------------------------------------
  if (logoOn) {
    const colW = split ? leftColW : safeW;
    const x =
      template.align === "center" ? safeLeft + colW / 2 : safeLeft + logoW / 2;
    objects.push(logoObject(fields.logo!.trim(), {
      xMm: MM(x),
      yMm: MM(leftTops.header[0]! + logoH / 2),
      widthMm: logoW,
      heightMm: logoH,
      aspect: logoAspect,
    }));
  }

  objects.push(...chips);
  objects.push(...placed);

  // --- Vertical row --------------------------------------------------------------
  if (vr && vrValue) {
    const runH = zoneBottom - zoneTop;
    const family = roleFamily(pairing, vr.font);
    const weight = resolveWeight(
      family,
      vr.weight ?? roleDefaultWeight(pairing, vr.font),
    ) as TextObject["fontWeight"];
    const probe: TextObject = {
      id: newObjectId(),
      type: "text",
      name: "",
      slot: vr.slot,
      xMm: 0,
      yMm: 0,
      widthMm: MM(runH),
      heightMm: 1,
      rotationDeg: 0,
      opacity: 1,
      locked: false,
      visible: true,
      printLayer: "artwork",
      text: vrValue,
      fontFamilyId: family,
      fontWeight: weight,
      fontSizePt: vrPrefPt,
      lineHeight: 1.1,
      letterSpacingEm: vr.letterSpacingEm ?? 0.08,
      align: "center",
      textTransform: vr.casing === "uppercase" ? "uppercase" : "none",
      fill: { type: "solid", color: roleColor(palette, vr.color) },
      autoFit: false,
    };
    const fitted = fitRow(
      probe,
      { prefPt: vrPrefPt, minPt: vr.minPt, maxLines: 1 },
      measure,
    );
    const gutterCenter =
      vr.edge === "left"
        ? safeMm + stripeInset("left") + vrGutter / 2
        : widthMm - safeMm - stripeInset("right") - vrGutter / 2;
    const verticalObj: TextObject = {
      ...probe,
      xMm: MM(gutterCenter),
      yMm: MM(zoneTop + runH / 2),
      fontSizePt: MM(fitted.fontSizePt),
      heightMm: MM(fitted.heightMm),
      rotationDeg: vr.edge === "left" ? -90 : 90,
    };
    if (plan.finishBackground) {
      objects.push(readabilityChip(verticalObj, panelColor(palette), scaleH));
    }
    objects.push(verticalObj);
  }

  // --- QR / barcode objects --------------------------------------------------------
  if (qrOn) {
    let x: number;
    let y: number;
    if (sideQr) {
      x = widthMm - safeMm - qrBox / 2;
      const pairTop = zoneTop + Math.max((zoneBottom - zoneTop - sidePairH) / 2, 0);
      y = pairTop + qrBox / 2;
    } else if (stackedCenter) {
      x = widthMm / 2;
      y = codeBottom - barcodeH - gap - qrBox / 2;
    } else if (bottomCenterCodes) {
      x = widthMm / 2 - (barcodeOn && barcodeMode !== "side" ? (barcodeW + gap) / 2 : 0);
      y = codeBottom - qrBox / 2;
    } else if (split) {
      x = rightColLeft + qrBox / 2;
      y = zoneBottom - (barcodeOn ? barcodeH + gap : 0) - qrBox / 2;
    } else {
      x = codeRight ? safeRight - qrBox / 2 : safeLeft + qrBox / 2;
      y = codeBottom - qrBox / 2;
    }
    const qr: QrObject = {
      id: newObjectId(),
      type: "qrcode",
      name: "QR code",
      slot: "qr",
      xMm: MM(x),
      yMm: MM(y),
      widthMm: qrBox,
      heightMm: qrBox,
      rotationDeg: 0,
      opacity: 1,
      locked: false,
      visible: true,
      printLayer: "artwork",
      qrType: "url",
      value: fields.qr!.trim(),
      ecLevel: "M",
      fgColor: paletteQrColor(palette),
      bgColor: "#ffffff",
      moduleShape: "square",
      quietModules: 4,
    };
    objects.push(qr);
  }
  if (barcodeOn) {
    let x: number;
    let y = codeBottom - barcodeH / 2;
    if (sideBarcode) {
      x = widthMm - safeMm - barcodeW / 2;
      const pairTop = zoneTop + Math.max((zoneBottom - zoneTop - sidePairH) / 2, 0);
      y = pairTop + (sideQr ? qrBox + gap : 0) + barcodeH / 2;
    } else if (stackedCenter) {
      x = widthMm / 2;
    } else if (bottomCenterCodes) {
      x = widthMm / 2 + (qrOn && qrMode !== "side" ? (qrBox + gap) / 2 : 0);
    } else if (split) {
      x = rightColLeft + Math.min(barcodeW, rightColW) / 2;
      y = zoneBottom - barcodeH / 2;
    } else {
      x = barcodeOnLeft ? safeLeft + barcodeW / 2 : safeRight - barcodeW / 2;
    }
    const barcode: BarcodeObject = {
      id: newObjectId(),
      type: "barcode",
      name: "Barcode",
      slot: "barcode",
      xMm: MM(x),
      yMm: MM(y),
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

  return { background, substrateId: option.substrateId, objects, notes, hiddenSlots };
}

// ---------------------------------------------------------------------------
// Object builders
// ---------------------------------------------------------------------------

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

/** Tight pill behind a placed row (strength badges, category chips). */
function chipBehind(
  obj: TextObject,
  kind: "fill" | "outline",
  palette: EasyPalette,
  scaleH: number,
): RectObject {
  const textW = estimateTextWidthMm(obj);
  const padX = 1.6 * scaleH;
  const padY = 0.8 * scaleH;
  const w = Math.min(textW + padX * 2, obj.widthMm + padX);
  const x =
    obj.align === "center"
      ? obj.xMm
      : obj.align === "right"
        ? obj.xMm + obj.widthMm / 2 - w / 2
        : obj.xMm - obj.widthMm / 2 + w / 2;
  const base = rect({
    slot: `accent:chip-${obj.slot}`,
    xMm: x,
    yMm: obj.yMm,
    widthMm: w,
    heightMm: obj.heightMm + padY * 2,
    fill:
      kind === "fill" ? { type: "solid", color: palette.accent } : { type: "none" },
    cornerRadiusMm: (obj.heightMm + padY * 2) / 2,
  });
  return kind === "outline"
    ? { ...base, stroke: { color: palette.accent, widthPt: 0.9 } }
    : base;
}

/** Opaque chip exactly behind a text row (full-effect readability). */
function readabilityChip(obj: TextObject, color: string, scaleH: number): RectObject {
  const textW = estimateTextWidthMm(obj);
  const padX = 1.4 * scaleH;
  const padY = 0.6 * scaleH;
  const w = Math.min(textW + padX * 2, obj.widthMm + padX * 2);
  const x =
    obj.align === "center"
      ? obj.xMm
      : obj.align === "right"
        ? obj.xMm + obj.widthMm / 2 - w / 2
        : obj.xMm - obj.widthMm / 2 + w / 2;
  return {
    ...rect({
      slot: `accent:chip-${obj.slot}`,
      xMm: x,
      yMm: obj.yMm,
      widthMm: w,
      heightMm: obj.heightMm + padY * 2,
      fill: { type: "solid", color },
      cornerRadiusMm: 0.6,
    }),
    rotationDeg: obj.rotationDeg,
  };
}

function logoObject(
  src: string,
  box: { xMm: number; yMm: number; widthMm: number; heightMm: number; aspect: number },
): ImageObject {
  const naturalWidthPx = 512;
  return {
    id: newObjectId(),
    type: "image",
    name: "Logo",
    slot: "logo",
    xMm: box.xMm,
    yMm: box.yMm,
    widthMm: box.widthMm,
    heightMm: box.heightMm,
    rotationDeg: 0,
    opacity: 1,
    locked: false,
    visible: true,
    printLayer: "artwork",
    source: { kind: "url", url: src },
    naturalWidthPx,
    naturalHeightPx: Math.max(Math.round(naturalWidthPx / box.aspect), 1),
    fit: "contain",
    flipX: false,
    flipY: false,
    filters: { brightness: 0, contrast: 0, saturation: 0, blurPx: 0, grayscale: false },
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
