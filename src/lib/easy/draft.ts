"use client";

import type { IndustryId } from "./industries";
import type { Intensity } from "./materials";
import type { SlotId } from "./slots";
import type { ContentDensity, GlassId } from "./templates";

/**
 * Wizard draft persistence: every step writes here, so a refresh (or an
 * accidental back-swipe on a phone) never loses progress. localStorage,
 * one draft at a time, cleared when the project is created.
 */

export interface WizardDraft {
  version: 1;
  step: number;
  /** "Make my label for me" — one combined screen, three finished options. */
  auto?: boolean;
  presetId?: string;
  measurements?: "preset" | "custom" | "later";
  diameterMm?: number;
  straightWallHeightMm?: number;
  materialId?: string;
  materialOptionId?: string;
  intensity?: Intensity;
  /** Label purpose ("What type of label are you creating?"). */
  industry?: IndustryId;
  styleId?: string;
  preferDark?: boolean | null;
  /** Vial glass color ("What color is your container?"). */
  glass?: GlassId;
  /** How much information must fit (§7). */
  density?: ContentDensity;
  wantsQr?: boolean;
  wantsBarcode?: boolean;
  hasLogo?: boolean;
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
