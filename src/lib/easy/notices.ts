/**
 * Research-use notice system (§7). Curated NEUTRAL notice texts the user
 * chooses between (or replaces with their own words). The app never
 * claims any single statement is legally sufficient — the user reviews
 * their notice before export, alongside the reminder below.
 *
 * Admin-configurable notice language (an org-level approved list) is
 * deferred; see docs/deferred.md.
 */

export interface NoticeOption {
  id: string;
  text: string;
}

export const NOTICE_OPTIONS: readonly NoticeOption[] = [
  { id: "ruo", text: "FOR RESEARCH USE ONLY" },
  { id: "nhc", text: "NOT FOR HUMAN CONSUMPTION" },
  { id: "lab-analytical", text: "FOR LABORATORY AND ANALYTICAL USE ONLY" },
  {
    id: "non-clinical",
    text: "NOT FOR CLINICAL, DIAGNOSTIC, OR THERAPEUTIC USE",
  },
  { id: "in-vitro", text: "FOR IN-VITRO LABORATORY RESEARCH ONLY" },
] as const;

export const CUSTOM_NOTICE_ID = "custom";

export function getNotice(id: string | undefined | null): NoticeOption | undefined {
  return NOTICE_OPTIONS.find((n) => n.id === id);
}

/** Match a free-text notice back to a preset (whitespace-insensitive). */
export function noticeIdForText(text: string): string {
  const norm = text.trim().replace(/\s+/g, " ").toUpperCase();
  return NOTICE_OPTIONS.find((n) => n.text === norm)?.id ?? CUSTOM_NOTICE_ID;
}

/** Shown wherever the user reviews their notice (§7, verbatim intent). */
export const NOTICE_REMINDER =
  "A research-use notice does not by itself determine or legally establish " +
  "a product's intended use. Product descriptions, marketing, instructions, " +
  "imagery, and surrounding claims must also remain consistent with the " +
  "actual lawful use of the product.";
