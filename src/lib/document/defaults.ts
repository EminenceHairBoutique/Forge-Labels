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
  type LabelDocument,
  type LabelObject,
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
