import type { SlotId } from "./slots";
import { SLOTS, TEXT_SLOTS } from "./slots";

/**
 * Compliance safeguards (§29): scan the label's text for phrases that may
 * imply medical use, human consumption, or regulatory status, and for
 * regulated identifiers that need explicit authorization. Findings are
 * WARNINGS requiring review — user content is never deleted or edited
 * automatically, and acknowledgments are recorded on the project
 * (easy.complianceAck) so there is an audit trail of what was reviewed
 * before export.
 *
 * This is a design tool: flagging is a courtesy check, not legal review,
 * and the copy says so.
 */

export interface ComplianceFinding {
  slot: SlotId;
  /** The matched phrase, as configured (lowercase). */
  phrase: string;
  /** The user's text around the match, for the review list. */
  excerpt: string;
  kind: "claim" | "identifier";
  message: string;
}

/** Phrases that may imply medical use or an unsupported claim. */
const CLAIM_PHRASES: readonly string[] = [
  "treats",
  "treat",
  "treatment",
  "cures",
  "cure",
  "prevents",
  "prevent",
  "heals",
  "heal",
  "safe for human use",
  "human use",
  "inject",
  "injection",
  "dosage",
  "dose daily",
  "take daily",
  "weight-loss",
  "weight loss",
  "anti-aging treatment",
  "fda approved",
  "fda-approved",
  "prescription",
  "clinically proven",
  "therapeutic",
  "sterile",
  "sterility",
];

/** Regulated identifiers that require explicit user authorization. */
const IDENTIFIER_TOKENS: readonly string[] = [
  "ndc",
  "dea",
  "gmp",
  "iso 9001",
  "iso 13485",
  "usp",
  "rx only",
];

const CLAIM_MESSAGE =
  "This wording may imply medical use, a quality guarantee, or an approval the label can't establish. Review it before printing — it stays exactly as you wrote it.";

const IDENTIFIER_MESSAGE =
  "This looks like a regulated identifier or certification mark. Confirm that you are authorized to use it and that the information is accurate.";

function wordBoundaryMatch(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "iu").test(text);
}

function excerptAround(text: string, phrase: string): string {
  const idx = text.toLowerCase().indexOf(phrase.toLowerCase());
  if (idx < 0) return text.slice(0, 60);
  const start = Math.max(0, idx - 20);
  const end = Math.min(text.length, idx + phrase.length + 20);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

/**
 * Scan all text fields. The `notice` slot is exempt from claim phrases —
 * curated notices like "NOT FOR HUMAN CONSUMPTION" legitimately contain
 * flagged words in the negative.
 */
export function scanCompliance(
  fields: Partial<Record<SlotId, string>>,
): ComplianceFinding[] {
  const findings: ComplianceFinding[] = [];
  for (const slot of TEXT_SLOTS) {
    const value = fields[slot];
    if (!value?.trim()) continue;
    if (slot !== "notice") {
      for (const phrase of CLAIM_PHRASES) {
        if (wordBoundaryMatch(value, phrase)) {
          findings.push({
            slot,
            phrase,
            excerpt: excerptAround(value, phrase),
            kind: "claim",
            message: CLAIM_MESSAGE,
          });
        }
      }
    }
    for (const token of IDENTIFIER_TOKENS) {
      if (wordBoundaryMatch(value, token)) {
        findings.push({
          slot,
          phrase: token,
          excerpt: excerptAround(value, token),
          kind: "identifier",
          message: IDENTIFIER_MESSAGE,
        });
      }
    }
  }
  // One finding per slot+phrase; negations ("does not treat") still flag —
  // the reviewer decides, the tool only points.
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.slot}|${f.phrase}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Plain label for the review list ("Warning text", "Description"…). */
export function findingSlotLabel(f: ComplianceFinding): string {
  return SLOTS[f.slot].label;
}
