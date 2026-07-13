"use client";

import type { Intensity } from "./materials";
import type { SlotId } from "./slots";

/**
 * Wizard draft persistence: every step writes here, so a refresh (or an
 * accidental back-swipe on a phone) never loses progress. localStorage,
 * one draft at a time, cleared when the project is created.
 */

export interface WizardDraft {
  version: 1;
  step: number;
  presetId?: string;
  measurements?: "preset" | "custom" | "later";
  diameterMm?: number;
  straightWallHeightMm?: number;
  materialId?: string;
  materialOptionId?: string;
  intensity?: Intensity;
  styleId?: string;
  preferDark?: boolean | null;
  fields?: Partial<Record<SlotId, string>>;
  templateId?: string;
  paletteId?: string;
}

const KEY = "forge-labels:easy-draft:v1";

export function loadDraft(): WizardDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WizardDraft;
    return parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft: WizardDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Storage full/blocked — the wizard still works, it just won't survive refresh.
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
