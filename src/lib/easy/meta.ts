import type {
  EasyMeta,
  EasyTweaks,
  LabelDocument,
  LabelObject,
} from "@/lib/document/schema";
import type { DensityMode } from "./density";
import { getMaterial, type Intensity } from "./materials";
import { getNotice, noticeIdForText } from "./notices";
import { isSlotId, type SlotId } from "./slots";

/**
 * Pure Easy-meta transitions (DOM-free — fields.ts wires them to the
 * store; tests exercise them directly).
 */

export interface EasyChange {
  field?: { slot: SlotId; value: string };
  toggle?: { slot: SlotId; on: boolean };
  paletteId?: string;
  templateId?: string;
  material?: { materialId: string; optionId: string };
  intensity?: Intensity;
  /** Font-pairing override ("Try another font") — null restores the template's. */
  pairingId?: string | null;
  /** Effect placement for holographic/neon/metallic ("auto" = intensity-driven). */
  placement?: string;
  /** Logo upload (data URL + aspect) — null removes the logo. */
  logo?: { src: string; aspect: number } | null;
  /** One-click fixes: merged into meta.tweaks so later edits keep them. */
  tweaks?: Partial<EasyTweaks>;
  /** Turn off the nice-to-have fields (Simplify design) — values stashed. */
  simplify?: boolean;
  /** Rebuild from current values (Balance layout) — no meta change. */
  relayout?: boolean;
  /**
   * Content-density field set (§11): bulk-enables the mode's slots that
   * have values (stash included) and stashes the rest — reversible like
   * any toggle.
   */
  densityMode?: DensityMode;
  /** Curated research-use notice preset — sets the `notice` field text. */
  noticeId?: string;
  /** Mark the notice as reviewed (export flow) — epoch ms of the review. */
  noticeReviewed?: number;
  /** Record acknowledged compliance warnings (export flow audit trail). */
  acknowledge?: { slot: string; phrase: string; at: number }[];
}

/** Slots "Simplify design" turns off (values are stashed, so reversible). */
export const SIMPLIFY_SLOTS: readonly SlotId[] = [
  "subtitle",
  "description",
  "storage",
  "website",
];

export interface EasyContent {
  meta: EasyMeta;
  fields: Partial<Record<SlotId, string>>;
  /** Slots currently materialized on the label. */
  enabled: Set<SlotId>;
  /** Values remembered for toggled-off slots. */
  stash: Record<string, string>;
}

/**
 * Read the Easy state straight from a document: field values live in the
 * slot objects (single source of truth), stashed values in the meta.
 */
export function readEasyContent(doc: LabelDocument): EasyContent | null {
  if (!doc.easy) return null;
  const fields: Partial<Record<SlotId, string>> = {};
  const enabled = new Set<SlotId>();
  const walk = (objects: readonly LabelObject[]): void => {
    for (const o of objects) {
      if (o.type === "group") walk(o.children);
      if (!o.slot || !isSlotId(o.slot)) continue;
      enabled.add(o.slot);
      if (o.type === "text") fields[o.slot] = o.text;
      else if (o.type === "qrcode") fields[o.slot] = o.value;
      else if (o.type === "barcode") fields[o.slot] = o.value;
    }
  };
  walk(doc.objects);
  const stash = doc.easy.stash ?? {};
  for (const [slot, value] of Object.entries(stash)) {
    if (isSlotId(slot) && !(slot in fields)) fields[slot] = value;
  }
  return { meta: doc.easy, fields, enabled, stash };
}

/**
 * On a material change the palette carries across only when the new
 * material offers it (otherwise its curated default keeps the contrast
 * rules holding), sub-options revalidate, and intensity resets to the
 * material's default unless explicitly chosen.
 */
export function nextEasyMeta(current: EasyMeta, change: EasyChange): EasyMeta {
  const meta: EasyMeta = { ...current };
  if (change.paletteId) meta.paletteId = change.paletteId;
  if (change.templateId) {
    meta.templateId = change.templateId;
    // A template's curated pairing is part of its design — switching
    // templates clears a font override so each layout shows its own voice.
    meta.pairingId = undefined;
  }
  if (change.intensity) meta.intensity = change.intensity;
  if (change.pairingId !== undefined) {
    meta.pairingId = change.pairingId ?? undefined;
  }
  if (change.placement) {
    meta.placement = change.placement === "auto" ? undefined : change.placement;
  }
  if (change.logo !== undefined) {
    meta.logoAspect = change.logo?.aspect;
  }
  if (change.tweaks) {
    meta.tweaks = { ...meta.tweaks, ...change.tweaks };
  }
  if (change.material) {
    meta.materialId = change.material.materialId;
    meta.materialOptionId = change.material.optionId;
    const nextMaterial = getMaterial(meta.materialId);
    if (nextMaterial) {
      if (!nextMaterial.paletteIds.includes(meta.paletteId)) {
        meta.paletteId = nextMaterial.defaultPaletteId;
      }
      if (!nextMaterial.options.some((o) => o.id === meta.materialOptionId)) {
        meta.materialOptionId = nextMaterial.defaultOptionId;
      }
      if (!change.intensity) meta.intensity = nextMaterial.defaultIntensity;
    }
  }
  if (change.densityMode) meta.densityMode = change.densityMode;
  if (change.noticeId) {
    meta.noticeId = change.noticeId;
    meta.noticeReviewedAt = undefined; // new text → needs a fresh review
  }
  if (change.field?.slot === "notice") {
    meta.noticeId = noticeIdForText(change.field.value);
    meta.noticeReviewedAt = undefined;
  }
  if (change.noticeReviewed) meta.noticeReviewedAt = change.noticeReviewed;
  if (change.acknowledge?.length) {
    meta.complianceAck = [...(meta.complianceAck ?? []), ...change.acknowledge];
  }
  return meta;
}

/** The notice text a `noticeId` change should write into the field. */
export function noticeTextFor(change: EasyChange): string | undefined {
  if (!change.noticeId) return undefined;
  return getNotice(change.noticeId)?.text;
}
