import type { LabelDocument } from "@/lib/document/schema";
import type { PreflightIssue } from "@/lib/preflight/rules";
import { getMaterial } from "./materials";
import type { EasyChange } from "./meta";

/**
 * §10/§17 — the plain-language preflight layer. Every technical ruleId maps
 * to wording a first-time user understands, and — where the Easy engine can
 * genuinely solve it — a one-click fix expressed as an ordinary EasyChange
 * (undoable like everything else). Rules with no entry fall back to the
 * technical message, so new rules are never silently hidden.
 */

export interface PlainIssue {
  severity: PreflightIssue["severity"];
  message: string;
  /** One-click fix, when the engine can honestly solve it. */
  fix?: { label: string; change: EasyChange };
  ruleId: string;
}

interface RuleMapping {
  message: string | ((issue: PreflightIssue) => string);
  fix?:
    | { label: string; change: EasyChange }
    | ((doc: LabelDocument) => { label: string; change: EasyChange } | undefined);
}

const BALANCE: RuleMapping["fix"] = {
  label: "Balance layout",
  change: { relayout: true },
};

const RULE_MAP: Record<string, RuleMapping> = {
  "outside-canvas": {
    message: "Something sits outside the label and would be cut off.",
    fix: BALANCE,
  },
  "crosses-bleed": {
    message: "Something crosses the label edge and may be trimmed unevenly.",
    fix: BALANCE,
  },
  "outside-safe": {
    message: "Some text is too close to the edge — it could be clipped when the label is cut.",
    fix: BALANCE,
  },
  "font-too-small": {
    message: "Some text is too small to print clearly.",
    fix: { label: "Easier to read", change: { tweaks: { textBoost: true } } },
  },
  "font-small": {
    message: "Some text may be hard to read at print size.",
    fix: { label: "Easier to read", change: { tweaks: { textBoost: true } } },
  },
  "low-contrast": {
    message: "Some text doesn't stand out enough from its background.",
    // §13 "Fix contrast": the material's default palette is contrast-safe
    // by construction — offer it when the user isn't already on it.
    fix: (doc) => {
      if (!doc.easy) return undefined;
      const material = getMaterial(doc.easy.materialId);
      if (!material || doc.easy.paletteId === material.defaultPaletteId) return undefined;
      return {
        label: "Fix contrast",
        change: { paletteId: material.defaultPaletteId },
      };
    },
  },
  "out-of-gamut": {
    message: "A very bright screen color may print duller than it looks here.",
  },
  "thin-line": {
    message: "A line is so thin it may disappear in print.",
  },
  "image-low-dpi": {
    message: "An image may print blurry. Upload a larger image for the sharpest result.",
  },
  "image-soft-dpi": {
    message: "An image may look slightly soft in print — a larger source would be crisper.",
  },
  "qr-empty": {
    message: "Your QR code doesn't point anywhere yet — add a link in the QR field.",
  },
  "qr-invalid": {
    message: "The QR code content couldn't be encoded — try a shorter link.",
  },
  "qr-module-small": {
    message: "Your QR code is too small to scan reliably.",
    fix: { label: "Make the QR code bigger", change: { tweaks: { qrBoost: true } } },
  },
  "qr-quiet-zone": {
    message: "Your QR code needs a little clear space around it to scan.",
    fix: BALANCE,
  },
  "barcode-invalid": {
    message: "The barcode number isn't valid — check the digits in the barcode field.",
  },
  "barcode-short": {
    message: "The barcode is very short — handheld scanners like at least 8 mm of height.",
  },
  "white-ink-needed": {
    message:
      "Light artwork can disappear on clear or metallic material unless the printer adds a white backing layer — your printer file notes where.",
  },
  "white-ink-on-opaque": {
    message: "A white-ink layer is assigned, but this material is already opaque white.",
  },
  "die-cut-content": {
    message: "Text or images sit on the cutting-guide layer — cut lines should be simple shapes.",
  },
  "no-bleed": {
    message:
      "The design has no extra print area past the edge — a hairline of unprinted material can show after cutting.",
  },
  "transparent-bg": {
    message: "The background is transparent — the label material itself will show through.",
  },
  "empty-label": {
    message: "The label is empty — add your product information first.",
  },
  "batch-token": {
    message:
      "A {{data}} placeholder will be filled from your spreadsheet during batch export.",
  },
};

export function toPlainIssues(
  issues: readonly PreflightIssue[],
  doc: LabelDocument,
): PlainIssue[] {
  const seen = new Set<string>();
  const plain: PlainIssue[] = [];
  for (const issue of issues) {
    const mapping = RULE_MAP[issue.ruleId];
    const message =
      typeof mapping?.message === "function"
        ? mapping.message(issue)
        : (mapping?.message ?? issue.message);
    // One line per distinct problem — "3 texts too small" reads as one item.
    const key = `${issue.ruleId}:${message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Balance-layout fixes only help engine-owned objects; free objects
    // (Advanced Editor additions) need manual attention — drop the button.
    let fix = typeof mapping?.fix === "function" ? mapping.fix(doc) : mapping?.fix;
    if (fix?.change.relayout && issue.objectId) {
      const owned = findIsSlotObject(doc, issue.objectId);
      if (!owned) fix = undefined;
    }
    plain.push({ severity: issue.severity, message, fix, ruleId: issue.ruleId });
  }
  return plain;
}

function findIsSlotObject(doc: LabelDocument, id: string): boolean {
  let found = false;
  const walk = (objects: LabelDocument["objects"]): void => {
    for (const o of objects) {
      if (o.id === id) found = Boolean(o.slot);
      if (o.type === "group") walk(o.children);
    }
  };
  walk(doc.objects);
  return found;
}
