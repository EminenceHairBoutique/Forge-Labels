"use client";

import { mutateDocument, withGesture } from "@/lib/document/commands";
import { useDocumentStore } from "@/stores/document-store";
import { loadFont } from "@/lib/fonts/registry";
import { measureTextHeightMm } from "@/lib/render/text-measure";
import { getEasyPalette } from "./palettes";
import { getMaterial, getMaterialOption } from "./materials";
import { getEasyTemplate, type EasyTemplateDef } from "./templates";
import { getPairing } from "./typography";
import {
  buildEasyLabel,
  mergeEasyObjects,
  type EffectPlacement,
} from "./instantiate";
import { densitySlotSet } from "./density";
import {
  nextEasyMeta,
  noticeTextFor,
  readEasyContent as readEasyState,
  SIMPLIFY_SLOTS,
  type EasyChange,
} from "./meta";
import { SLOTS, type SlotId } from "./slots";

/**
 * The bridge between the Easy form and the document. Reads current field
 * values from the slot objects (single source of truth) and applies
 * changes by re-running the layout engine through the command bus — every
 * form edit is one undoable gesture, autosave and export see ordinary
 * document mutations, and the Advanced Editor sees ordinary objects.
 */

export { readEasyContent as readEasyState, type EasyContent as EasyState } from "./meta";

export type { EasyChange } from "./meta";

/**
 * Load the fonts a template (or its pairing override) needs before
 * measuring with real metrics — every declared weight of every role
 * family, so weight variants inside rows never fall back mid-layout.
 */
export async function ensureEasyFonts(
  template: EasyTemplateDef,
  pairingId?: string,
): Promise<void> {
  const pairing = getPairing(pairingId ?? template.pairingId);
  const loads: Promise<void>[] = [];
  const load = (family: string, weights: number[]) => {
    for (const weight of weights) {
      loads.push(loadFont(family, weight).catch(() => {}));
    }
  };
  load(pairing.displayFamily, pairing.displayWeights);
  load(pairing.bodyFamily, pairing.bodyWeights);
  if (pairing.technicalFamily) {
    load(pairing.technicalFamily, pairing.technicalWeights ?? pairing.bodyWeights);
  }
  await Promise.all(loads);
}

/**
 * Apply one form change by regenerating the engine-owned objects. Always
 * reads the LIVE document from the store (never a prop) so debounced
 * commits can't resurrect stale field values, and changes are serialized —
 * two fields committing around the same await can't drop each other's
 * text. Returns the engine's plain-language notes for the UI to surface.
 */
let applyQueue: Promise<unknown> = Promise.resolve();

export function applyEasyChange(change: EasyChange): Promise<string[]> {
  const run = applyQueue.then(() => applyEasyChangeNow(change));
  applyQueue = run.catch(() => {});
  return run;
}

async function applyEasyChangeNow(change: EasyChange): Promise<string[]> {
  const doc = useDocumentStore.getState().doc;
  if (!doc) return [];
  const state = readEasyState(doc);
  if (!state) return [];

  const meta = nextEasyMeta(state.meta, change);

  const template = getEasyTemplate(meta.templateId);
  const material = getMaterial(meta.materialId);
  if (!template || !material) return [];
  const option = getMaterialOption(material, meta.materialOptionId);
  const palette = meta.customPalette ?? getEasyPalette(meta.paletteId);

  const fields = { ...state.fields };
  const enabled = new Set(state.enabled);
  const stash = { ...state.stash };

  if (change.field) {
    fields[change.field.slot] = change.field.value;
    if (change.field.value.trim()) enabled.add(change.field.slot);
    delete stash[change.field.slot];
  }
  if (change.toggle) {
    const { slot, on } = change.toggle;
    if (on) {
      enabled.add(slot);
      if (!fields[slot] && stash[slot]) fields[slot] = stash[slot];
      delete stash[slot];
    } else {
      enabled.delete(slot);
      const value = fields[slot];
      if (value?.trim()) stash[slot] = value;
      delete fields[slot];
    }
  }
  if (change.logo !== undefined) {
    if (change.logo) {
      fields.logo = change.logo.src;
      enabled.add("logo");
    } else {
      enabled.delete("logo");
      delete fields.logo;
      delete stash.logo;
    }
  }
  if (change.simplify) {
    // "Simplify design": nice-to-have fields go off, values stashed —
    // toggling them back on restores the text.
    for (const slot of SIMPLIFY_SLOTS) {
      if (!enabled.has(slot)) continue;
      enabled.delete(slot);
      const value = fields[slot];
      if (value?.trim()) stash[slot] = value;
      delete fields[slot];
    }
  }
  const extraNotes: string[] = [];
  if (change.noticeId) {
    const text = noticeTextFor(change);
    if (text) {
      fields.notice = text;
      enabled.add("notice");
      delete stash.notice;
    }
  }
  if (change.densityMode) {
    // Bulk field-set switch (§11): the mode's slots come on where content
    // exists (stash included); everything optional outside the set goes
    // off with its value stashed. Required slots and the logo are never
    // touched, and slots this layout has no place for are reported.
    const wanted = densitySlotSet(change.densityMode, meta.industry);
    const supported = new Set<SlotId>([
      ...template.rows.map((r) => r.slot),
      ...(template.verticalRow ? [template.verticalRow.slot] : []),
      "qr",
      "barcode",
      "logo",
    ]);
    const missing: SlotId[] = [];
    for (const slot of Object.keys(SLOTS) as SlotId[]) {
      if (!SLOTS[slot].optional || SLOTS[slot].kind === "logo") continue;
      const hasContent = Boolean(fields[slot]?.trim() || stash[slot]?.trim());
      if (wanted.has(slot)) {
        if (!hasContent) continue; // the mode opens doors, it doesn't invent content
        if (!supported.has(slot)) {
          missing.push(slot);
          continue;
        }
        enabled.add(slot);
        if (!fields[slot] && stash[slot]) fields[slot] = stash[slot];
        delete stash[slot];
      } else if (enabled.has(slot)) {
        enabled.delete(slot);
        const value = fields[slot];
        if (value?.trim()) stash[slot] = value;
        delete fields[slot];
      }
    }
    if (missing.length > 0) {
      extraNotes.push(
        `This layout has no place for ${missing
          .map((s) => `"${SLOTS[s].label}"`)
          .join(", ")} — try a research layout from Browse all templates.`,
      );
    }
  }
  meta.stash = Object.keys(stash).length > 0 ? stash : undefined;

  await ensureEasyFonts(template, meta.pairingId);

  const build = buildEasyLabel({
    template,
    widthMm: doc.label.widthMm,
    heightMm: doc.label.heightMm,
    bleedMm: doc.label.bleedMm,
    safeMm: doc.label.safeMm,
    material,
    option,
    intensity: meta.intensity ?? material.defaultIntensity,
    palette,
    fields,
    enabled,
    measure: measureTextHeightMm,
    tweaks: meta.tweaks,
    pairingId: meta.pairingId,
    placement: meta.placement as EffectPlacement | undefined,
    logoAspect: meta.logoAspect,
    qrStyle: meta.qrStyle,
  });

  withGesture(() => {
    mutateDocument((current) => ({
      ...mergeEasyObjects(current, build),
      easy: meta,
    }));
  });

  return [...build.notes, ...extraNotes];
}

/** Toggle metadata for the form: which slots show an on/off switch. */
export function toggleableSlots(): SlotId[] {
  return (Object.keys(SLOTS) as SlotId[]).filter(
    (id) => SLOTS[id].optional && SLOTS[id].kind !== "logo",
  );
}
