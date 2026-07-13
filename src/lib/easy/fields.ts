"use client";

import { mutateDocument, withGesture } from "@/lib/document/commands";
import { useDocumentStore } from "@/stores/document-store";
import { loadFont } from "@/lib/fonts/registry";
import { measureTextHeightMm } from "@/lib/render/text-measure";
import { getEasyPalette } from "./palettes";
import { getMaterial, getMaterialOption } from "./materials";
import { getEasyTemplate, type EasyTemplateDef } from "./templates";
import { buildEasyLabel, mergeEasyObjects } from "./instantiate";
import {
  nextEasyMeta,
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

/** Load the fonts a template needs before measuring with real metrics. */
export async function ensureEasyFonts(template: EasyTemplateDef): Promise<void> {
  await Promise.all([
    loadFont(template.fonts.display, template.fonts.displayWeight).catch(() => {}),
    loadFont(template.fonts.body, template.fonts.bodyWeight).catch(() => {}),
  ]);
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
  const palette = getEasyPalette(meta.paletteId);

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
  meta.stash = Object.keys(stash).length > 0 ? stash : undefined;

  await ensureEasyFonts(template);

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
  });

  withGesture(() => {
    mutateDocument((current) => ({
      ...mergeEasyObjects(current, build),
      easy: meta,
    }));
  });

  return build.notes;
}

/** Toggle metadata for the form: which slots show an on/off switch. */
export function toggleableSlots(): SlotId[] {
  return (Object.keys(SLOTS) as SlotId[]).filter(
    (id) => SLOTS[id].optional && SLOTS[id].kind !== "logo",
  );
}
