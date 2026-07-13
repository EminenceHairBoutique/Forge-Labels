import { z } from "zod";
import { FONT_FAMILIES } from "@/lib/fonts/registry";

/**
 * Assistant tool definitions: zod schemas double as executor-side
 * validation (see execute.ts) and — via z.toJSONSchema — as the wire
 * `input_schema` the server sends to the API. This module stays free of
 * DOM/canvas imports so the route can bundle it.
 *
 * Deliberately NOT exposed as tools: vial/substrate changes (physical
 * choices that belong in the UI), finish fills (visual pickers), image
 * uploads (needs a file), and raw heightMm on text (derived from metrics).
 */

// --- Shared clamps ----------------------------------------------------------

const HEX_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const MmCoord = z
  .number()
  .min(-500)
  .max(500)
  .describe("mm, on the trim coordinate system ((0,0) = label top-left; object CENTER)");
const MmSize = z.number().min(0.1).max(1000).describe("mm");
const HexColor = z.string().regex(HEX_RE, "must be a hex color like #1a1a2e");
const Rotation = z.number().min(-360).max(360).describe("degrees clockwise");
const ObjectName = z.string().max(80);
const IdList = z
  .array(z.string().min(1))
  .min(1)
  .max(50)
  .describe("object ids from the document state");

const FONT_IDS = FONT_FAMILIES.map((f) => f.id).join(", ");

// --- Tool input schemas -----------------------------------------------------

export const GetDocumentStateInput = z.strictObject({});

export const AddTextObjectInput = z.strictObject({
  text: z.string().min(1).max(500),
  xMm: MmCoord.optional(),
  yMm: MmCoord.optional(),
  widthMm: MmSize.optional().describe("wrap width in mm; text wraps inside it"),
  fontSizePt: z.number().min(2).max(200).optional(),
  fontFamilyId: z
    .string()
    .optional()
    .describe(`bundled font id — one of: ${FONT_IDS}`),
  fontWeight: z
    .number()
    .int()
    .min(100)
    .max(900)
    .optional()
    .describe("snapped to the nearest available weight of the family"),
  align: z.enum(["left", "center", "right"]).optional(),
  colorHex: HexColor.optional(),
  rotationDeg: Rotation.optional(),
  name: ObjectName.optional(),
});

export const AddShapeObjectInput = z.strictObject({
  shape: z.enum(["rect", "ellipse", "line", "polygon", "star"]),
  xMm: MmCoord.optional(),
  yMm: MmCoord.optional(),
  widthMm: MmSize.optional(),
  heightMm: MmSize.optional(),
  fillColorHex: HexColor.optional().describe("ignored for lines (use strokeColorHex)"),
  strokeColorHex: HexColor.optional(),
  strokeWidthPt: z.number().min(0.1).max(50).optional(),
  cornerRadiusMm: z.number().min(0).max(100).optional().describe("rect only"),
  sides: z.number().int().min(3).max(24).optional().describe("polygon only"),
  points: z.number().int().min(3).max(24).optional().describe("star only"),
  innerRatio: z.number().min(0.1).max(0.95).optional().describe("star only"),
  rotationDeg: Rotation.optional(),
  name: ObjectName.optional(),
});

export const AddQrObjectInput = z.strictObject({
  value: z
    .string()
    .min(1)
    .max(2000)
    .describe("exact payload to encode (URL, text, …)"),
  xMm: MmCoord.optional(),
  yMm: MmCoord.optional(),
  sizeMm: MmSize.optional().describe("edge length; QR codes are square"),
  fgColorHex: HexColor.optional(),
  ecLevel: z.enum(["L", "M", "Q", "H"]).optional(),
  name: ObjectName.optional(),
});

export const AddBarcodeObjectInput = z.strictObject({
  symbology: z.enum(["code128", "code39", "ean13", "upca", "datamatrix"]),
  value: z.string().min(1).max(200),
  xMm: MmCoord.optional(),
  yMm: MmCoord.optional(),
  widthMm: MmSize.optional(),
  heightMm: MmSize.optional(),
  showText: z.boolean().optional().describe("print the human-readable value below the bars"),
  name: ObjectName.optional(),
});

