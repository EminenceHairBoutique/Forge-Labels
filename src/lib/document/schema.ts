import { z } from "zod";

/**
 * The label document — the single source of truth for a design.
 *
 * Conventions (load-bearing, do not change casually):
 * - Every length is millimeters ("…Mm"), except font/stroke sizes which are
 *   typographic points ("…Pt", 1 pt = 1/72 in — still a physical unit).
 * - Object x/y is the CENTER of the object's box, on the TRIM coordinate
 *   system: (0,0) is the top-left corner of the finished label; bleed
 *   extends into negative coordinates.
 * - Rotation is degrees clockwise about the object center.
 * - Z-order is array order (first = back).
 * - `schemaVersion` gates migrations in migrate.ts. Bump it when the shape
 *   changes; never silently break stored documents.
 */

export const DOCUMENT_SCHEMA_VERSION = 2;

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "Invalid color");

export const ColorSchema = hexColor;

export const GradientStopSchema = z.object({
  offset: z.number().min(0).max(1),
  color: hexColor,
});

export const FillSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("solid"), color: hexColor }),
  z.object({
    type: z.literal("linear-gradient"),
    angleDeg: z.number(),
    stops: z.array(GradientStopSchema).min(2),
  }),
  z.object({
    type: z.literal("radial-gradient"),
    stops: z.array(GradientStopSchema).min(2),
  }),
  // Simulated special-material fills (holographic, foils…). Params are
  // interpreted by lib/finishes; kept schema-loose intentionally so new
  // finishes don't require a document migration.
  z.object({
    type: z.literal("finish"),
    finishId: z.string(),
    intensity: z.number().min(0).max(1).default(0.8),
    scale: z.number().positive().default(1),
    angleDeg: z.number().default(0),
  }),
]);
export type Fill = z.infer<typeof FillSchema>;

export const StrokeSchema = z.object({
  color: hexColor,
  widthPt: z.number().min(0),
  dash: z.array(z.number().nonnegative()).optional(),
});
export type Stroke = z.infer<typeof StrokeSchema>;

export const ShadowSchema = z.object({
  color: hexColor,
  opacity: z.number().min(0).max(1).default(0.5),
  blurPt: z.number().min(0),
  offsetXPt: z.number(),
  offsetYPt: z.number(),
});
export type Shadow = z.infer<typeof ShadowSchema>;

/** Special print-production layer assignment (UI deferred — see docs/deferred.md; stored from v1). */
export const PrintLayerSchema = z.enum([
  "artwork",
  "white-ink",
  "foil-gold",
  "foil-silver",
  "foil-holographic",
  "spot-uv",
  "emboss",
  "deboss",
  "die-cut",
  "varnish",
]);
export type PrintLayer = z.infer<typeof PrintLayerSchema>;

// ---------------------------------------------------------------------------
// Objects
// ---------------------------------------------------------------------------

const baseObject = {
  id: z.string().min(1),
  name: z.string().default(""),
  xMm: z.number(),
  yMm: z.number(),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  rotationDeg: z.number().default(0),
  opacity: z.number().min(0).max(1).default(1),
  locked: z.boolean().default(false),
  visible: z.boolean().default(true),
  printLayer: PrintLayerSchema.default("artwork"),
  /**
   * Semantic role for Easy Creator (v2): "brand", "product-name", "qr"…
   * (see src/lib/easy/slots.ts). Objects without a slot are free objects —
   * fully editable in the Advanced Editor, ignored by the Easy form.
   */
  slot: z.string().optional(),
};

export const FONT_WEIGHTS = [400, 500, 600, 700, 800, 900] as const;

