"use client";

import type { LabelDocument } from "@/lib/document/schema";
import { readEasyContent } from "./meta";
import type { SlotId } from "./slots";

/**
 * Company profile (§15): reusable content blocks — the fields that stay
 * the same across every label a business makes. Saved locally, filled
 * into new wizard labels automatically, always editable per label.
 * Nothing scientific or batch-specific belongs here by design.
 */

export const PROFILE_SLOTS: readonly SlotId[] = [
  "brand",
  "website",
  "contact",
  "notice",
  "storage",
  "warning",
];

export type CompanyProfile = Partial<Record<(typeof PROFILE_SLOTS)[number], string>>;

const KEY = "forge-labels:company-profile:v1";

export function loadProfile(): CompanyProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CompanyProfile;
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile: CompanyProfile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Storage blocked — saving defaults is a convenience, not a requirement.
  }
}

/** The profile-worthy fields currently on a label. */
export function profileFromDoc(doc: LabelDocument): CompanyProfile {
  const content = readEasyContent(doc);
  if (!content) return {};
  const profile: CompanyProfile = {};
  for (const slot of PROFILE_SLOTS) {
    const value = content.enabled.has(slot) ? content.fields[slot]?.trim() : undefined;
    if (value) profile[slot] = value;
  }
  return profile;
}

/** Merge saved defaults under the user's own answers (theirs always win). */
export function applyProfile(
  fields: Partial<Record<SlotId, string>>,
  profile: CompanyProfile | null,
): { fields: Partial<Record<SlotId, string>>; added: SlotId[] } {
  if (!profile) return { fields, added: [] };
  const merged = { ...fields };
  const added: SlotId[] = [];
  for (const slot of PROFILE_SLOTS) {
    const value = profile[slot]?.trim();
    if (value && !merged[slot]?.trim()) {
      merged[slot] = value;
      added.push(slot);
    }
  }
  return { fields: merged, added };
}