export const UpdateObjectInput = z.strictObject({
  id: z.string().min(1).describe("object id from the document state"),
  patch: z
    .record(z.string(), z.unknown())
    .describe(
      "fields to change. Common: name, xMm, yMm, widthMm, heightMm, rotationDeg, " +
        "opacity (0–1), visible, locked, printLayer. Text: text, fontFamilyId, " +
        "fontWeight, fontSizePt, lineHeight, letterSpacingEm, align, textTransform, " +
        "fill, stroke, autoFit (heightMm is derived — change metrics instead). " +
        'Shapes: fill (e.g. {"type":"solid","color":"#334155"}), stroke ' +
        '({"color":"#000000","widthPt":1}), cornerRadiusMm, sides, points, innerRatio. ' +
        "Line: strokePt, color, dash, cap. QR: value, ecLevel, fgColor, bgColor, " +
        "moduleShape, quietModules. Barcode: symbology, value, showText, fgColor, " +
        "bgColor. Image: fit, flipX, flipY, opacity.",
    ),
});

export const RemoveObjectsInput = z.strictObject({ ids: IdList });

export const DuplicateObjectsInput = z.strictObject({
  ids: IdList.describe("top-level object ids; copies land 2mm down-right"),
});

export const AlignObjectsInput = z.strictObject({
  ids: IdList,
  edge: z
    .enum(["left", "center-h", "right", "top", "middle-v", "bottom"])
    .describe("a single object aligns to the label; several align to their joint box"),
});

export const DistributeObjectsInput = z.strictObject({
  ids: z.array(z.string().min(1)).min(3).max(50),
  axis: z.enum(["horizontal", "vertical"]),
});

export const ReorderObjectsInput = z.strictObject({
  ids: IdList,
  direction: z.enum(["front", "forward", "backward", "back"]),
});

export const GroupObjectsInput = z.strictObject({
  ids: z.array(z.string().min(1)).min(2).max(50).describe("top-level object ids"),
});

export const UngroupObjectsInput = z.strictObject({
  ids: IdList.describe("ids of group objects to dissolve"),
});

export const SetBackgroundInput = z.strictObject({
  type: z.enum(["none", "solid", "linear-gradient"]),
  color: HexColor.optional().describe("required for solid"),
  angleDeg: z.number().min(-360).max(360).optional().describe("linear-gradient only"),
  stops: z
    .array(z.strictObject({ offset: z.number().min(0).max(1), color: HexColor }))
    .min(2)
    .max(8)
    .optional()
    .describe("required for linear-gradient"),
});

export const UpdateLabelGeometryInput = z.strictObject({
  widthMm: z.number().min(5).max(500).optional(),
  heightMm: z.number().min(5).max(500).optional(),
  bleedMm: z.number().min(0).max(10).optional(),
  safeMm: z.number().min(0).max(10).optional(),
  cornerRadiusMm: z.number().min(0).max(50).optional(),
});

export const SelectObjectsInput = z.strictObject({
  ids: z.array(z.string().min(1)).max(50).describe("empty array clears the selection"),
});

// --- Registry ---------------------------------------------------------------

export interface AssistantToolDef {
  name: string;
  description: string;
  /** Executor-side validation; also the source of the wire input_schema. */
  schema: z.ZodType;
  /** Mutating tools open the turn's single undo gesture on first use. */
  mutating: boolean;
}