export const TextObjectSchema = z.object({
  ...baseObject,
  type: z.literal("text"),
  text: z.string(),
  fontFamilyId: z.string(),
  fontWeight: z
    .number()
    .refine((w): w is (typeof FONT_WEIGHTS)[number] =>
      (FONT_WEIGHTS as readonly number[]).includes(w),
    )
    .default(400),
  fontSizePt: z.number().positive(),
  lineHeight: z.number().positive().default(1.25),
  letterSpacingEm: z.number().default(0),
  align: z.enum(["left", "center", "right"]).default("left"),
  textTransform: z.enum(["none", "uppercase", "lowercase"]).default("none"),
  fill: FillSchema.default({ type: "solid", color: "#1a1a1a" }),
  stroke: StrokeSchema.optional(),
  shadow: ShadowSchema.optional(),
  /** Curved text along an arc; radius from the arc center to the baseline. */
  curve: z
    .object({
      radiusMm: z.number().positive(),
      direction: z.enum(["up", "down"]),
    })
    .optional(),
  /** Shrink font size to keep text inside the box (never grows past fontSizePt). */
  autoFit: z.boolean().default(false),
});
export type TextObject = z.infer<typeof TextObjectSchema>;

export const RectObjectSchema = z.object({
  ...baseObject,
  type: z.literal("rect"),
  cornerRadiusMm: z.number().min(0).default(0),
  fill: FillSchema.default({ type: "solid", color: "#4c3d8f" }),
  stroke: StrokeSchema.optional(),
  shadow: ShadowSchema.optional(),
});
export type RectObject = z.infer<typeof RectObjectSchema>;

export const EllipseObjectSchema = z.object({
  ...baseObject,
  type: z.literal("ellipse"),
  fill: FillSchema.default({ type: "solid", color: "#4c3d8f" }),
  stroke: StrokeSchema.optional(),
  shadow: ShadowSchema.optional(),
});
export type EllipseObject = z.infer<typeof EllipseObjectSchema>;

/** A straight line: length = widthMm along local x, centered on (xMm, yMm). */
export const LineObjectSchema = z.object({
  ...baseObject,
  type: z.literal("line"),
  strokePt: z.number().positive().default(1),
  color: hexColor.default("#1a1a1a"),
  dash: z.array(z.number().nonnegative()).optional(),
  cap: z.enum(["butt", "round"]).default("butt"),
});
export type LineObject = z.infer<typeof LineObjectSchema>;

export const PolygonObjectSchema = z.object({
  ...baseObject,
  type: z.literal("polygon"),
  sides: z.number().int().min(3).max(24).default(6),
  fill: FillSchema.default({ type: "solid", color: "#4c3d8f" }),
  stroke: StrokeSchema.optional(),
  shadow: ShadowSchema.optional(),
});
export type PolygonObject = z.infer<typeof PolygonObjectSchema>;

export const StarObjectSchema = z.object({
  ...baseObject,
  type: z.literal("star"),
  points: z.number().int().min(3).max(24).default(5),
  innerRatio: z.number().min(0.1).max(0.95).default(0.5),
  fill: FillSchema.default({ type: "solid", color: "#d4af5f" }),
  stroke: StrokeSchema.optional(),
  shadow: ShadowSchema.optional(),
});
export type StarObject = z.infer<typeof StarObjectSchema>;

export const ImageSourceSchema = z.discriminatedUnion("kind", [
  /** User upload stored via the storage adapter (IndexedDB or Supabase). */
  z.object({ kind: z.literal("asset"), assetId: z.string() }),
  /** Bundled/template image served from a same-origin URL. */
  z.object({ kind: z.literal("url"), url: z.string() }),
]);
export type ImageSource = z.infer<typeof ImageSourceSchema>;

