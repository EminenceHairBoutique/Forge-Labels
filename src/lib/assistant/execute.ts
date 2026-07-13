"use client";

import { z } from "zod";
import {
  addObject,
  duplicateObjects,
  findObject,
  removeObjects,
  reorderObjects,
  setBackground,
  updateLabelGeometry,
  updateObject,
} from "@/lib/document/commands";
import {
  alignObjects,
  distributeObjects,
  groupObjects,
  ungroupObjects,
} from "@/lib/document/structure-commands";
import {
  createBarcodeObject,
  createQrObject,
  createShapeObject,
  createTextObject,
} from "@/lib/document/defaults";
import {
  BarcodeObjectSchema,
  EllipseObjectSchema,
  ImageObjectSchema,
  LineObjectSchema,
  PolygonObjectSchema,
  QrObjectSchema,
  RectObjectSchema,
  StarObjectSchema,
  TextObjectSchema,
  type Background,
  type BarcodeObject,
  type LabelDocument,
  type LabelObject,
  type QrObject,
  type TextObject,
} from "@/lib/document/schema";
import { createQrMatrix, MIN_QR_MODULE_MM, qrModuleSizeMm } from "@/lib/codes/qr";
import { validateBarcodeValue } from "@/lib/codes/validate";
import { getFontFamily, loadFont, resolveWeight } from "@/lib/fonts/registry";
import { measureTextHeightMm } from "@/lib/render/text-measure";
import { useDocumentStore } from "@/stores/document-store";
import { useEditorUiStore } from "@/stores/editor-ui-store";
import { summarizeDocument } from "./summarize";
import {
  getAssistantTool,
  type AddBarcodeObjectInput,
  type AddQrObjectInput,
  type AddShapeObjectInput,
  type AddTextObjectInput,
  type AlignObjectsInput,
  type DistributeObjectsInput,
  type GroupObjectsInput,
  type RemoveObjectsInput,
  type ReorderObjectsInput,
  type SelectObjectsInput,
  type SetBackgroundInput,
  type UngroupObjectsInput,
  type UpdateLabelGeometryInput,
  type UpdateObjectInput,
} from "./tools";

/**
 * Client-side execution of assistant tools. Every mutation goes through the
 * command bus, inside the turn-level gesture the executor opens — so a whole
 * assistant turn is ONE undo entry, like any other edit.
 *
 * Failures throw AssistantToolError with a directive message; the executor
 * feeds it back as an is_error tool_result so the model can self-correct.
 */

export class AssistantToolError extends Error {}

function fail(message: string): never {
  throw new AssistantToolError(message);
}

function requireDoc(): LabelDocument {
  const { doc } = useDocumentStore.getState();
  if (!doc) fail("No document is open in the editor.");
  return doc;
}

