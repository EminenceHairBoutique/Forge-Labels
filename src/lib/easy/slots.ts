/**
 * Semantic slots — the vocabulary shared by Easy templates, the content
 * form, and the layout engine. A slot id is stored on generated objects
 * (`obj.slot`, schema v2) so the form can find and update "the product
 * name" without the user ever touching a canvas object.
 */

export type SlotId =
  | "logo"
  | "brand"
  | "product-name"
  | "subtitle"
  | "strength"
  | "volume"
  | "description"
  | "ingredients"
  | "directions"
  | "storage"
  | "warning"
  | "lot"
  | "expiry"
  | "website"
  | "qr"
  | "barcode";

export interface SlotInfo {
  id: SlotId;
  /** Form label, beginner wording. */
  label: string;
  placeholder: string;
  kind: "line" | "multiline" | "qr" | "barcode" | "logo";
  /** Optional slots get a visible on/off toggle in the form. */
  optional: boolean;
  /** Whether the toggle starts on for a fresh document. */
  defaultOn: boolean;
  maxChars: number;
  /** Short helper copy under the field (plain language only). */
  hint?: string;
}

export const SLOTS: Record<SlotId, SlotInfo> = {
  logo: {
    id: "logo",
    label: "Logo",
    placeholder: "",
    kind: "logo",
    optional: true,
    defaultOn: false,
    maxChars: 0,
  },
  brand: {
    id: "brand",
    label: "Brand name",
    placeholder: "e.g. AURELIS LABS",
    kind: "line",
    optional: false,
    defaultOn: true,
    maxChars: 40,
  },
  "product-name": {
    id: "product-name",
    label: "Product name",
    placeholder: "e.g. Retinol Serum",
    kind: "line",
    optional: false,
    defaultOn: true,
    maxChars: 60,
  },
  subtitle: {
    id: "subtitle",
    label: "Short subtitle",
    placeholder: "e.g. Overnight renewal complex",
    kind: "line",
    optional: true,
    defaultOn: false,
    maxChars: 80,
  },
  strength: {
    id: "strength",
    label: "Amount or strength",
    placeholder: "e.g. 0.5% · 10 mg",
    kind: "line",
    optional: true,
    defaultOn: true,
    maxChars: 30,
  },
  volume: {
    id: "volume",
    label: "Net volume",
    placeholder: "e.g. 10 mL / 0.34 fl oz",
    kind: "line",
    optional: true,
    defaultOn: true,
    maxChars: 30,
  },
  description: {
    id: "description",
    label: "Description",
    placeholder: "One or two short sentences about the product",
    kind: "multiline",
    optional: true,
    defaultOn: false,
    maxChars: 220,
  },
  ingredients: {
    id: "ingredients",
    label: "Ingredients",
    placeholder: "e.g. Aqua, Glycerin, Retinol…",
    kind: "multiline",
    optional: true,
    defaultOn: false,
    maxChars: 400,
  },
  directions: {
    id: "directions",
    label: "Directions",
    placeholder: "e.g. Apply 2–3 drops nightly",
    kind: "multiline",
    optional: true,
    defaultOn: false,
    maxChars: 240,
  },
  storage: {
    id: "storage",
    label: "Storage instructions",
    placeholder: "e.g. Store below 25 °C away from light",
    kind: "line",
    optional: true,
    defaultOn: false,
    maxChars: 120,
  },
  warning: {
    id: "warning",
    label: "Warning text",
    placeholder: "e.g. External use only. Keep out of reach of children.",
    kind: "multiline",
    optional: true,
    defaultOn: false,
    maxChars: 240,
  },
  lot: {
    id: "lot",
    label: "Lot number",
    placeholder: "e.g. LOT 2401-A",
    kind: "line",
    optional: true,
    defaultOn: false,
    maxChars: 30,
    hint: "In Batch export, {{lot}} can fill this from a spreadsheet.",
  },
  expiry: {
    id: "expiry",
    label: "Expiration date",
    placeholder: "e.g. EXP 06/2027",
    kind: "line",
    optional: true,
    defaultOn: false,
    maxChars: 30,
  },
  website: {
    id: "website",
    label: "Website",
    placeholder: "e.g. aurelislabs.example",
    kind: "line",
    optional: true,
    defaultOn: false,
    maxChars: 60,
  },
  qr: {
    id: "qr",
    label: "QR code",
    placeholder: "https://…",
    kind: "qr",
    optional: true,
    defaultOn: false,
    maxChars: 500,
    hint: "Where should the code send people? Usually your website.",
  },
  barcode: {
    id: "barcode",
    label: "Barcode",
    placeholder: "e.g. LOT-0001",
    kind: "barcode",
    optional: true,
    defaultOn: false,
    maxChars: 60,
  },
};

/** Form display order (top → bottom). */
export const SLOT_ORDER: readonly SlotId[] = [
  "brand",
  "product-name",
  "subtitle",
  "strength",
  "volume",
  "description",
  "ingredients",
  "directions",
  "storage",
  "warning",
  "lot",
  "expiry",
  "website",
  "qr",
  "barcode",
];

/** Text-bearing slots (everything the form edits as a string). */
export const TEXT_SLOTS: readonly SlotId[] = SLOT_ORDER.filter(
  (id) => SLOTS[id].kind === "line" || SLOTS[id].kind === "multiline",
);

export function isSlotId(value: string): value is SlotId {
  return value in SLOTS;
}