export const ImageObjectSchema = z.object({
  ...baseObject,
  type: z.literal("image"),
  source: ImageSourceSchema,
  naturalWidthPx: z.number().positive(),
  naturalHeightPx: z.number().positive(),
  fit: z.enum(["fill", "contain", "cover"]).default("cover"),
  /** Normalized crop rect (0–1) applied before fitting. */
  crop: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().min(0).max(1),
      height: z.number().min(0).max(1),
    })
    .optional(),
  flipX: z.boolean().default(false),
  flipY: z.boolean().default(false),
  filters: z
    .object({
      brightness: z.number().min(-1).max(1).default(0),
      contrast: z.number().min(-100).max(100).default(0),
      saturation: z.number().min(-2).max(2).default(0),
      blurPx: z.number().min(0).max(40).default(0),
      grayscale: z.boolean().default(false),
    })
    .default({ brightness: 0, contrast: 0, saturation: 0, blurPx: 0, grayscale: false }),
  shadow: ShadowSchema.optional(),
});
export type ImageObject = z.infer<typeof ImageObjectSchema>;

export const QrTypeSchema = z.enum(["url", "text", "email", "phone", "wifi", "vcard"]);

export const QrObjectSchema = z.object({
  ...baseObject,
  type: z.literal("qrcode"),
  qrType: QrTypeSchema.default("url"),
  /** The exact payload to encode (the UI composes vcard/wifi/etc. strings). */
  value: z.string(),
  ecLevel: z.enum(["L", "M", "Q", "H"]).default("M"),
  fgColor: hexColor.default("#000000"),
  /** null = transparent background. */
  bgColor: hexColor.nullable().default("#ffffff"),
  moduleShape: z.enum(["square", "rounded", "dot"]).default("square"),
  /** Quiet zone in modules (spec minimum is 4). */
  quietModules: z.number().int().min(0).max(10).default(4),
  logo: z
    .object({
      source: ImageSourceSchema,
      /** Logo size as a fraction of the code's edge (0.15–0.3 sane). */
      sizeRatio: z.number().min(0.1).max(0.35).default(0.2),
    })
    .optional(),
});
export type QrObject = z.infer<typeof QrObjectSchema>;

export const BarcodeSymbologySchema = z.enum([
  "code128",
  "code39",
  "ean13",
  "upca",
  "datamatrix",
]);
export type BarcodeSymbology = z.infer<typeof BarcodeSymbologySchema>;

export const BarcodeObjectSchema = z.object({
  ...baseObject,
  type: z.literal("barcode"),
  symbology: BarcodeSymbologySchema.default("code128"),
  value: z.string(),
  showText: z.boolean().default(true),
  fgColor: hexColor.default("#000000"),
  /** null = transparent background. */
  bgColor: hexColor.nullable().default("#ffffff"),
});
export type BarcodeObject = z.infer<typeof BarcodeObjectSchema>;

/**
 * Group: children are positioned by their centers in the group's unrotated
 * local space, with (0,0) at the group box's TOP-LEFT corner (see
 * structure-commands' childToDocSpace). Nested groups are allowed.
 */
export interface GroupObject extends z.infer<typeof GroupObjectBaseSchema> {
  type: "group";
  children: LabelObject[];
}
const GroupObjectBaseSchema = z.object(baseObject);

export type LabelObject =
  | TextObject
  | RectObject
  | EllipseObject
  | LineObject
  | PolygonObject
  | StarObject
  | ImageObject
  | QrObject
  | BarcodeObject
  | GroupObject;

export const LabelObjectSchema: z.ZodType<LabelObject> = z.lazy(() =>
  z.discriminatedUnion("type", [
    TextObjectSchema,
    RectObjectSchema,
    EllipseObjectSchema,
    LineObjectSchema,
    PolygonObjectSchema,
    StarObjectSchema,
    ImageObjectSchema,
    QrObjectSchema,
    BarcodeObjectSchema,
    GroupObjectBaseSchema.extend({
      type: z.literal("group"),
      children: z.array(LabelObjectSchema),
    }),
  ]),
) as z.ZodType<LabelObject>;

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export const LabelStyleSchema = z.enum([
  "full-wrap",
  "partial-wrap",
  "front-only",
  "front-back",
  "neck-band",
  "cap-circle",
]);