export const ASSISTANT_TOOLS: readonly AssistantToolDef[] = [
  {
    name: "get_document_state",
    description:
      "Read the current label document: geometry, background, and every object " +
      "with its id, position, and size. The same summary rides along with each " +
      "user message — call this only after your own edits when you need fresh ids " +
      "or recomputed sizes.",
    schema: GetDocumentStateInput,
    mutating: false,
  },
  {
    name: "add_text_object",
    description:
      "Add a text object. Position defaults to the label center; height is " +
      "measured from the font metrics automatically. Returns the new object's id " +
      "and final box.",
    schema: AddTextObjectInput,
    mutating: true,
  },
  {
    name: "add_shape_object",
    description:
      "Add a rectangle, ellipse, line, polygon, or star. Position defaults to " +
      "the label center. Returns the new object's id.",
    schema: AddShapeObjectInput,
    mutating: true,
  },
  {
    name: "add_qr_object",
    description:
      "Add a QR code encoding the given value (validated before insertion). " +
      "Returns the new object's id and the printed module size.",
    schema: AddQrObjectInput,
    mutating: true,
  },
  {
    name: "add_barcode_object",
    description:
      "Add a barcode. The value is validated for the symbology first (EAN-13/UPC-A " +
      "check digits are appended when omitted). Returns the new object's id.",
    schema: AddBarcodeObjectInput,
    mutating: true,
  },
  {
    name: "update_object",
    description:
      "Change fields on one existing object (shallow merge). Text metric changes " +
      "re-measure the text height automatically. Rejects unknown fields with the " +
      "valid field list.",
    schema: UpdateObjectInput,
    mutating: true,
  },
  {
    name: "remove_objects",
    description: "Delete objects by id (any depth; deleting a group deletes its children).",
    schema: RemoveObjectsInput,
    mutating: true,
  },
  {
    name: "duplicate_objects",
    description: "Duplicate top-level objects; returns the new ids.",
    schema: DuplicateObjectsInput,
    mutating: true,
  },
  {
    name: "align_objects",
    description:
      "Align objects to an edge or center line. One object aligns to the label; " +
      "multiple objects align within their combined bounding box.",
    schema: AlignObjectsInput,
    mutating: true,
  },
  {
    name: "distribute_objects",
    description: "Evenly space three or more objects between the outermost two.",
    schema: DistributeObjectsInput,
    mutating: true,
  },
  {
    name: "reorder_objects",
    description:
      "Change z-order of top-level objects: front/back jump to the extreme; " +
      "forward/backward move one step.",
    schema: ReorderObjectsInput,
    mutating: true,
  },
  {
    name: "group_objects",
    description: "Group two or more top-level objects; returns the group id.",
    schema: GroupObjectsInput,
    mutating: true,
  },
  {
    name: "ungroup_objects",
    description: "Dissolve groups, releasing children in place.",
    schema: UngroupObjectsInput,
    mutating: true,
  },
  {
    name: "set_background",
    description:
      "Set the label background: none (transparent — the substrate shows), a " +
      "solid color, or a linear gradient. Simulated finish backgrounds (foil, " +
      "holographic…) can only be chosen in the UI's background picker.",
    schema: SetBackgroundInput,
    mutating: true,
  },
  {
    name: "update_label_geometry",
    description:
      "Resize the label or adjust bleed/safe margins/corner radius (mm). " +
      "Existing objects keep their coordinates — offer to realign them afterwards. " +
      "Vial dimensions and label style are physical choices the user makes in the UI.",
    schema: UpdateLabelGeometryInput,
    mutating: true,
  },
  {
    name: "select_objects",
    description:
      "Highlight objects in the editor so the user sees what you mean. Purely " +
      "visual — no document change, no undo entry.",
    schema: SelectObjectsInput,
    mutating: false,
  },
] as const;

export const ASSISTANT_TOOL_NAMES = ASSISTANT_TOOLS.map((t) => t.name);

export function getAssistantTool(name: string): AssistantToolDef | undefined {
  return ASSISTANT_TOOLS.find((t) => t.name === name);
}

// --- Wire definitions (server → API) ---------------------------------------

export interface AssistantToolWireDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/** JSON-schema tool defs for the Messages API (deterministic order — cache-stable). */
export function assistantToolWireDefs(): AssistantToolWireDef[] {
  return ASSISTANT_TOOLS.map((tool) => {
    const json = z.toJSONSchema(tool.schema) as Record<string, unknown>;
    delete json.$schema;
    return { name: tool.name, description: tool.description, input_schema: json };
  });
}