function mm(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function box(obj: LabelObject): string {
  return `at (${mm(obj.xMm)}, ${mm(obj.yMm)}), ${mm(obj.widthMm)}×${mm(obj.heightMm)}mm`;
}

function requireIds(doc: LabelDocument, ids: readonly string[]): void {
  const missing = ids.filter((id) => !findObject(doc, id));
  if (missing.length > 0) {
    fail(
      `No object with id ${missing.map((m) => `"${m}"`).join(", ")} — call get_document_state for current ids.`,
    );
  }
}

function requireTopLevel(doc: LabelDocument, ids: readonly string[], tool: string): void {
  const top = new Set(doc.objects.map((o) => o.id));
  const nested = ids.filter((id) => !top.has(id));
  if (nested.length > 0) {
    fail(
      `${tool} works on top-level objects; ${nested.map((n) => `"${n}"`).join(", ")} ${nested.length === 1 ? "is" : "are"} nested inside a group (ungroup first).`,
    );
  }
}

// --- update_object validation ----------------------------------------------

// Group boxes are derived from their children — no raw w/h patching.
const GROUP_PATCH_KEYS = {
  name: true,
  xMm: true,
  yMm: true,
  rotationDeg: true,
  opacity: true,
  locked: true,
  visible: true,
  printLayer: true,
} as const;

const PATCH_SCHEMAS: Record<LabelObject["type"], z.ZodObject> = {
  text: TextObjectSchema.omit({ id: true, type: true, heightMm: true }).partial(),
  rect: RectObjectSchema.omit({ id: true, type: true }).partial(),
  ellipse: EllipseObjectSchema.omit({ id: true, type: true }).partial(),
  line: LineObjectSchema.omit({ id: true, type: true }).partial(),
  polygon: PolygonObjectSchema.omit({ id: true, type: true }).partial(),
  star: StarObjectSchema.omit({ id: true, type: true }).partial(),
  image: ImageObjectSchema.omit({ id: true, type: true, source: true }).partial(),
  qrcode: QrObjectSchema.omit({ id: true, type: true }).partial(),
  barcode: BarcodeObjectSchema.omit({ id: true, type: true }).partial(),
  group: TextObjectSchema.pick(GROUP_PATCH_KEYS).partial(),
};

/** Numeric rails on top of the document schema (which is unbounded). */
const NUMERIC_CLAMPS: Record<string, readonly [number, number]> = {
  xMm: [-500, 500],
  yMm: [-500, 500],
  widthMm: [0.1, 1000],
  heightMm: [0.1, 1000],
  rotationDeg: [-360, 360],
  fontSizePt: [2, 200],
  cornerRadiusMm: [0, 100],
  strokePt: [0.1, 50],
};

function checkClamps(patch: Record<string, unknown>): void {
  for (const [key, [min, max]] of Object.entries(NUMERIC_CLAMPS)) {
    const value = patch[key];
    if (typeof value === "number" && (value < min || value > max)) {
      fail(`${key} must be between ${min} and ${max} (got ${value}).`);
    }
  }
}

function formatZodError(error: z.ZodError): string {
  return error.issues
    .slice(0, 4)
    .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
    .join("; ");
}

/** Text fields whose change invalidates the measured heightMm. */
const TEXT_METRIC_KEYS = new Set([
  "text",
  "fontFamilyId",
  "fontWeight",
  "fontSizePt",
  "lineHeight",
  "letterSpacingEm",
  "widthMm",
  "textTransform",
  "autoFit",
  "curve",
]);

function requireFontFamily(fontFamilyId: string): void {
  if (!getFontFamily(fontFamilyId)) {
    fail(
      `Unknown font "${fontFamilyId}" — the add_text_object tool description lists the bundled font ids.`,
    );
  }
}

async function handleUpdateObject(input: z.infer<typeof UpdateObjectInput>): Promise<string> {
  const doc = requireDoc();
  const target = findObject(doc, input.id);
  if (!target) {
    fail(`No object with id "${input.id}" — call get_document_state for current ids.`);
  }

  const keys = Object.keys(input.patch);
  if (keys.length === 0) fail("The patch is empty — include at least one field.");

  const schema = PATCH_SCHEMAS[target.type];
  for (const key of keys) {
    if (key === "id" || key === "type") fail(`"${key}" can't be changed.`);
    if (target.type === "text" && key === "heightMm") {
      fail(
        "heightMm on text is derived from the metrics — change fontSizePt, lineHeight, or widthMm instead.",
      );
    }
    if (target.type === "group" && key === "children") {
      fail("Group children can't be patched directly — update the child objects by id.");
    }
    if (target.type === "group" && (key === "widthMm" || key === "heightMm")) {
      fail("Group boxes are derived from their children — resize the child objects instead.");
    }
    if (target.type === "image" && key === "source") {
      fail("Image sources come from uploads — the user swaps images in the UI.");
    }
    if (target.type === "qrcode" && key === "logo") {
      fail("QR logos need an uploaded image — the user adds them in the UI.");
    }
    if (!(key in schema.shape)) {
      fail(
        `Unknown field "${key}" for ${target.type} objects. Valid fields: ${Object.keys(schema.shape).join(", ")}.`,
      );
    }
  }
  checkClamps(input.patch);

  const parsed = schema.safeParse(input.patch);
  if (!parsed.success) fail(formatZodError(parsed.error));
  const patch = parsed.data as Record<string, unknown>;

  const fill = patch.fill as { type?: string } | undefined;
  if (fill?.type === "finish") {
    fail("Simulated finish fills (foil, holographic…) are chosen in the UI's fill picker.");
  }

  // Payload-bearing objects: validate the new payload before applying.
  if (target.type === "qrcode") {
    const next = { ...target, ...patch } as QrObject;
    try {
      createQrMatrix(next.value, next.ecLevel);
    } catch {
      fail("That value can't be encoded as a QR code — shorten it or lower ecLevel.");
    }
  }
  if (target.type === "barcode") {
    const next = { ...target, ...patch } as BarcodeObject;
    const validation = validateBarcodeValue(next.symbology, next.value);
    if (!validation.ok) fail(`Invalid ${next.symbology} value: ${validation.message}`);
    if (validation.normalized && validation.normalized !== next.value) {
      patch.value = validation.normalized;
    }
  }

  if (target.type === "text") {
    if (typeof patch.fontFamilyId === "string") requireFontFamily(patch.fontFamilyId);
    if (typeof patch.fontWeight === "number") {
      patch.fontWeight = resolveWeight(
        (patch.fontFamilyId as string | undefined) ?? target.fontFamilyId,
        patch.fontWeight,
      );
    }
    if (keys.some((key) => TEXT_METRIC_KEYS.has(key))) {
      const next = { ...target, ...patch } as TextObject;
      await loadFont(next.fontFamilyId, next.fontWeight).catch(() => {});
      patch.heightMm = measureTextHeightMm(next);
    }
  }

  updateObject(input.id, patch as Partial<LabelObject>);
  const updated = findObject(requireDoc(), input.id)!;
  return `Updated ${target.type} ${input.id} (${keys.join(", ")}); now ${box(updated)}.`;
}

// --- Handlers ----------------------------------------------------------------

async function handleAddText(input: z.infer<typeof AddTextObjectInput>): Promise<string> {
  const doc = requireDoc();
  if (input.fontFamilyId) requireFontFamily(input.fontFamilyId);
  const fontFamilyId = input.fontFamilyId ?? "inter";
  const overrides: Partial<TextObject> = {
    text: input.text,
    fontFamilyId,
    fontWeight: resolveWeight(
      fontFamilyId,
      input.fontWeight ?? 400,
    ) as TextObject["fontWeight"],
  };
  if (input.xMm !== undefined) overrides.xMm = input.xMm;
  if (input.yMm !== undefined) overrides.yMm = input.yMm;
  if (input.widthMm !== undefined) overrides.widthMm = input.widthMm;
  if (input.fontSizePt !== undefined) overrides.fontSizePt = input.fontSizePt;
  if (input.align) overrides.align = input.align;
  if (input.rotationDeg !== undefined) overrides.rotationDeg = input.rotationDeg;
  if (input.colorHex) overrides.fill = { type: "solid", color: input.colorHex };
  if (input.name) overrides.name = input.name;

  const obj = createTextObject(doc, overrides);
  await loadFont(obj.fontFamilyId, obj.fontWeight).catch(() => {});
  obj.heightMm = measureTextHeightMm(obj);
  addObject(obj);
  return `Added text ${obj.id} ${box(obj)}.`;
}

function handleAddShape(input: z.infer<typeof AddShapeObjectInput>): string {
  const doc = requireDoc();
  const overrides: Record<string, unknown> = {};
  if (input.xMm !== undefined) overrides.xMm = input.xMm;
  if (input.yMm !== undefined) overrides.yMm = input.yMm;
  if (input.widthMm !== undefined) overrides.widthMm = input.widthMm;
  if (input.heightMm !== undefined) overrides.heightMm = input.heightMm;
  if (input.rotationDeg !== undefined) overrides.rotationDeg = input.rotationDeg;
  if (input.name) overrides.name = input.name;

  if (input.shape === "line") {
    const color = input.strokeColorHex ?? input.fillColorHex;
    if (color) overrides.color = color;
    if (input.strokeWidthPt !== undefined) overrides.strokePt = input.strokeWidthPt;
  } else {
    if (input.fillColorHex) overrides.fill = { type: "solid", color: input.fillColorHex };
    if (input.strokeColorHex) {
      overrides.stroke = { color: input.strokeColorHex, widthPt: input.strokeWidthPt ?? 1 };
    }
    if (input.shape === "rect" && input.cornerRadiusMm !== undefined) {
      overrides.cornerRadiusMm = input.cornerRadiusMm;
    }
    if (input.shape === "polygon" && input.sides !== undefined) overrides.sides = input.sides;
    if (input.shape === "star") {
      if (input.points !== undefined) overrides.points = input.points;
      if (input.innerRatio !== undefined) overrides.innerRatio = input.innerRatio;
    }
  }

  const obj = createShapeObject(doc, input.shape, overrides);
  addObject(obj);
  return `Added ${input.shape} ${obj.id} ${box(obj)}.`;
}

function handleAddQr(input: z.infer<typeof AddQrObjectInput>): string {
  const doc = requireDoc();
  const ecLevel = input.ecLevel ?? "M";
  try {
    createQrMatrix(input.value, ecLevel);
  } catch {
    fail("That value can't be encoded as a QR code — shorten it or lower ecLevel.");
  }
  const overrides: Partial<QrObject> = { value: input.value, ecLevel };
  if (input.xMm !== undefined) overrides.xMm = input.xMm;
  if (input.yMm !== undefined) overrides.yMm = input.yMm;
  if (input.sizeMm !== undefined) {
    overrides.widthMm = input.sizeMm;
    overrides.heightMm = input.sizeMm;
  }
  if (input.fgColorHex) overrides.fgColor = input.fgColorHex;
  if (input.name) overrides.name = input.name;

  const obj = createQrObject(doc, overrides);
  addObject(obj);
  const moduleMm = qrModuleSizeMm(obj);
  const scanNote =
    moduleMm < MIN_QR_MODULE_MM
      ? ` WARNING: modules are ${moduleMm.toFixed(2)}mm — below the ${MIN_QR_MODULE_MM}mm scannability floor; enlarge the code.`
      : "";
  return `Added QR code ${obj.id} ${box(obj)} (module ${moduleMm.toFixed(2)}mm).${scanNote}`;
}

function handleAddBarcode(input: z.infer<typeof AddBarcodeObjectInput>): string {
  const doc = requireDoc();
  const validation = validateBarcodeValue(input.symbology, input.value);
  if (!validation.ok) fail(`Invalid ${input.symbology} value: ${validation.message}`);
  const overrides: Partial<BarcodeObject> = {
    symbology: input.symbology,
    value: validation.normalized ?? input.value,
  };
  if (input.xMm !== undefined) overrides.xMm = input.xMm;
  if (input.yMm !== undefined) overrides.yMm = input.yMm;
  if (input.widthMm !== undefined) overrides.widthMm = input.widthMm;
  if (input.heightMm !== undefined) overrides.heightMm = input.heightMm;
  if (input.showText !== undefined) overrides.showText = input.showText;
  if (input.name) overrides.name = input.name;

  const obj = createBarcodeObject(doc, overrides);
  addObject(obj);
  const normalizedNote =
    overrides.value !== input.value ? ` (check digit appended: ${overrides.value})` : "";
  return `Added ${input.symbology} barcode ${obj.id} ${box(obj)}${normalizedNote}.`;
}

function positionsAfter(ids: readonly string[]): string {
  const doc = requireDoc();
  const shown = ids.slice(0, 10).map((id) => {
    const obj = findObject(doc, id);
    return obj ? `${id}→(${mm(obj.xMm)}, ${mm(obj.yMm)})` : id;
  });
  return shown.join(", ") + (ids.length > 10 ? `, +${ids.length - 10} more` : "");
}

const HANDLERS: Record<string, (input: never) => string | Promise<string>> = {
  get_document_state: () => {
    const doc = requireDoc();
    return summarizeDocument(doc, useEditorUiStore.getState().selection);
  },
  add_text_object: handleAddText,
  add_shape_object: handleAddShape,
  add_qr_object: handleAddQr,
  add_barcode_object: handleAddBarcode,
  update_object: handleUpdateObject,
  remove_objects: (input: z.infer<typeof RemoveObjectsInput>) => {
    requireIds(requireDoc(), input.ids);
    removeObjects(input.ids);
    return `Removed ${input.ids.length} object${input.ids.length === 1 ? "" : "s"}.`;
  },
  duplicate_objects: (input: z.infer<typeof RemoveObjectsInput>) => {
    const doc = requireDoc();
    requireIds(doc, input.ids);
    requireTopLevel(doc, input.ids, "duplicate_objects");
    const newIds = duplicateObjects(input.ids);
    return `Duplicated ${newIds.length} object${newIds.length === 1 ? "" : "s"}: ${newIds.join(", ")} (offset 2mm).`;
  },
  align_objects: (input: z.infer<typeof AlignObjectsInput>) => {
    const doc = requireDoc();
    requireIds(doc, input.ids);
    requireTopLevel(doc, input.ids, "align_objects");
    const movable = input.ids.filter((id) => !findObject(doc, id)?.locked);
    if (movable.length === 0) fail("All of those objects are locked.");
    alignObjects(input.ids, input.edge);
    return `Aligned ${movable.length} to ${input.edge}: ${positionsAfter(movable)}.`;
  },
  distribute_objects: (input: z.infer<typeof DistributeObjectsInput>) => {
    const doc = requireDoc();
    requireIds(doc, input.ids);
    requireTopLevel(doc, input.ids, "distribute_objects");
    const movable = input.ids.filter((id) => !findObject(doc, id)?.locked);
    if (movable.length < 3) {
      fail("distribute_objects needs at least 3 unlocked objects.");
    }
    distributeObjects(input.ids, input.axis);
    const adverb = input.axis === "horizontal" ? "horizontally" : "vertically";
    return `Distributed ${movable.length} ${adverb}: ${positionsAfter(movable)}.`;
  },
  reorder_objects: (input: z.infer<typeof ReorderObjectsInput>) => {
    const doc = requireDoc();
    requireIds(doc, input.ids);
    requireTopLevel(doc, input.ids, "reorder_objects");
    reorderObjects(input.ids, input.direction);
    return `Moved ${input.ids.length} object${input.ids.length === 1 ? "" : "s"} ${input.direction === "front" || input.direction === "forward" ? "toward the front" : "toward the back"}.`;
  },
  group_objects: (input: z.infer<typeof GroupObjectsInput>) => {
    const doc = requireDoc();
    requireIds(doc, input.ids);
    requireTopLevel(doc, input.ids, "group_objects");
    const groupId = groupObjects(input.ids);
    if (!groupId) fail("Grouping failed — it needs at least 2 top-level objects.");
    const group = findObject(requireDoc(), groupId)!;
    return `Grouped ${input.ids.length} objects into ${groupId} ${box(group)}.`;
  },
  ungroup_objects: (input: z.infer<typeof UngroupObjectsInput>) => {
    const doc = requireDoc();
    requireIds(doc, input.ids);
    const notGroups = input.ids.filter((id) => findObject(doc, id)?.type !== "group");
    if (notGroups.length > 0) {
      fail(`${notGroups.map((n) => `"${n}"`).join(", ")} ${notGroups.length === 1 ? "is not a group" : "are not groups"}.`);
    }
    requireTopLevel(doc, input.ids, "ungroup_objects");
    ungroupObjects(input.ids);
    return `Ungrouped ${input.ids.length} group${input.ids.length === 1 ? "" : "s"}; children released in place.`;
  },
  set_background: (input: z.infer<typeof SetBackgroundInput>) => {
    requireDoc();
    let background: Background;
    if (input.type === "none") {
      background = { type: "none" };
    } else if (input.type === "solid") {
      if (!input.color) fail('set_background type "solid" requires a color.');
      background = { type: "solid", color: input.color };
    } else {
      if (!input.stops) fail('set_background type "linear-gradient" requires stops.');
      background = {
        type: "linear-gradient",
        angleDeg: input.angleDeg ?? 0,
        stops: input.stops,
      };
    }
    setBackground(background);
    return `Background set to ${input.type}.`;
  },
  update_label_geometry: (input: z.infer<typeof UpdateLabelGeometryInput>) => {
    requireDoc();
    const patch = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(patch).length === 0) {
      fail("Provide at least one geometry field to change.");
    }
    updateLabelGeometry(patch);
    const label = requireDoc().label;
    return `Label is now ${mm(label.widthMm)}×${mm(label.heightMm)}mm (bleed ${mm(label.bleedMm)}, safe ${mm(label.safeMm)}, corner ${mm(label.cornerRadiusMm)}).`;
  },
  select_objects: (input: z.infer<typeof SelectObjectsInput>) => {
    const doc = requireDoc();
    if (input.ids.length > 0) requireIds(doc, input.ids);
    useEditorUiStore.getState().setSelection([...input.ids]);
    return input.ids.length === 0
      ? "Selection cleared."
      : `Selected ${input.ids.length} object${input.ids.length === 1 ? "" : "s"}.`;
  },
};

/**
 * Validate and run one tool call. Returns the tool_result content string;
 * throws AssistantToolError with a model-directive message on any failure.
 */
export async function executeAssistantTool(
  name: string,
  rawInput: unknown,
): Promise<string> {
  const def = getAssistantTool(name);
  const handler = HANDLERS[name];
  if (!def || !handler) fail(`Unknown tool "${name}".`);
  const parsed = def.schema.safeParse(rawInput ?? {});
  if (!parsed.success) fail(formatZodError(parsed.error));
  return handler(parsed.data as never);
}