export const GlassColorSchema = z.enum(["clear", "amber", "cobalt", "frosted", "opaque"]);
export const CapStyleSchema = z.enum(["crimp", "flip-off", "screw", "dropper", "pump", "none"]);

export const VialSpecSchema = z.object({
  presetId: z.string().nullable().default(null),
  diameterMm: z.number().positive(),
  straightWallHeightMm: z.number().positive(),
  totalHeightMm: z.number().positive(),
  capStyle: CapStyleSchema.default("screw"),
  capHeightMm: z.number().nonnegative().default(12),
  capDiameterMm: z.number().positive().default(20),
  neckDiameterMm: z.number().positive().default(20),
  // Mockup presentation (per-project, editable in the preview panel).
  glass: GlassColorSchema.default("clear"),
  capColor: hexColor.default("#2a2a2e"),
  liquidColor: hexColor.default("#b9a2ff"),
  /** 0–1 fraction of the body filled with liquid. */
  liquidFill: z.number().min(0).max(1).default(0.65),
});
export type VialSpec = z.infer<typeof VialSpecSchema>;

export const LabelGeometrySchema = z.object({
  style: LabelStyleSchema.default("full-wrap"),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  bleedMm: z.number().nonnegative().default(2),
  safeMm: z.number().nonnegative().default(3),
  /** Corner radius of the die-cut shape ("cap-circle" labels ignore this). */
  cornerRadiusMm: z.number().nonnegative().default(1.5),
  shape: z.enum(["rect", "circle"]).default("rect"),
  /** Seam gap for wrap styles (informational; used by mockup + warnings). */
  seamGapMm: z.number().nullable().default(null),
});
export type LabelGeometry = z.infer<typeof LabelGeometrySchema>;

export const BackgroundSchema = z.discriminatedUnion("type", [
  /** Transparent — shows the substrate (clear film, kraft, metallic…). */
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("solid"), color: hexColor }),
  z.object({
    type: z.literal("linear-gradient"),
    angleDeg: z.number().default(0),
    stops: z.array(GradientStopSchema).min(2),
  }),
  z.object({
    type: z.literal("finish"),
    finishId: z.string(),
    intensity: z.number().min(0).max(1).default(0.8),
    scale: z.number().positive().default(1),
    angleDeg: z.number().default(0),
  }),
]);
export type Background = z.infer<typeof BackgroundSchema>;

/**
 * Easy Creator metadata (v2). Content itself lives in the slot objects —
 * this block records the choices that generated the layout (template,
 * material, palette) plus stashed values of toggled-off optional fields so
 * re-enabling them restores the text. Absent on documents authored purely
 * in the Advanced Editor.
 */
export const EasyMetaSchema = z.object({
  templateId: z.string(),
  materialId: z.string(),
  materialOptionId: z.string(),
  intensity: z.enum(["subtle", "balanced", "bold", "maximum"]).optional(),
  paletteId: z.string(),
  styleId: z.string().optional(),
  stash: z.record(z.string(), z.string()).optional(),
});
export type EasyMeta = z.infer<typeof EasyMetaSchema>;

export const LabelDocumentSchema = z.object({
  schemaVersion: z.literal(DOCUMENT_SCHEMA_VERSION),
  vial: VialSpecSchema,
  label: LabelGeometrySchema,
  background: BackgroundSchema.default({ type: "solid", color: "#ffffff" }),
  /** Simulated print substrate (lib/finishes/substrates). */
  substrateId: z.string().default("white-pp"),
  objects: z.array(LabelObjectSchema).default([]),
  easy: EasyMetaSchema.optional(),
});
export type LabelDocument = z.infer<typeof LabelDocumentSchema>;

/** Parse + validate an untrusted document (storage, import, templates). */
export function parseLabelDocument(data: unknown): LabelDocument {
  return LabelDocumentSchema.parse(data);
}

export function safeParseLabelDocument(data: unknown) {
  return LabelDocumentSchema.safeParse(data);
}
