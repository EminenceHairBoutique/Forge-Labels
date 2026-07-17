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
  | "abbreviation"
  | "subtitle"
  | "strength"
  | "volume"
  | "purity"
  | "formula"
  | "molecular-weight"
  | "cas"
  | "sequence"
  | "description"
  | "ingredients"
  | "directions"
  | "storage"
  | "warning"
  | "notice"
  | "catalog"
  | "sku"
  | "lot"
  | "batch"
  | "produced"
  | "retest"
  | "expiry"
  | "website"
  | "contact"
  | "verification"
  | "coa"
  | "qr"
  | "barcode";

/** Form sections — the content form groups fields by these. */
export type SlotSection =
  | "identity"
  | "science"
  | "details"
  | "compliance"
  | "batch"
  | "links"
  | "codes";

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
  /** Content-form group (defaults to "identity"). */
  section?: SlotSection;
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
  abbreviation: {
    id: "abbreviation",
    label: "Short name / abbreviation",
    placeholder: "e.g. RC-7",
    kind: "line",
    optional: true,
    defaultOn: false,
    maxChars: 16,
    hint: "A compact display name some layouts feature prominently.",
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
  purity: {
    id: "purity",
    label: "Purity (from your documentation)",
    placeholder: "e.g. ≥ 99% (HPLC)",
    kind: "line",
    optional: true,
    defaultOn: false,
    maxChars: 40,
    section: "science",
    hint: "Printed exactly as you enter it. Only state a purity your own testing documentation supports — Forge Labels cannot verify it.",
  },
  formula: {
    id: "formula",
    label: "Molecular formula",
    placeholder: "From your supplier's documentation",
    kind: "line",
    optional: true,
    defaultOn: false,
    maxChars: 40,
    section: "science",
  },
  "molecular-weight": {
    id: "molecular-weight",
    label: "Molecular weight",
    placeholder: "e.g. 000.0 g/mol",
    kind: "line",
    optional: true,
    defaultOn: false,
    maxChars: 30,
    section: "science",
  },
  cas: {
    id: "cas",
    label: "CAS number",
    placeholder: "e.g. 0000-00-0",
    kind: "line",
    optional: true,
    defaultOn: false,
    maxChars: 20,
    section: "science",
    hint: "Copy it from your supplier's documentation — never guess a CAS number.",
  },
  sequence: {
    id: "sequence",
    label: "Sequence",
    placeholder: "Exactly as supplied in your documentation",
    kind: "multiline",
    optional: true,
    defaultOn: false,
    maxChars: 240,
    section: "science",
    hint: "Long sequences may not fit on small labels — the layout will say so honestly.",
  },
  description: {
    id: "description",
    label: "Description",
    placeholder: "One or two short sentences about the product",
    kind: "multiline",
    optional: true,
    defaultOn: false,
    maxChars: 220,
    section: "details",
  },
  ingredients: {
    id: "ingredients",
    label: "Ingredients",
    placeholder: "e.g. Aqua, Glycerin, Retinol…",
    kind: "multiline",
    optional: true,
    defaultOn: false,
    maxChars: 400,
    section: "details",
  },
  directions: {
    id: "directions",
    label: "Directions",
    placeholder: "e.g. Apply 2–3 drops nightly",
    kind: "multiline",
    optional: true,
    defaultOn: false,
    maxChars: 240,
    section: "details",
  },
  storage: {
    id: "storage",
    label: "Storage instructions",
    placeholder: "e.g. Store below 25 °C away from light",
    kind: "line",
    optional: true,
    defaultOn: false,
    maxChars: 120,
    section: "details",
  },
  warning: {
    id: "warning",
    label: "Warning text",
    placeholder: "e.g. External use only. Keep out of reach of children.",
    kind: "multiline",
    optional: true,
    defaultOn: false,
    maxChars: 240,
    section: "details",
  },
  notice: {
    id: "notice",
    label: "Research-use notice",
    placeholder: "e.g. FOR RESEARCH USE ONLY",
    kind: "line",
    optional: true,
    defaultOn: false,
    maxChars: 90,
    section: "compliance",
    hint: "Pick a standard notice or write your own. You'll review it before export — a notice alone doesn't establish a product's lawful use.",
  },
  catalog: {
    id: "catalog",
    label: "Catalog number",
    placeholder: "e.g. CAT-2101",
    kind: "line",
    optional: true,
    defaultOn: false,
    maxChars: 30,
    section: "batch",
  },
  sku: {
    id: "sku",
    label: "SKU",
    placeholder: "e.g. SKU 10442",
    kind: "line",
    optional: true,
    defaultOn: false,
    maxChars: 30,
    section: "batch",
  },
  lot: {
    id: "lot",
    label: "Lot number",
    placeholder: "e.g. LOT 2401-A",
    kind: "line",
    optional: true,
    defaultOn: false,
    maxChars: 30,
    section: "batch",
    hint: "In Batch export, {{lot}} can fill this from a spreadsheet.",
  },
  batch: {
    id: "batch",
    label: "Batch number",
    placeholder: "e.g. BATCH 24-118",
    kind: "line",
    optional: true,
    defaultOn: false,
    maxChars: 30,
    section: "batch",
  },
  produced: {
    id: "produced",
    label: "Date produced",
    placeholder: "e.g. MFG 01/2026",
    kind: "line",
    optional: true,
    defaultOn: false,
    maxChars: 30,
    section: "batch",
  },
  retest: {
    id: "retest",
    label: "Retest date",
    placeholder: "e.g. RETEST 01/2027",
    kind: "line",
    optional: true,
    defaultOn: false,
    maxChars: 30,
    section: "batch",
  },
  expiry: {
    id: "expiry",
    label: "Expiration date",
    placeholder: "e.g. EXP 06/2027",
    kind: "line",
    optional: true,
    defaultOn: false,
    maxChars: 30,
    section: "batch",
  },
  website: {
    id: "website",
    label: "Website",
    placeholder: "e.g. aurelislabs.example",
    kind: "line",
    optional: true,
    defaultOn: false,
    maxChars: 60,
    section: "links",
  },
  contact: {
    id: "contact",
    label: "Company contact",
    placeholder: "e.g. support@aurelislabs.example",
    kind: "line",
    optional: true,
    defaultOn: false,
    maxChars: 80,
    section: "links",
  },
  verification: {
    id: "verification",
    label: "Verification code",
    placeholder: "e.g. VERIFY X7K2-99B1",
    kind: "line",
    optional: true,
    defaultOn: false,
    maxChars: 40,
    section: "links",
    hint: "A short code customers can check on your site — pairs well with a QR code.",
  },
  coa: {
    id: "coa",
    label: "COA reference",
    placeholder: "e.g. COA 24-118",
    kind: "line",
    optional: true,
    defaultOn: false,
    maxChars: 60,
    section: "links",
    hint: "A document number or short link for the batch's certificate of analysis. Point the QR code at the document itself.",
  },
  qr: {
    id: "qr",
    label: "QR code",
    placeholder: "https://…",
    kind: "qr",
    optional: true,
    defaultOn: false,
    maxChars: 500,
    section: "codes",
    hint: "Where should the code send people? Your website, a verification page, or a batch COA.",
  },
  barcode: {
    id: "barcode",
    label: "Barcode",
    placeholder: "e.g. LOT-0001",
    kind: "barcode",
    optional: true,
    defaultOn: false,
    maxChars: 60,
    section: "codes",
  },
};

/** Form display order (top → bottom, grouped by section). */
export const SLOT_ORDER: readonly SlotId[] = [
  // identity
  "brand",
  "product-name",
  "abbreviation",
  "subtitle",
  "strength",
  "volume",
  // science data (user-supplied, unverified)
  "purity",
  "formula",
  "molecular-weight",
  "cas",
  "sequence",
  // details
  "description",
  "ingredients",
  "directions",
  "storage",
  "warning",
  // compliance
  "notice",
  // catalog & batch
  "catalog",
  "sku",
  "lot",
  "batch",
  "produced",
  "retest",
  "expiry",
  // links
  "website",
  "contact",
  "verification",
  "coa",
  // codes
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
