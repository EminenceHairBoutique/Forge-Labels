import {
  calculateLabel,
  type LabelCalcInput,
  type LabelStyle,
} from "@/lib/geometry/label-calculator";
import { getVialPreset, type VialPreset } from "@/lib/vials/presets";
import { roundMm } from "@/lib/geometry/units";
import { newObjectId } from "./ids";
import {
  DOCUMENT_SCHEMA_VERSION,
  type BarcodeObject,
  type ImageObject,
  type ImageSource,
  type LabelDocument,
  type LabelObject,
  type QrObject,
  type TextObject,
} from "./schema";

/**
 * Factories for new documents and objects. All defaults route through the
 * label calculator so a fresh canvas always matches the vial's physics.
 */

export interface NewDocumentOptions {
  preset?: VialPreset;
  style?: LabelStyle;
  /** Overrides for custom vials (mm). */
  diameterMm?: number;
  straightWallHeightMm?: number;
  gapMm?: number;
  bleedMm?: number;
  safeMm?: number;
}

export function createDocument(options: NewDocumentOptions = {}): LabelDocument {
  const preset = options.preset ?? getVialPreset("10ml-serum")!;
  const style = options.style ?? preset.defaultLabelStyle;
  const diameterMm = options.diameterMm ?? preset.diameterMm;
  const straightWallHeightMm =
    options.straightWallHeightMm ?? preset.straightWallHeightMm;

  const calcInput: LabelCalcInput = {
    diameterMm,
    straightWallHeightMm,
    style,
    gapMm: options.gapMm,
    bleedMm: options.bleedMm,
    safeMm: options.safeMm,
    neckDiameterMm: preset.neckDiameterMm,
    capDiameterMm: preset.capDiameterMm,
  };
  const calc = calculateLabel(calcInput);
  if (calc.widthMm <= 0 || calc.heightMm <= 0) {
    throw new Error("Cannot create a document from these vial dimensions");
  }

  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    vial: {
      presetId: preset.isCustom ? null : preset.id,
      diameterMm,
      straightWallHeightMm,
      totalHeightMm: preset.totalHeightMm,
      capStyle: preset.capStyle,
      capHeightMm: preset.capHeightMm,
      capDiameterMm: preset.capDiameterMm,
      neckDiameterMm: preset.neckDiameterMm,
      glass: preset.defaultGlass,
      capColor: "#2a2a2e",
      liquidColor: "#b9a2ff",
      liquidFill: 0.65,
    },
    label: {
      style,
      widthMm: roundMm(calc.widthMm),
      heightMm: roundMm(calc.heightMm),
      bleedMm: calc.bleedMm,
      safeMm: calc.safeMm,
      cornerRadiusMm: style === "cap-circle" ? 0 : 1.5,
      shape: style === "cap-circle" ? "circle" : "rect",
      seamGapMm: calc.seamGapMm,
    },
    background: { type: "solid", color: "#ffffff" },
    substrateId: "white-pp",
    objects: [],
  };
}

// ---------------------------------------------------------------------------
// Object factories (position defaults to the label center)
// ---------------------------------------------------------------------------

function center(doc: LabelDocument): { xMm: number; yMm: number } {
  return { xMm: doc.label.widthMm / 2, yMm: doc.label.heightMm / 2 };
}

const objectBaseDefaults = {
  rotationDeg: 0,
  opacity: 1,
  locked: false,
  visible: true,
  printLayer: "artwork" as const,
};

export function createTextObject(
  doc: LabelDocument,
  overrides: Partial<TextObject> = {},
): TextObject {
  const width = Math.min(doc.label.widthMm * 0.7, 60);
  return {
    ...objectBaseDefaults,
    id: newObjectId(),
    type: "text",
    name: "Text",
    ...center(doc),
    widthMm: width,
    heightMm: 8,
    text: "Your text",
    fontFamilyId: "inter",
    fontWeight: 400,
    fontSizePt: 10,
    lineHeight: 1.25,
    letterSpacingEm: 0,
    align: "center",
    textTransform: "none",
    fill: { type: "solid", color: "#1a1a1a" },
    autoFit: false,
    ...overrides,
  };
}

