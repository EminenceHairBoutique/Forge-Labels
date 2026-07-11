import { createDocument } from "@/lib/document/defaults";
import { newObjectId } from "@/lib/document/ids";
import type {
  Background,
  BarcodeObject,
  EllipseObject,
  LabelDocument,
  LabelObject,
  LineObject,
  PolygonObject,
  QrObject,
  RectObject,
  StarObject,
  TextObject,
} from "@/lib/document/schema";
import { getVialPreset } from "@/lib/vials/presets";

/**
 * Compact builders for authoring templates. Each fills the object baseline
 * (id, rotation, opacity, …) so template files stay readable; the registry
 * test validates every generated document against the schema.
 */

const base = {
  name: "",
  rotationDeg: 0,
  opacity: 1,
  locked: false,
  visible: true,
  printLayer: "artwork" as const,
};

type TextInput = Partial<TextObject> &
  Pick<TextObject, "text" | "xMm" | "yMm" | "widthMm" | "fontSizePt">;

export function text(input: TextInput): TextObject {
  return {
    ...base,
    id: newObjectId(),
    type: "text",
    heightMm: input.heightMm ?? input.fontSizePt * 0.55,
    fontFamilyId: "inter",
    fontWeight: 400,
    lineHeight: 1.2,
    letterSpacingEm: 0,
    align: "center",
    textTransform: "none",
    fill: { type: "solid", color: "#1a1a1a" },
    autoFit: false,
    ...input,
  };
}

type ShapeInput<T> = Partial<T> & { xMm: number; yMm: number; widthMm: number; heightMm: number };

export function rect(input: ShapeInput<RectObject>): RectObject {
  return {
    ...base,
    id: newObjectId(),
    type: "rect",
    cornerRadiusMm: 0,
    fill: { type: "solid", color: "#1a1a1a" },
    ...input,
  };
}

export function ellipse(input: ShapeInput<EllipseObject>): EllipseObject {
  return {
    ...base,
    id: newObjectId(),
    type: "ellipse",
    fill: { type: "solid", color: "#1a1a1a" },
    ...input,
  };
}

export function line(
  input: Partial<LineObject> & { xMm: number; yMm: number; widthMm: number },
): LineObject {
  return {
    ...base,
    id: newObjectId(),
    type: "line",
    heightMm: 1,
    strokePt: 1,
    color: "#1a1a1a",
    cap: "butt",
    ...input,
  };
}

export function polygon(input: ShapeInput<PolygonObject>): PolygonObject {
  return {
    ...base,
    id: newObjectId(),
    type: "polygon",
    sides: 6,
    fill: { type: "solid", color: "#1a1a1a" },
    ...input,
  };
}

export function star(input: ShapeInput<StarObject>): StarObject {
  return {
    ...base,
    id: newObjectId(),
    type: "star",
    points: 5,
    innerRatio: 0.5,
    fill: { type: "solid", color: "#d4af5f" },
    ...input,
  };
}

export function qr(
  input: Partial<QrObject> & { value: string; xMm: number; yMm: number; widthMm: number },
): QrObject {
  return {
    ...base,
    id: newObjectId(),
    type: "qrcode",
    heightMm: input.widthMm,
    qrType: "url",
    ecLevel: "M",
    fgColor: "#000000",
    bgColor: null,
    moduleShape: "square",
    quietModules: 4,
    ...input,
  };
}

export function barcode(
  input: Partial<BarcodeObject> & {
    value: string;
    xMm: number;
    yMm: number;
    widthMm: number;
    heightMm: number;
  },
): BarcodeObject {
  return {
    ...base,
    id: newObjectId(),
    type: "barcode",
    symbology: "code128",
    showText: true,
    fgColor: "#000000",
    bgColor: null,
    ...input,
  };
}

export interface TemplateDocParts {
  background?: Background;
  substrateId?: string;
  objects: LabelObject[];
}

/**
 * Build a template document sized for a vial preset (default full-wrap).
 * The label canvas is exactly what createDocument produces for that preset,
 * so template coordinates target the same space users get.
 */
export function templateDoc(presetId: string, parts: TemplateDocParts): LabelDocument {
  const preset = getVialPreset(presetId);
  if (!preset) throw new Error(`Unknown vial preset: ${presetId}`);
  const doc = createDocument({ preset });
  return {
    ...doc,
    background: parts.background ?? { type: "solid", color: "#ffffff" },
    substrateId: parts.substrateId ?? "white-pp",
    objects: parts.objects,
  };
}