export function createQrObject(
  doc: LabelDocument,
  overrides: Partial<QrObject> = {},
): QrObject {
  const size = Math.min(doc.label.heightMm * 0.6, doc.label.widthMm * 0.35, 20);
  return {
    ...objectBaseDefaults,
    id: newObjectId(),
    type: "qrcode",
    name: "QR code",
    ...center(doc),
    widthMm: size,
    heightMm: size,
    qrType: "url",
    value: "https://example.com",
    ecLevel: "M",
    fgColor: "#000000",
    bgColor: null,
    moduleShape: "square",
    quietModules: 4,
    ...overrides,
  };
}

export function createBarcodeObject(
  doc: LabelDocument,
  overrides: Partial<BarcodeObject> = {},
): BarcodeObject {
  return {
    ...objectBaseDefaults,
    id: newObjectId(),
    type: "barcode",
    name: "Barcode",
    ...center(doc),
    widthMm: Math.min(doc.label.widthMm * 0.45, 40),
    heightMm: Math.min(doc.label.heightMm * 0.4, 12),
    symbology: "code128",
    value: "LOT-0001",
    showText: true,
    fgColor: "#000000",
    bgColor: null,
    ...overrides,
  };
}

export function createImageObject(
  doc: LabelDocument,
  source: ImageSource,
  naturalWidthPx: number,
  naturalHeightPx: number,
  name = "Image",
): ImageObject {
  // Fit the image inside ~60% of the label, preserving its aspect ratio.
  const maxW = doc.label.widthMm * 0.6;
  const maxH = doc.label.heightMm * 0.6;
  const aspect = naturalWidthPx / naturalHeightPx;
  let widthMm = maxW;
  let heightMm = maxW / aspect;
  if (heightMm > maxH) {
    heightMm = maxH;
    widthMm = maxH * aspect;
  }
  return {
    ...objectBaseDefaults,
    id: newObjectId(),
    type: "image",
    name,
    ...center(doc),
    widthMm: Math.max(widthMm, 2),
    heightMm: Math.max(heightMm, 2),
    source,
    naturalWidthPx,
    naturalHeightPx,
    fit: "cover",
    flipX: false,
    flipY: false,
    filters: { brightness: 0, contrast: 0, saturation: 0, blurPx: 0, grayscale: false },
  };
}

export function createShapeObject(
  doc: LabelDocument,
  shape: "rect" | "ellipse" | "line" | "polygon" | "star",
  overrides: Partial<Record<string, unknown>> = {},
): LabelObject {
  const size = Math.min(doc.label.heightMm, doc.label.widthMm) * 0.4;
  const base = {
    ...objectBaseDefaults,
    id: newObjectId(),
    ...center(doc),
    widthMm: size,
    heightMm: size,
  };
  switch (shape) {
    case "rect":
      return {
        ...base,
        type: "rect",
        name: "Rectangle",
        cornerRadiusMm: 0,
        fill: { type: "solid", color: "#4c3d8f" },
        ...overrides,
      } as LabelObject;
    case "ellipse":
      return {
        ...base,
        type: "ellipse",
        name: "Ellipse",
        fill: { type: "solid", color: "#4c3d8f" },
        ...overrides,
      } as LabelObject;
    case "line":
      return {
        ...base,
        type: "line",
        name: "Line",
        widthMm: doc.label.widthMm * 0.5,
        heightMm: 1,
        strokePt: 1,
        color: "#1a1a1a",
        cap: "butt",
        ...overrides,
      } as LabelObject;
    case "polygon":
      return {
        ...base,
        type: "polygon",
        name: "Polygon",
        sides: 6,
        fill: { type: "solid", color: "#4c3d8f" },
        ...overrides,
      } as LabelObject;
    case "star":
      return {
        ...base,
        type: "star",
        name: "Star",
        points: 5,
        innerRatio: 0.5,
        fill: { type: "solid", color: "#d4af5f" },
        ...overrides,
      } as LabelObject;
  }
}
